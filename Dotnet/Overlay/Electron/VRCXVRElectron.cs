using System.Collections.Concurrent;
using System.Globalization;
using System.IO.MemoryMappedFiles;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using NLog;
using Valve.VR;

namespace VRCX.Overlay.Electron;

internal sealed class VRCXVRElectron : VRCXVRInterface, IDisposable
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly float[] Rotation = [0f, 0f, 0f];
    private static readonly float[] Translation = [0f, 0f, 0f];
    private static readonly float[] TranslationLeft = [-7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] TranslationRight = [7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] RotationLeft = [90f * (float)(Math.PI / 180f), 90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];
    private static readonly float[] RotationRight = [-90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];

    private const string OVERLAY_SHM_PATH = "/dev/shm/vrcx_overlay";
    private const int WRIST_FRAME_HEIGHT = 512;
    private const int HMD_FRAME_HEIGHT = 1024;
    private const int SHARED_FRAME_WIDTH = 1024;
    private const int SHARED_FRAME_HEIGHT = WRIST_FRAME_HEIGHT + HMD_FRAME_HEIGHT;
    private const int SHARED_FRAME_SIZE = SHARED_FRAME_WIDTH * SHARED_FRAME_HEIGHT * 4;

    private readonly List<string[]> _deviceList = [];
    private readonly ReaderWriterLockSlim _deviceListLock = new();
    private readonly ConcurrentQueue<KeyValuePair<string, string>> _overlayFunctionQueue = new();
    private readonly byte[] _frameBuffer = new byte[SHARED_FRAME_SIZE];
    private Thread? _thread;
    private GLTextureWriter? _overlayTextureWriter;
    private MemoryMappedFile? _overlayMMF;
    private MemoryMappedViewAccessor? _overlayAccessor;
    private bool _active;
    private bool _openVrActive;
    private bool _isOverlayStarted;
    private bool _menuButton;
    private int _overlayHand;
    private DateTime _nextInit = DateTime.MinValue;
    private DateTime _nextDeviceUpdate = DateTime.MinValue;
    private DateTime _nextOverlayUpdate = DateTime.MinValue;
    private uint _overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;

    private ulong _hmdOverlayHandle;
    private bool _hmdOverlayActive;
    private bool _hmdOverlayWasActive;
    private bool _hmdOverlayVisible;

    private ulong _wristOverlayHandle;
    private bool _wristOverlayActive;
    private bool _wristOverlayWasActive;
    private bool _wristOverlayVisible;

    public VRCXVRElectron()
    {
        _thread = new Thread(ThreadLoop)
        {
            IsBackground = true,
        };
    }

    public override void Init() => _thread?.Start();

    public override void Shutdown()
    {
        StopThread();
        ReleaseOverlayResources();
    }

    public override void Restart()
    {
        Dispose();
        var instance = new VRCXVRElectron();
        instance.Init();
        Program.VRCXVRInstance = instance;
    }

    public void Dispose()
    {
        StopThread();
        _overlayTextureWriter?.Dispose();
        _overlayTextureWriter = null;
        ReleaseOverlayResources();
        _deviceListLock.Dispose();
    }

    private void StopThread()
    {
        Thread? thread = _thread;
        _thread = null;
        thread?.Interrupt();
        thread?.Join();
    }

    private void ReleaseOverlayResources()
    {
        _overlayAccessor?.Dispose();
        _overlayAccessor = null;
        _overlayMMF?.Dispose();
        _overlayMMF = null;

        GLContextX11.Cleanup();
        GLContextWayland.Cleanup();
    }

    private void SetupTextures()
    {
        bool hasWaylandDisplay = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY"));
        bool preferWayland = hasWaylandDisplay ||
            string.Equals(Environment.GetEnvironmentVariable("XDG_SESSION_TYPE"), "wayland", StringComparison.OrdinalIgnoreCase);

        bool contextInitialised = preferWayland ? GLContextWayland.Initialise() : GLContextX11.Initialise();
        if (!contextInitialised)
        {
            contextInitialised = hasWaylandDisplay ? GLContextX11.Initialise() : GLContextWayland.Initialise();
        }

        if (!contextInitialised)
        {
            throw new InvalidOperationException("Failed to initialise OpenGL context");
        }

        _overlayTextureWriter = new GLTextureWriter(SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
        _overlayTextureWriter.UpdateTexture();
    }

    private byte[]? GetLatestOverlayFrame()
    {
        if (_overlayAccessor == null)
        {
            return null;
        }

        byte ready = _overlayAccessor.ReadByte(0);
        if (ready != 1)
        {
            return null;
        }

        _overlayAccessor.ReadArray(1, _frameBuffer, 0, SHARED_FRAME_SIZE);
        _overlayAccessor.Write(0, (byte)0);
        return _frameBuffer;
    }

    private static void FlipImageVertically(byte[] imageData, int width, int height)
    {
        int stride = width * 4;
        byte[] tempRow = new byte[stride];

        for (int y = 0; y < height / 2; y++)
        {
            int topIndex = y * stride;
            int bottomIndex = (height - 1 - y) * stride;

            Buffer.BlockCopy(imageData, topIndex, tempRow, 0, stride);
            Buffer.BlockCopy(imageData, bottomIndex, imageData, topIndex, stride);
            Buffer.BlockCopy(tempRow, 0, imageData, bottomIndex, stride);
        }
    }

    private void ThreadLoop()
    {
        _nextOverlayUpdate = DateTime.MinValue;
        while (_thread != null)
        {
            SleepBetweenFrames();
            if (_active)
            {
                TickActive();
            }
            else if (_openVrActive)
            {
                DeactivateOpenVr();
            }
        }

        ReleaseOverlayResources();
    }

    private void SleepBetweenFrames()
    {
        try
        {
            Thread.Sleep(_active ? 1 : 32);
        }
        catch (ThreadInterruptedException)
        {
            Logger.Debug(CultureInfo.InvariantCulture, "VR overlay thread interrupted");
        }
    }

    private void TickActive()
    {
        CVRSystem? system = OpenVR.System;
        if (system == null)
        {
            system = InitOpenVr();
            if (system == null)
            {
                return;
            }
        }

        system = PollEvents(system);
        if (system == null)
        {
            return;
        }

        RefreshDevices(system);

        CVROverlay overlay = OpenVR.Overlay;
        if (overlay != null)
        {
            ProcessOverlays(overlay);
        }
    }

    private CVRSystem? InitOpenVr()
    {
        if (DateTime.UtcNow.CompareTo(_nextInit) <= 0)
        {
            return null;
        }

        EVRInitError initError = EVRInitError.None;
        CVRSystem? system = OpenVR.Init(ref initError, EVRApplicationType.VRApplication_Background);
        _nextInit = DateTime.UtcNow.AddSeconds(5);
        if (system == null)
        {
            return null;
        }

        _openVrActive = true;
        SetupTextures();
        _isOverlayStarted = true;
        return system;
    }

    private CVRSystem? PollEvents(CVRSystem system)
    {
        var vrEvent = new VREvent_t();
        while (system.PollNextEvent(ref vrEvent, (uint)Marshal.SizeOf(vrEvent)))
        {
            if ((EVREventType)vrEvent.eventType != EVREventType.VREvent_Quit)
            {
                continue;
            }

            _isOverlayStarted = false;
            _openVrActive = false;
            IsHmdAfk = false;
            OpenVR.Shutdown();
            _nextInit = DateTime.UtcNow.AddSeconds(10);
            _wristOverlayHandle = 0;
            _hmdOverlayHandle = 0;
            return null;
        }

        return system;
    }

    private void RefreshDevices(CVRSystem system)
    {
        if (DateTime.UtcNow.CompareTo(_nextDeviceUpdate) < 0)
        {
            return;
        }

        _overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
        UpdateDevices(system, ref _overlayIndex);
        if (_overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
        {
            _nextOverlayUpdate = DateTime.UtcNow.AddSeconds(10);
        }

        _nextDeviceUpdate = DateTime.UtcNow.AddSeconds(0.1);
    }

    private void ProcessOverlays(CVROverlay overlay)
    {
        bool dashboardVisible = overlay.IsDashboardVisible();

        if (_wristOverlayActive)
        {
            EVROverlayError err = ProcessWristOverlay(overlay, dashboardVisible);
            if (err != EVROverlayError.None &&
                _wristOverlayHandle != 0)
            {
                overlay.DestroyOverlay(_wristOverlayHandle);
                _wristOverlayHandle = 0;
                Logger.Error(CultureInfo.InvariantCulture, err);
            }
        }

        if (_hmdOverlayActive)
        {
            EVROverlayError err = ProcessHmdOverlay(overlay, dashboardVisible);
            if (err != EVROverlayError.None &&
                _hmdOverlayHandle != 0)
            {
                overlay.DestroyOverlay(_hmdOverlayHandle);
                _hmdOverlayHandle = 0;
                Logger.Error(CultureInfo.InvariantCulture, err);
            }
        }
    }

    private void DeactivateOpenVr()
    {
        _openVrActive = false;
        _isOverlayStarted = false;
        IsHmdAfk = false;
        OpenVR.Shutdown();
        ClearDeviceList();
    }

    public override void SetActive(bool active, bool hmdOverlay, bool wristOverlay, bool menuButton, int overlayHand)
    {
        _active = active;
        _hmdOverlayActive = hmdOverlay;
        _wristOverlayActive = wristOverlay;
        _menuButton = menuButton;
        _overlayHand = overlayHand;

        if (_hmdOverlayActive != _hmdOverlayWasActive && _hmdOverlayHandle != 0)
        {
            OpenVR.Overlay.DestroyOverlay(_hmdOverlayHandle);
            _hmdOverlayHandle = 0;
        }
        _hmdOverlayWasActive = _hmdOverlayActive;

        if (_wristOverlayActive != _wristOverlayWasActive && _wristOverlayHandle != 0)
        {
            OpenVR.Overlay.DestroyOverlay(_wristOverlayHandle);
            _wristOverlayHandle = 0;
        }
        _wristOverlayWasActive = _wristOverlayActive;

        if (!_active || (!_hmdOverlayActive && !_wristOverlayActive))
        {
            ReleaseOverlayResources();
        }
    }

    public override bool IsActive() => _active;

    public override void Refresh()
    {
    }

    public override string[][] GetDevices()
    {
        _deviceListLock.EnterReadLock();
        try
        {
            return [.. _deviceList];
        }
        finally
        {
            _deviceListLock.ExitReadLock();
        }
    }

    private void ClearDeviceList()
    {
        _deviceListLock.EnterWriteLock();
        try
        {
            _deviceList.Clear();
        }
        finally
        {
            _deviceListLock.ExitWriteLock();
        }
    }

    private void AddDevice(string[] device)
    {
        _deviceListLock.EnterWriteLock();
        try
        {
            _deviceList.Add(device);
        }
        finally
        {
            _deviceListLock.ExitWriteLock();
        }
    }

    private void UpdateDevices(CVRSystem system, ref uint overlayIndex)
    {
        ClearDeviceList();

        var sb = new StringBuilder(256);
        var state = new VRControllerState_t();
        var poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];
        system.GetDeviceToAbsoluteTrackingPose(ETrackingUniverseOrigin.TrackingUniverseStanding, 0, poses);
        for (uint i = 0u; i < OpenVR.k_unMaxTrackedDeviceCount; ++i)
        {
            ETrackedDeviceClass devClass = system.GetTrackedDeviceClass(i);
            switch (devClass)
            {
                case ETrackedDeviceClass.HMD:
                    AddHeadset(system, i, poses[i]);
                    break;
                case ETrackedDeviceClass.Controller:
                case ETrackedDeviceClass.GenericTracker:
                case ETrackedDeviceClass.TrackingReference:
                    AddTrackedDevice(system, i, devClass, poses[i], sb, ref state, ref overlayIndex);
                    break;
                case ETrackedDeviceClass.Invalid:
                case ETrackedDeviceClass.DisplayRedirect:
                case ETrackedDeviceClass.Max:
                    break;
                default:
                    break;
            }
        }
    }

    private void AddHeadset(CVRSystem system, uint index, TrackedDevicePose_t pose)
    {
        var state = new VRControllerState_t();
        if (!system.GetControllerState(index, ref state, (uint)Marshal.SizeOf(state)))
        {
            return;
        }

        ETrackedPropertyError err = ETrackedPropertyError.TrackedProp_Success;
        float batteryPercentage = system.GetFloatTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            return;
        }

        string[] headset =
        [
            "headset",
            system.IsTrackedDeviceConnected(index) ? "connected" : "disconnected",
            "discharging",
            (batteryPercentage * 100).ToString(CultureInfo.InvariantCulture),
            pose.eTrackingResult.ToString(),
        ];
        AddDevice(headset);
    }

    private void AddTrackedDevice(CVRSystem system, uint index, ETrackedDeviceClass devClass, TrackedDevicePose_t pose, StringBuilder sb, ref VRControllerState_t state, ref uint overlayIndex)
    {
        ETrackedPropertyError err = ETrackedPropertyError.TrackedProp_Success;
        float batteryPercentage = system.GetFloatTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            batteryPercentage = 1f;
        }

        err = ETrackedPropertyError.TrackedProp_Success;
        bool isCharging = system.GetBoolTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceIsCharging_Bool, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            isCharging = false;
        }

        sb.Clear();
        system.GetStringTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_TrackingSystemName_String, sb, (uint)sb.Capacity, ref err);
        bool isOculus = sb.ToString().Contains("oculus", StringComparison.OrdinalIgnoreCase);

        ETrackedControllerRole role = system.GetControllerRoleForTrackedDeviceIndex(index);
        if (role is ETrackedControllerRole.LeftHand or ETrackedControllerRole.RightHand)
        {
            TrySelectOverlayController(system, index, role, isOculus, ref state, ref overlayIndex);
        }

        string[] item =
        [
            DeviceTypeName(devClass, role),
            system.IsTrackedDeviceConnected(index) ? "connected" : "disconnected",
            isCharging ? "charging" : "discharging",
            (batteryPercentage * 100).ToString(CultureInfo.InvariantCulture),
            pose.eTrackingResult.ToString(),
        ];
        AddDevice(item);
    }

    private void TrySelectOverlayController(CVRSystem system, uint index, ETrackedControllerRole role, bool isOculus, ref VRControllerState_t state, ref uint overlayIndex)
    {
        bool handSelected = _overlayHand == 0 ||
            (_overlayHand == 1 && role == ETrackedControllerRole.LeftHand) ||
            (_overlayHand == 2 && role == ETrackedControllerRole.RightHand);
        if (!handSelected)
        {
            return;
        }

        uint buttonMask = _menuButton ? 2u : isOculus ? 128u : 4u;
        if (!system.GetControllerState(index, ref state, (uint)Marshal.SizeOf(state)) ||
            (state.ulButtonPressed & buttonMask) == 0)
        {
            return;
        }

        _nextOverlayUpdate = DateTime.MinValue;
        if (role == ETrackedControllerRole.LeftHand)
        {
            Array.Copy(TranslationLeft, Translation, 3);
            Array.Copy(RotationLeft, Rotation, 3);
        }
        else
        {
            Array.Copy(TranslationRight, Translation, 3);
            Array.Copy(RotationRight, Rotation, 3);
        }

        overlayIndex = index;
    }

    private static string DeviceTypeName(ETrackedDeviceClass devClass, ETrackedControllerRole role) => devClass switch
    {
        ETrackedDeviceClass.Controller => role == ETrackedControllerRole.LeftHand
            ? "leftController"
            : role == ETrackedControllerRole.RightHand ? "rightController" : "controller",
        ETrackedDeviceClass.GenericTracker => "tracker",
        ETrackedDeviceClass.TrackingReference => "base",
        ETrackedDeviceClass.Invalid or ETrackedDeviceClass.HMD or ETrackedDeviceClass.DisplayRedirect or ETrackedDeviceClass.Max => string.Empty,
        _ => string.Empty,
    };

    private EVROverlayError ProcessWristOverlay(CVROverlay overlay, bool dashboardVisible)
    {
        EVROverlayError err;

        if (_wristOverlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX1", ref _wristOverlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                err = CreateWristOverlay(overlay);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        if (_overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
        {
            err = ApplyWristTransform(overlay);
            if (err != EVROverlayError.None)
            {
                return err;
            }
        }

        if (!dashboardVisible &&
            DateTime.UtcNow.CompareTo(_nextOverlayUpdate) <= 0)
        {
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 0.5f,
                vMin = 0f,
                vMax = (float)WRIST_FRAME_HEIGHT / SHARED_FRAME_HEIGHT,
            };
            return UploadOverlayFrame(overlay, _wristOverlayHandle, ref _wristOverlayVisible, bounds);
        }

        return _wristOverlayVisible ? HideOverlay(overlay, _wristOverlayHandle, ref _wristOverlayVisible) : EVROverlayError.None;
    }

    private EVROverlayError CreateWristOverlay(CVROverlay overlay)
    {
        _wristOverlayVisible = false;
        EVROverlayError err = CreateDefaultOverlay(overlay, "VRCX1", ref _wristOverlayHandle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        OpenSharedFrame();
        return EVROverlayError.None;
    }

    private EVROverlayError ApplyWristTransform(CVROverlay overlay)
    {
        var m = Matrix4x4.CreateScale(0.25f);
        m *= Matrix4x4.CreateRotationX(Rotation[0]);
        m *= Matrix4x4.CreateRotationY(Rotation[1]);
        m *= Matrix4x4.CreateRotationZ(Rotation[2]);
        m *= Matrix4x4.CreateTranslation(new Vector3(Translation[0], Translation[1], Translation[2]));
        HmdMatrix34_t transform = ToHmdMatrix34(m);
        return overlay.SetOverlayTransformTrackedDeviceRelative(_wristOverlayHandle, _overlayIndex, ref transform);
    }

    private EVROverlayError ProcessHmdOverlay(CVROverlay overlay, bool dashboardVisible)
    {
        EVROverlayError err;

        if (_hmdOverlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX2", ref _hmdOverlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                err = CreateHmdOverlay(overlay);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        if (!dashboardVisible)
        {
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 1f,
                vMin = (float)(SHARED_FRAME_HEIGHT - HMD_FRAME_HEIGHT) / SHARED_FRAME_HEIGHT,
                vMax = 1f,
            };
            return UploadOverlayFrame(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible, bounds);
        }

        return _hmdOverlayVisible ? HideOverlay(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible) : EVROverlayError.None;
    }

    private EVROverlayError CreateHmdOverlay(CVROverlay overlay)
    {
        _hmdOverlayVisible = false;
        EVROverlayError err = CreateDefaultOverlay(overlay, "VRCX2", ref _hmdOverlayHandle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        var m = Matrix4x4.CreateScale(1f);
        m *= Matrix4x4.CreateTranslation(0, -0.3f, -1.5f);
        HmdMatrix34_t transform = ToHmdMatrix34(m);
        err = overlay.SetOverlayTransformTrackedDeviceRelative(_hmdOverlayHandle, OpenVR.k_unTrackedDeviceIndex_Hmd, ref transform);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        OpenSharedFrame();
        return EVROverlayError.None;
    }

    private static EVROverlayError CreateDefaultOverlay(CVROverlay overlay, string name, ref ulong handle)
    {
        EVROverlayError err = overlay.CreateOverlay(name, name, ref handle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        err = overlay.SetOverlayAlpha(handle, 0.9f);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        err = overlay.SetOverlayWidthInMeters(handle, 1f);
        return err != EVROverlayError.None
            ? err
            : overlay.SetOverlayInputMethod(handle, VROverlayInputMethod.None);
    }

    private EVROverlayError UploadOverlayFrame(CVROverlay overlay, ulong handle, ref bool visible, VRTextureBounds_t bounds)
    {
        GLTextureWriter? writer = _overlayTextureWriter;
        if (writer == null)
        {
            return EVROverlayError.None;
        }

        byte[]? imageData = GetLatestOverlayFrame();
        if (imageData == null)
        {
            return EVROverlayError.None;
        }

        FlipImageVertically(imageData, SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
        writer.WriteImageToBuffer(imageData);
        writer.UpdateTexture();

        Texture_t texture = writer.AsTextureT();
        overlay.SetOverlayTextureBounds(handle, ref bounds);
        EVROverlayError err = OpenVR.Overlay.SetOverlayTexture(handle, ref texture);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        if (!visible)
        {
            err = overlay.ShowOverlay(handle);
            if (err != EVROverlayError.None)
            {
                return err;
            }

            visible = true;
        }

        return EVROverlayError.None;
    }

    private static EVROverlayError HideOverlay(CVROverlay overlay, ulong handle, ref bool visible)
    {
        EVROverlayError err = overlay.HideOverlay(handle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        visible = false;
        return EVROverlayError.None;
    }

    private void OpenSharedFrame()
    {
        _overlayMMF = MemoryMappedFile.CreateFromFile(OVERLAY_SHM_PATH, FileMode.Open, mapName: null, SHARED_FRAME_SIZE + 1);
        _overlayAccessor = _overlayMMF.CreateViewAccessor();
    }

    private static HmdMatrix34_t ToHmdMatrix34(Matrix4x4 m) => new()
    {
        m0 = m.M11,
        m1 = m.M21,
        m2 = m.M31,
        m3 = m.M41,
        m4 = m.M12,
        m5 = m.M22,
        m6 = m.M32,
        m7 = m.M42,
        m8 = m.M13,
        m9 = m.M23,
        m10 = m.M33,
        m11 = m.M43,
    };

    public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => _overlayFunctionQueue;

    public override void ExecuteVrOverlayFunction(string functionName, string json)
    {
        if (!_isOverlayStarted)
        {
            _overlayFunctionQueue.Clear();
            return;
        }

        _overlayFunctionQueue.Enqueue(new KeyValuePair<string, string>(functionName, json));
    }
}
