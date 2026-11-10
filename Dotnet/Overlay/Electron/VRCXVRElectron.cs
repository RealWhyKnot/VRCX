using System.Collections.Concurrent;
using System.IO.MemoryMappedFiles;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using NLog;
using Valve.VR;

namespace VRCX;

public sealed class VRCXVRElectron : VRCXVRInterface
{
    public static VRCXVRInterface Instance;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly float[] _rotation = [0f, 0f, 0f];
    private static readonly float[] _translation = [0f, 0f, 0f];
    private static readonly float[] _translationLeft = [-7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] _translationRight = [7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] _rotationLeft = [90f * (float)(Math.PI / 180f), 90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];
    private static readonly float[] _rotationRight = [-90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];
    private readonly List<string[]> _deviceList;
    private readonly ReaderWriterLockSlim _deviceListLock;
    private bool _active;
    private bool _isOverlayStarted;
    private bool _menuButton;
    private int _overlayHand;
    private GLTextureWriter _overlayTextureWriter;
    private Thread? _thread;
    private DateTime _nextOverlayUpdate;

    private ulong _hmdOverlayHandle;
    private bool _hmdOverlayActive;
    private bool _hmdOverlayWasActive;

    private ulong _wristOverlayHandle;
    private bool _wristOverlayActive;
    private bool _wristOverlayWasActive;

    private const string OVERLAY_SHM_PATH = "/dev/shm/vrcx_overlay";
    private const int WRIST_FRAME_HEIGHT = 512;
    private const int HMD_FRAME_HEIGHT = 1024;
    private const int SHARED_FRAME_SIZE = SHARED_FRAME_WIDTH * SHARED_FRAME_HEIGHT * 4;
    private const int SHARED_FRAME_WIDTH = 1024;
    private const int SHARED_FRAME_HEIGHT = WRIST_FRAME_HEIGHT + HMD_FRAME_HEIGHT;
    private readonly byte[] frameBuffer = new byte[SHARED_FRAME_SIZE];

    private MemoryMappedFile? _overlayMMF;
    private MemoryMappedViewAccessor? _overlayAccessor;
    private readonly ConcurrentQueue<KeyValuePair<string, string>> _overlayFunctionQueue = new();

    static VRCXVRElectron()
    {
        Instance = new VRCXVRElectron();
    }

    public VRCXVRElectron()
    {
        _deviceListLock = new ReaderWriterLockSlim();
        _deviceList = [];
        _thread = new Thread(ThreadLoop)
        {
            IsBackground = true,
        };
    }



    public override void Init() => _thread.Start();

    public override void Exit()
    {
        Thread? thread = _thread;
        _thread = null;
        thread?.Interrupt();
        thread?.Join();

        _overlayAccessor?.Dispose();
        _overlayAccessor = null;
        _overlayMMF?.Dispose();
        _overlayMMF = null;

        GLContextX11.Cleanup();
        GLContextWayland.Cleanup();
    }

    public override void Restart()
    {
        Exit();
        Instance = new VRCXVRElectron();
        Instance.Init();
        Program.VRCXVRInstance = Instance;

    }

    private void SetupTextures()
    {
        bool contextInitialised = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY")) ||
string.Equals(Environment.GetEnvironmentVariable("XDG_SESSION_TYPE")?.ToLowerInvariant(), "wayland"
, StringComparison.Ordinal) ? GLContextWayland.Initialise()
            : GLContextX11.Initialise();



        if (!contextInitialised)
        {
            contextInitialised = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY")) ?
                GLContextX11.Initialise() : GLContextWayland.Initialise();
        }

        if (!contextInitialised)
        {
            throw new Exception("Failed to initialise OpenGL context");
        }

        _overlayTextureWriter = new GLTextureWriter(SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
        _overlayTextureWriter.UpdateTexture();
    }

    public byte[] GetLatestOverlayFrame()
    {
        if (_overlayAccessor == null)
        {
            return null;
        }

        byte ready = _overlayAccessor.ReadByte(0);
        if (ready == 1)
        {
            _overlayAccessor.ReadArray(1, frameBuffer, 0, SHARED_FRAME_SIZE);
            _overlayAccessor.Write(0, (byte)0);
            return frameBuffer;
        }
        return null;
    }

    private static void FlipImageVertically(ref byte[] imageData, int width, int height)
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
        bool active = false;
        var e = new VREvent_t();
        DateTime nextInit = DateTime.MinValue;
        DateTime nextDeviceUpdate = DateTime.MinValue;
        _nextOverlayUpdate = DateTime.MinValue;
        uint overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
        bool overlayVisible1 = false;
        bool overlayVisible2 = false;
        while (_thread != null)
        {
            try
            {
                if (_active)
                {
                    Thread.Sleep(1);
                }
                else
                {
                    Thread.Sleep(32);
                }
            }
            catch (ThreadInterruptedException)
            {
            }

            if (_active)
            {
                CVRSystem? system = OpenVR.System;
                if (system == null)
                {
                    if (DateTime.UtcNow.CompareTo(nextInit) <= 0)
                    {
                        continue;
                    }

                    EVRInitError _err = EVRInitError.None;
                    system = OpenVR.Init(ref _err, EVRApplicationType.VRApplication_Background);
                    nextInit = DateTime.UtcNow.AddSeconds(5);
                    if (system == null)
                    {
                        continue;
                    }

                    active = true;
                    SetupTextures();
                    _isOverlayStarted = true;
                }

                while (system.PollNextEvent(ref e, (uint)Marshal.SizeOf(e)))
                {
                    var type = (EVREventType)e.eventType;
                    if (type == EVREventType.VREvent_Quit)
                    {
                        _isOverlayStarted = false;
                        active = false;
                        IsHmdAfk = false;
                        OpenVR.Shutdown();
                        nextInit = DateTime.UtcNow.AddSeconds(10);
                        system = null;

                        _wristOverlayHandle = 0;
                        _hmdOverlayHandle = 0;
                        break;
                    }
                }

                if (system != null)
                {
                    if (DateTime.UtcNow.CompareTo(nextDeviceUpdate) >= 0)
                    {
                        overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
                        UpdateDevices(system, ref overlayIndex);
                        if (overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
                        {
                            _nextOverlayUpdate = DateTime.UtcNow.AddSeconds(10);
                        }

                        nextDeviceUpdate = DateTime.UtcNow.AddSeconds(0.1);
                    }

                    CVROverlay overlay = OpenVR.Overlay;
                    if (overlay != null)
                    {
                        bool dashboardVisible = overlay.IsDashboardVisible();









                        if (_wristOverlayActive)
                        {
                            EVROverlayError err = ProcessOverlay1(overlay, ref _wristOverlayHandle, ref overlayVisible1,
                                dashboardVisible, overlayIndex);
                            if (err != EVROverlayError.None &&
                                _wristOverlayHandle != 0)
                            {
                                overlay.DestroyOverlay(_wristOverlayHandle);
                                _wristOverlayHandle = 0;
                                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, err);
                            }
                        }

                        if (_hmdOverlayActive)
                        {
                            EVROverlayError err = ProcessOverlay2(overlay, ref _hmdOverlayHandle, ref overlayVisible2,
                                dashboardVisible);
                            if (err != EVROverlayError.None &&
                                _hmdOverlayHandle != 0)
                            {
                                overlay.DestroyOverlay(_hmdOverlayHandle);
                                _hmdOverlayHandle = 0;
                                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, err);
                            }
                        }
                    }
                }
            }
            else if (active)
            {
                active = false;
                _isOverlayStarted = false;
                IsHmdAfk = false;
                OpenVR.Shutdown();
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
        }

        _overlayAccessor?.Dispose();
        _overlayAccessor = null;
        _overlayMMF?.Dispose();
        _overlayMMF = null;

        GLContextX11.Cleanup();
        GLContextWayland.Cleanup();
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
            _overlayAccessor?.Dispose();
            _overlayAccessor = null;
            _overlayMMF?.Dispose();
            _overlayMMF = null;
            GLContextX11.Cleanup();
            GLContextWayland.Cleanup();
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

    private void UpdateDevices(CVRSystem system, ref uint overlayIndex)
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
                    bool success = system.GetControllerState(i, ref state, (uint)Marshal.SizeOf(state));
                    if (!success)
                    {
                        break;
                    }




                    ETrackedPropertyError headsetErr = ETrackedPropertyError.TrackedProp_Success;
                    float headsetBatteryPercentage = system.GetFloatTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref headsetErr);
                    if (headsetErr != ETrackedPropertyError.TrackedProp_Success)
                    {

                        break;
                    }

                    string[] headset =
                    [
                        "headset",
                        system.IsTrackedDeviceConnected(i)
                            ? "connected"
                            : "disconnected",

                        "discharging",
                        (headsetBatteryPercentage * 100).ToString(System.Globalization.CultureInfo.InvariantCulture),
                        poses[i].eTrackingResult.ToString(),
                    ];
                    _deviceListLock.EnterWriteLock();
                    try
                    {
                        _deviceList.Add(headset);
                    }
                    finally
                    {
                        _deviceListLock.ExitWriteLock();
                    }

                    break;
                case ETrackedDeviceClass.Controller:
                case ETrackedDeviceClass.GenericTracker:
                case ETrackedDeviceClass.TrackingReference:
                    {
                        ETrackedPropertyError err = ETrackedPropertyError.TrackedProp_Success;
                        float batteryPercentage = system.GetFloatTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
                        if (err != ETrackedPropertyError.TrackedProp_Success)
                        {
                            batteryPercentage = 1f;
                        }

                        err = ETrackedPropertyError.TrackedProp_Success;
                        bool isCharging = system.GetBoolTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceIsCharging_Bool, ref err);
                        if (err != ETrackedPropertyError.TrackedProp_Success)
                        {
                            isCharging = false;
                        }

                        sb.Clear();
                        system.GetStringTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_TrackingSystemName_String, sb, (uint)sb.Capacity, ref err);
                        bool isOculus = sb.ToString().IndexOf("oculus", StringComparison.OrdinalIgnoreCase) >= 0;




                        ETrackedControllerRole role = system.GetControllerRoleForTrackedDeviceIndex(i);
                        if (role is ETrackedControllerRole.LeftHand or ETrackedControllerRole.RightHand)
                        {
                            if (_overlayHand == 0 ||
                                (_overlayHand == 1 && role == ETrackedControllerRole.LeftHand) ||
                                (_overlayHand == 2 && role == ETrackedControllerRole.RightHand))
                            {
                                if (system.GetControllerState(i, ref state, (uint)Marshal.SizeOf(state)) &&
                                    (state.ulButtonPressed & (_menuButton ? 2u : isOculus ? 128u : 4u)) != 0)
                                {
                                    _nextOverlayUpdate = DateTime.MinValue;
                                    if (role == ETrackedControllerRole.LeftHand)
                                    {
                                        Array.Copy(_translationLeft, _translation, 3);
                                        Array.Copy(_rotationLeft, _rotation, 3);
                                    }
                                    else
                                    {
                                        Array.Copy(_translationRight, _translation, 3);
                                        Array.Copy(_rotationRight, _rotation, 3);
                                    }

                                    overlayIndex = i;
                                }
                            }
                        }

                        string type = string.Empty;
                        if (devClass == ETrackedDeviceClass.Controller)
                        {
                            type = role == ETrackedControllerRole.LeftHand
                                ? "leftController"
                                : role == ETrackedControllerRole.RightHand ? "rightController" : "controller";
                        }
                        else if (devClass == ETrackedDeviceClass.GenericTracker)
                        {
                            type = "tracker";
                        }
                        else if (devClass == ETrackedDeviceClass.TrackingReference)
                        {
                            type = "base";
                        }

                        string[] item =
                        [
                        type,
                        system.IsTrackedDeviceConnected(i)
                            ? "connected"
                            : "disconnected",
                        isCharging
                            ? "charging"
                            : "discharging",
                        (batteryPercentage * 100).ToString(System.Globalization.CultureInfo.InvariantCulture),
                        poses[i].eTrackingResult.ToString(),
                    ];
                        _deviceListLock.EnterWriteLock();
                        try
                        {
                            _deviceList.Add(item);
                        }
                        finally
                        {
                            _deviceListLock.ExitWriteLock();
                        }

                        break;
                    }

                case ETrackedDeviceClass.Invalid:
                    break;
                case ETrackedDeviceClass.DisplayRedirect:
                    break;
                case ETrackedDeviceClass.Max:
                    break;
                default:
                    break;
            }
        }
    }

    internal EVROverlayError ProcessDashboard(CVROverlay overlay, ref ulong dashboardHandle, bool dashboardVisible)
    {
        EVROverlayError err = EVROverlayError.None;

        if (dashboardHandle == 0)
        {
            err = overlay.FindOverlay("VRCX", ref dashboardHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                ulong thumbnailHandle = 0;
                err = overlay.CreateDashboardOverlay("VRCX", "VRCX", ref dashboardHandle, ref thumbnailHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                string iconPath = Path.Join(Program.BaseDirectory, "VRCX.png");
                err = overlay.SetOverlayFromFile(thumbnailHandle, iconPath);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayWidthInMeters(dashboardHandle, 1.5f);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayInputMethod(dashboardHandle, VROverlayInputMethod.Mouse);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        if (dashboardVisible)
        {









        }

        return err;
    }

    internal EVROverlayError ProcessOverlay1(CVROverlay overlay, ref ulong overlayHandle, ref bool overlayVisible, bool dashboardVisible, uint overlayIndex)
    {
        EVROverlayError err = EVROverlayError.None;

        if (overlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX1", ref overlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                overlayVisible = false;
                err = overlay.CreateOverlay("VRCX1", "VRCX1", ref overlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayAlpha(overlayHandle, 0.9f);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayWidthInMeters(overlayHandle, 1f);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayInputMethod(overlayHandle, VROverlayInputMethod.None);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                _overlayMMF = MemoryMappedFile.CreateFromFile(OVERLAY_SHM_PATH, FileMode.Open, mapName: null, SHARED_FRAME_SIZE + 1);
                _overlayAccessor = _overlayMMF.CreateViewAccessor();
            }
        }

        if (overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
        {


            var m = Matrix4x4.CreateScale(0.25f);
            m *= Matrix4x4.CreateRotationX(_rotation[0]);
            m *= Matrix4x4.CreateRotationY(_rotation[1]);
            m *= Matrix4x4.CreateRotationZ(_rotation[2]);
            m *= Matrix4x4.CreateTranslation(new Vector3(_translation[0], _translation[1], _translation[2]));
            var hm34 = new HmdMatrix34_t
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
            err = overlay.SetOverlayTransformTrackedDeviceRelative(overlayHandle, overlayIndex, ref hm34);
            if (err != EVROverlayError.None)
            {
                return err;
            }
        }

        if (!dashboardVisible &&
            DateTime.UtcNow.CompareTo(_nextOverlayUpdate) <= 0)
        {
            if (_overlayTextureWriter != null)
            {
                byte[] imageData = GetLatestOverlayFrame();
                if (imageData != null)
                {
                    FlipImageVertically(ref imageData, SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
                    _overlayTextureWriter.WriteImageToBuffer(imageData);
                    _overlayTextureWriter.UpdateTexture();

                    Texture_t texture = _overlayTextureWriter.AsTextureT();
                    var bounds = new VRTextureBounds_t
                    {
                        uMin = 0f,
                        uMax = 0.5f,
                        vMin = 0f,
                        vMax = (float)WRIST_FRAME_HEIGHT / SHARED_FRAME_HEIGHT,
                    };
                    overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);
                    err = OpenVR.Overlay.SetOverlayTexture(overlayHandle, ref texture);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    if (!overlayVisible)
                    {
                        err = overlay.ShowOverlay(overlayHandle);
                        if (err != EVROverlayError.None)
                        {
                            return err;
                        }

                        overlayVisible = true;
                    }
                }
            }
        }
        else if (overlayVisible)
        {
            err = overlay.HideOverlay(overlayHandle);
            if (err != EVROverlayError.None)
            {
                return err;
            }

            overlayVisible = false;
        }

        return err;
    }

    internal EVROverlayError ProcessOverlay2(CVROverlay overlay, ref ulong overlayHandle, ref bool overlayVisible, bool dashboardVisible)
    {
        EVROverlayError err = EVROverlayError.None;

        if (overlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX2", ref overlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                overlayVisible = false;
                err = overlay.CreateOverlay("VRCX2", "VRCX2", ref overlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayAlpha(overlayHandle, 0.9f);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayWidthInMeters(overlayHandle, 1f);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                err = overlay.SetOverlayInputMethod(overlayHandle, VROverlayInputMethod.None);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                var m = Matrix4x4.CreateScale(1f);
                m *= Matrix4x4.CreateTranslation(0, -0.3f, -1.5f);
                var hm34 = new HmdMatrix34_t
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
                err = overlay.SetOverlayTransformTrackedDeviceRelative(overlayHandle, OpenVR.k_unTrackedDeviceIndex_Hmd, ref hm34);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                _overlayMMF = MemoryMappedFile.CreateFromFile(OVERLAY_SHM_PATH, FileMode.Open, mapName: null, SHARED_FRAME_SIZE + 1);
                _overlayAccessor = _overlayMMF.CreateViewAccessor();
            }
        }

        if (!dashboardVisible)
        {
            if (_overlayTextureWriter != null)
            {
                byte[] imageData = GetLatestOverlayFrame();
                if (imageData != null)
                {
                    FlipImageVertically(ref imageData, SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
                    _overlayTextureWriter.WriteImageToBuffer(imageData);
                    _overlayTextureWriter.UpdateTexture();

                    Texture_t texture = _overlayTextureWriter.AsTextureT();
                    var bounds = new VRTextureBounds_t
                    {
                        uMin = 0f,
                        uMax = 1f,
                        vMin = (float)(SHARED_FRAME_HEIGHT - HMD_FRAME_HEIGHT) / SHARED_FRAME_HEIGHT,
                        vMax = 1f,
                    };
                    overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);
                    err = OpenVR.Overlay.SetOverlayTexture(overlayHandle, ref texture);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    if (!overlayVisible)
                    {
                        err = overlay.ShowOverlay(overlayHandle);
                        if (err != EVROverlayError.None)
                        {
                            return err;
                        }

                        overlayVisible = true;
                    }
                }
            }
        }
        else if (overlayVisible)
        {
            err = overlay.HideOverlay(overlayHandle);
            if (err != EVROverlayError.None)
            {
                return err;
            }

            overlayVisible = false;
        }

        return err;
    }

    public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => _overlayFunctionQueue;

    public override void ExecuteVrOverlayFunction(string function, string json)
    {
        if (!_isOverlayStarted)
        {
            _overlayFunctionQueue.Clear();
            return;
        }

        _overlayFunctionQueue.Enqueue(new KeyValuePair<string, string>(function, json));
    }
}
