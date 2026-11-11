using System.Collections.Concurrent;
using System.Globalization;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using NLog;
using Valve.VR;

namespace VRCX.Overlay.Electron;

internal sealed partial class VRCXVRElectron : VRCXVRInterface, IDisposable
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
}
