using System.Globalization;
using System.Runtime.InteropServices;
using CefSharp;
using NLog;
using Silk.NET.Core.Native;
using Silk.NET.Direct3D11;
using Silk.NET.DXGI;
using Valve.VR;

namespace VRCX.Overlay.Cef;

internal sealed partial class VRCXVRCef : VRCXVRInterface, IDisposable
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
}
