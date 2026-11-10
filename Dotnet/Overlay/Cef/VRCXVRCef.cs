using System.Collections.Concurrent;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using CefSharp;
using NLog;
using Silk.NET.Core.Native;
using Silk.NET.Direct3D11;
using Silk.NET.DXGI;
using Valve.VR;
using VRCX.Overlay;

namespace VRCX;

internal sealed class VRCXVRCef : VRCXVRInterface
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly float[] _rotation = [0f, 0f, 0f];
    private static readonly float[] _translation = [0f, 0f, 0f];
    private static readonly float[] _translationLeft = [-7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] _translationRight = [7f / 100f, -5f / 100f, 6f / 100f];
    private static readonly float[] _rotationLeft = [90f * (float)(Math.PI / 180f), 90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];
    private static readonly float[] _rotationRight = [-90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f)];

    private static OffScreenBrowser? _sharedOverlay;
    private readonly List<string[]> _deviceList;
    private readonly ReaderWriterLockSlim _deviceListLock;
    private readonly bool _isLegacy;
    private bool _active;
    private bool _menuButton;
    private int _overlayHand;
    private Thread _thread;
    private DateTime _nextOverlayUpdate;

    private ulong _hmdOverlayHandle;
    private bool _hmdOverlayActive;
    private bool _hmdOverlayWasActive;

    private ulong _wristOverlayHandle;
    private bool _wristOverlayActive;
    private bool _wristOverlayWasActive;

    private const int HMD_HEIGHT = 1024;
    private const int WRIST_SIZE = 512;
    private const int TOTAL_WIDTH = 1024;
    private const int TOTAL_HEIGHT = HMD_HEIGHT + WRIST_SIZE;

    private DXGI _dxgi;
    private D3D11 _d3d11;
    private ComPtr<IDXGIFactory2> _factory;
    private ComPtr<IDXGIAdapter> _adapter;
    private ComPtr<ID3D11Device> _device;
    private ComPtr<ID3D11Multithread> _multithread;
    private ComPtr<ID3D11DeviceContext> _deviceContext;

    private ComPtr<ID3D11Texture2D> _sharedTexture;

    public VRCXVRCef(bool isLegacy)
    {
        _isLegacy = isLegacy;
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
    }

    public override void Restart()
    {
        Exit();
        OverlayProgram.VRCXVRInstance = new VRCXVRCef(_isLegacy);
        OverlayProgram.VRCXVRInstance.Init();
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

            if ((IntPtr)_sharedTexture.Handle != IntPtr.Zero)
            {
                _sharedTexture.Dispose();
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
            SilkMarshal.ThrowHResult(_device.CreateTexture2D(in textureDescription, pInitialData: null, ref _sharedTexture));


            _sharedOverlay?.UpdateRender(_device, _deviceContext, _sharedTexture);

            _multithread = _device.QueryInterface<ID3D11Multithread>();
            _multithread.SetMultithreadProtected(bMTProtect: true);

            if (Program.LaunchDebug)
            {
                _device.SetInfoQueueCallback(msg => Logger.Info(System.Globalization.CultureInfo.InvariantCulture, SilkMarshal.PtrToString((nint)msg.PDescription)!));
            }
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
        _sharedOverlay = new OffScreenBrowser(
            Program.LaunchDebug ? "http://localhost:9000/vr.html" : "file://vrcx/vr.html",
            TOTAL_WIDTH,
            TOTAL_HEIGHT,
            _isLegacy
        );

        while (_thread != null)
        {
            if (_isLegacy && (_wristOverlayActive || _hmdOverlayActive))
            {
                _sharedOverlay.RenderToTexture(_deviceContext, _sharedTexture);
            }

            try
            {
                Thread.Sleep(32);
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
                }

                while (system.PollNextEvent(ref e, (uint)Marshal.SizeOf(e)))
                {
                    var type = (EVREventType)e.eventType;
                    if (type == EVREventType.VREvent_Quit)
                    {
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

        _device.Dispose();
        _adapter.Dispose();
        _factory.Dispose();

        _sharedOverlay?.Dispose();
        _sharedOverlay = null;
        _sharedTexture.Dispose();
        _sharedTexture = default;
        _deviceContext.Dispose();
        _multithread.Dispose();
        _dxgi?.Dispose();
        _d3d11?.Dispose();
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

    public override void Refresh() => _sharedOverlay.Reload();

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

                    ulong prox = state.ulButtonPressed & (1UL << ((int)EVRButtonId.k_EButton_ProximitySensor));
                    bool isHmdAfk = prox == 0;
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

                err = overlay.SetOverlayFlag(dashboardHandle, VROverlayFlags.NoDashboardTab, bEnabled: true);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        _ = new VREvent_t();

        if (dashboardVisible)
        {
            unsafe
            {
                var texture = new Texture_t
                {
                    handle = (IntPtr)_sharedTexture.Handle,
                };
                var bounds = new VRTextureBounds_t
                {
                    uMin = 0f,
                    uMax = 1f,
                    vMin = (float)(TOTAL_HEIGHT - HMD_HEIGHT) / TOTAL_HEIGHT,
                    vMax = 1f,
                };
                overlay.SetOverlayTextureBounds(dashboardHandle, ref bounds);
                err = overlay.SetOverlayTexture(dashboardHandle, ref texture);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
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

        if (!dashboardVisible && DateTime.UtcNow.CompareTo(_nextOverlayUpdate) <= 0)
        {
            unsafe
            {
                var texture = new Texture_t
                {
                    handle = (IntPtr)_sharedTexture.Handle,
                };
                err = overlay.SetOverlayTexture(overlayHandle, ref texture);
            }

            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 0.5f,
                vMin = 0f,
                vMax = (float)WRIST_SIZE / TOTAL_HEIGHT,
            };
            overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);

            if (!overlayVisible)
            {
                err = overlay.ShowOverlay(overlayHandle);
                overlayVisible = true;
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
            }
        }

        if (!dashboardVisible)
        {
            unsafe
            {
                var texture = new Texture_t
                {
                    handle = (IntPtr)_sharedTexture.Handle,
                };
                err = overlay.SetOverlayTexture(overlayHandle, ref texture);
            }

            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 1f,
                vMin = (float)(TOTAL_HEIGHT - HMD_HEIGHT) / TOTAL_HEIGHT,
                vMax = 1f,
            };
            overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);

            if (!overlayVisible)
            {
                err = overlay.ShowOverlay(overlayHandle);
                overlayVisible = true;
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

    public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => throw new NotImplementedException();

    public override void ExecuteVrOverlayFunction(string function, string json)
    {
        if (_sharedOverlay == null || _sharedOverlay.IsLoading || !_sharedOverlay.CanExecuteJavascriptInMainFrame)
        {
            return;
        }

        _sharedOverlay.ExecuteScriptAsync($"$vr.{function}", json);
    }
}
