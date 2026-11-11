using System.Collections.Concurrent;
using System.Globalization;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using CefSharp;
using NLog;
using Silk.NET.Core.Native;
using Silk.NET.Direct3D11;
using Silk.NET.DXGI;
using Valve.VR;
using VRCX.OverlayWebSocket;

namespace VRCX.Overlay.Cef;

internal sealed class VRCXVRCef : VRCXVRInterface, IDisposable
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly float[] Rotation = [0f, 0f, 0f];
    private static readonly float[] Translation = [0f, 0f, 0f];
    private static readonly float[] TranslationLeft = [-7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] TranslationRight = [7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] RotationLeft = [90f * (float)(Math.PI / 180f), 90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];
    private static readonly float[] RotationRight = [-90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];

    private const int HMD_HEIGHT = 1024;
    private const int WRIST_SIZE = 512;
    private const int TOTAL_WIDTH = 1024;
    private const int TOTAL_HEIGHT = HMD_HEIGHT + WRIST_SIZE;

    private static OffScreenBrowser? SharedOverlay;

    private readonly List<string[]> _deviceList = [];
    private readonly ReaderWriterLockSlim _deviceListLock = new();
    private readonly bool _isLegacy;
    private Thread? _thread;
    private bool _active;
    private bool _openVrActive;
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

    private DXGI? _dxgi;
    private D3D11? _d3d11;
    private ComPtr<IDXGIFactory2> _factory;
    private ComPtr<IDXGIAdapter> _adapter;
    private ComPtr<ID3D11Device> _device;
    private ComPtr<ID3D11Multithread> _multithread;
    private ComPtr<ID3D11DeviceContext> _deviceContext;
    private ComPtr<ID3D11Texture2D> _sharedTexture;

    public VRCXVRCef(bool isLegacy)
    {
        _isLegacy = isLegacy;
        _thread = new Thread(ThreadLoop)
        {
            IsBackground = true,
        };
    }

    public override void Init() => _thread?.Start();

    public override void Shutdown() => StopThread();

    public override void Restart()
    {
        Shutdown();
        OverlayProgram.VRCXVRInstance = new VRCXVRCef(_isLegacy);
        OverlayProgram.VRCXVRInstance.Init();
    }

    public void Dispose()
    {
        StopThread();
        _dxgi?.Dispose();
        _d3d11?.Dispose();
        _deviceListLock.Dispose();
    }

    private void StopThread()
    {
        Thread? thread = _thread;
        _thread = null;
        thread?.Interrupt();
        thread?.Join();
    }

    private void SetupTextures()
    {
        unsafe
        {
            _dxgi?.Dispose();
            _dxgi = DXGI.GetApi(window: null);
            _d3d11?.Dispose();
            _d3d11 = D3D11.GetApi(window: null);

            _factory.Dispose();
            SilkMarshal.ThrowHResult(_dxgi.CreateDXGIFactory(out _factory));
            _adapter.Dispose();
            SilkMarshal.ThrowHResult(_factory.EnumAdapters((uint)OpenVR.System.GetD3D9AdapterIndex(),
                ref _adapter));

            _device.Dispose();
            _deviceContext.Dispose();

            SilkMarshal.ThrowHResult
            (
                _d3d11.CreateDevice
                (
                    _adapter,
                    D3DDriverType.Unknown,
                    Software: default,
                    (uint)(CreateDeviceFlag.BgraSupport | (Program.LaunchDebug ? CreateDeviceFlag.Debug : CreateDeviceFlag.None)),
                    pFeatureLevels: null,
                    0,
                    D3D11.SdkVersion,
                    ref _device,
                    pFeatureLevel: null,
                    ref _deviceContext
                )
            );

            CreateSharedTexture();

            SharedOverlay?.UpdateRender(_device, _deviceContext, _sharedTexture);

            _multithread = _device.QueryInterface<ID3D11Multithread>();
            _multithread.SetMultithreadProtected(bMTProtect: true);

            if (Program.LaunchDebug)
            {
                _ = _device.SetInfoQueueCallback(msg => Logger.Info(CultureInfo.InvariantCulture, SilkMarshal.PtrToString((nint)msg.PDescription) ?? string.Empty));
            }
        }
    }

    private void CreateSharedTexture()
    {
        unsafe
        {
            if ((IntPtr)_sharedTexture.Handle != IntPtr.Zero)
            {
                _sharedTexture.Dispose();
            }
        }

        var textureDescription = new Texture2DDesc
        {
            Width = TOTAL_WIDTH,
            Height = TOTAL_HEIGHT,
            MipLevels = 1,
            ArraySize = 1,
            Format = Format.FormatB8G8R8A8Unorm,
            SampleDesc = new SampleDesc
            {
                Count = 1,
                Quality = 0,
            },
            BindFlags = (uint)BindFlag.ShaderResource,
            CPUAccessFlags = _isLegacy ? (uint)CpuAccessFlag.Write : (uint)CpuAccessFlag.None,
            Usage = _isLegacy ? Usage.Dynamic : Usage.Default,
        };
        unsafe
        {
            SilkMarshal.ThrowHResult(_device.CreateTexture2D(in textureDescription, pInitialData: null, ref _sharedTexture));
        }
    }

    private void ThreadLoop()
    {
        _nextOverlayUpdate = DateTime.MinValue;
        var browser = new OffScreenBrowser(
            Program.LaunchDebug ? "http://localhost:9000/vr.html" : "file://vrcx/vr.html",
            TOTAL_WIDTH,
            TOTAL_HEIGHT,
            _isLegacy
        );
        SharedOverlay = browser;

        while (_thread != null)
        {
            if (_isLegacy && (_wristOverlayActive || _hmdOverlayActive))
            {
                browser.RenderToTexture(_deviceContext, _sharedTexture);
            }

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

        ReleaseDeviceResources();
    }

    private static void SleepBetweenFrames()
    {
        try
        {
            Thread.Sleep(32);
        }
        catch (ThreadInterruptedException)
        {
            Logger.Debug(CultureInfo.InvariantCulture, "VR overlay thread interrupted");
        }
    }

    private void ReleaseDeviceResources()
    {
        _device.Dispose();
        _adapter.Dispose();
        _factory.Dispose();

        SharedOverlay?.Dispose();
        SharedOverlay = null;
        _sharedTexture.Dispose();
        _sharedTexture = default;
        _deviceContext.Dispose();
        _multithread.Dispose();
        _dxgi?.Dispose();
        _d3d11?.Dispose();
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
    }

    public override bool IsActive() => _active;

    public override void Refresh() => SharedOverlay?.Reload();

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

        ulong proximity = state.ulButtonPressed & (1UL << (int)EVRButtonId.k_EButton_ProximitySensor);
        bool isHmdAfk = proximity == 0;
        if (isHmdAfk != IsHmdAfk)
        {
            IsHmdAfk = isHmdAfk;
            var message = new OverlayMessage
            {
                Type = OverlayMessageType.IsHmdAfk,
                Data = IsHmdAfk.ToString(),
            };
            OverlayClient.SendMessage(message);
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

                _wristOverlayVisible = false;
                err = CreateDefaultOverlay(overlay, "VRCX1", ref _wristOverlayHandle);
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
                vMax = (float)WRIST_SIZE / TOTAL_HEIGHT,
            };
            return ShowSharedTexture(overlay, _wristOverlayHandle, ref _wristOverlayVisible, bounds);
        }

        return _wristOverlayVisible ? HideOverlay(overlay, _wristOverlayHandle, ref _wristOverlayVisible) : EVROverlayError.None;
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

                _hmdOverlayVisible = false;
                err = CreateDefaultOverlay(overlay, "VRCX2", ref _hmdOverlayHandle);
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
            }
        }

        if (!dashboardVisible)
        {
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 1f,
                vMin = (float)(TOTAL_HEIGHT - HMD_HEIGHT) / TOTAL_HEIGHT,
                vMax = 1f,
            };
            return ShowSharedTexture(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible, bounds);
        }

        return _hmdOverlayVisible ? HideOverlay(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible) : EVROverlayError.None;
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

    private EVROverlayError ShowSharedTexture(CVROverlay overlay, ulong handle, ref bool visible, VRTextureBounds_t bounds)
    {
        EVROverlayError err;
        unsafe
        {
            var texture = new Texture_t
            {
                handle = (IntPtr)_sharedTexture.Handle,
            };
            err = overlay.SetOverlayTexture(handle, ref texture);
        }

        overlay.SetOverlayTextureBounds(handle, ref bounds);

        if (!visible)
        {
            err = overlay.ShowOverlay(handle);
            visible = true;
        }

        return err;
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

    public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => throw new NotSupportedException("GetExecuteVrOverlayFunctionQueue is not implemented in VRCXVRCef.");

    public override void ExecuteVrOverlayFunction(string functionName, string json)
    {
        OffScreenBrowser? overlay = SharedOverlay;
        if (overlay == null || overlay.IsLoading || !overlay.CanExecuteJavascriptInMainFrame)
        {
            return;
        }

        overlay.ExecuteScriptAsync($"$vr.{functionName}", json);
    }
}
