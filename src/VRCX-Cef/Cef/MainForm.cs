using System.Globalization;
using CefSharp;
using CefSharp.WinForms;
using NLog;
using Timer = System.Windows.Forms.Timer;

namespace VRCX.Cef;

internal sealed partial class MainForm : WinformBase
{
    public static MainForm? Instance;
    public static NativeWindow? MainNativeWindow;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public readonly ChromiumWebBrowser Browser;
    private readonly Icon? _appIcon;
    private readonly Icon? _appIconNoty;
    private readonly Timer _saveTimer;
    private int _lastLocationX;
    private int _lastLocationY;
    private int _lastSizeWidth;
    private int _lastSizeHeight;
    private FormWindowState _lastWindowStateToRestore = FormWindowState.Normal;

    public MainForm()
    {
        Instance = this;
        InitializeComponent();
        MainNativeWindow = NativeWindow.FromHandle(Handle);

        _saveTimer = new Timer
        {
            Interval = 5000,
        };
        _saveTimer.Tick += SaveTimer_Tick;
        try
        {
            string path = Path.GetDirectoryName(Environment.ProcessPath) ?? string.Empty;
            _appIcon = new Icon(Path.Combine(path, "VRCX.ico"));
            _appIconNoty = new Icon(Path.Combine(path, "VRCX_notify.ico"));
            Icon = _appIcon;
            TrayIcon.Icon = _appIcon;
        }
        catch (Exception ex) when (ex is ArgumentException or IOException)
        {
            Logger.Error(CultureInfo.InvariantCulture, ex);
        }

        Browser = CreateBrowser();
        SubscribeBrowserEvents();

        JavascriptBindings.ApplyAppJavascriptBindings(Browser.JavascriptObjectRepository);
        Controls.Add(Browser);
    }

    private static ChromiumWebBrowser CreateBrowser()
    {
        return new ChromiumWebBrowser(Program.LaunchDebug ? "http://localhost:9000/index.html" : "file://vrcx/index.html")
        {
            DragHandler = new CefCustomDragHandler(),
            MenuHandler = new CefCustomMenuHandler(),
            DownloadHandler = new CefCustomDownloadHandler(),
            RequestHandler = new CefCustomRequestHandler(),
            BrowserSettings =
            {
                DefaultEncoding = "UTF-8",
            },
            RenderProcessMessageHandler = PlatformRenderProcessMessageHandler.Instance,
            Dock = DockStyle.Fill,
        };
    }

    private void SubscribeBrowserEvents()
    {
        Browser.IsBrowserInitializedChanged += (_, _) =>
        {
            if (Program.LaunchDebug)
            {
                Browser.ShowDevTools();
            }
        };
        Browser.AddressChanged += (_, addressChangedEventArgs) =>
        {
            Logger.Debug(CultureInfo.InvariantCulture, "Address changed: " + addressChangedEventArgs.Address);
        };
        Browser.LoadingStateChanged += (_, loadingFailedEventArgs) =>
        {
            if (loadingFailedEventArgs.IsLoading)
            {
                Logger.Debug(CultureInfo.InvariantCulture, "Loading page");
            }
            else
            {
                Logger.Debug(CultureInfo.InvariantCulture, "Loaded page: " + loadingFailedEventArgs.Browser.MainFrame.Url);
            }
        };
        Browser.ConsoleMessage += (_, consoleMessageEventArgs) =>
        {
            Logger.Debug(CultureInfo.InvariantCulture, consoleMessageEventArgs.Message + " (" + consoleMessageEventArgs.Source + ":" + consoleMessageEventArgs.Line + ")");
        };
        Browser.GotFocus += (_, _) =>
        {
            if (Browser != null && !Browser.IsLoading && Browser.CanExecuteJavascriptInMainFrame)
            {
                Browser.ExecuteScriptAsync("window?.$pinia?.vrcx?.onBrowserFocus();");
            }
        };
        Deactivate += (_, _) =>
        {
            if (Browser != null && !Browser.IsLoading && Browser.CanExecuteJavascriptInMainFrame)
            {
                Browser.ExecuteScriptAsync("window?.$pinia?.vrcx?.onBrowserBlur();");
            }
        };
    }

    private void MainForm_Load(object sender, EventArgs e)
    {
        _lastLocationX = ReadStoredInt("VRCX_LocationX");
        _lastLocationY = ReadStoredInt("VRCX_LocationY");
        _lastSizeWidth = ReadStoredInt("VRCX_SizeWidth");
        _lastSizeHeight = ReadStoredInt("VRCX_SizeHeight");
        var location = new Point(_lastLocationX, _lastLocationY);
        var size = new Size(_lastSizeWidth, _lastSizeHeight);
        var screen = Screen.FromPoint(location);
        if (screen.Bounds.Contains(location.X, location.Y))
        {
            Location = location;
        }
        Size = new Size(1920, 1080);
        if (size.Width > 0 && size.Height > 0)
        {
            Size = size;
        }

        try
        {
            FormWindowState state = WindowState;
            bool startAsMinimized = string.Equals(VRCXStorage.Instance.Get("VRCX_StartAsMinimizedState"), "true", StringComparison.Ordinal);
            bool closeToTray = string.Equals(VRCXStorage.Instance.Get("VRCX_CloseToTray"), "true", StringComparison.Ordinal);
            if (int.TryParse(VRCXStorage.Instance.Get("VRCX_WindowState"), CultureInfo.InvariantCulture, out int value))
            {
                state = (FormWindowState)value;
            }
            if (state == FormWindowState.Minimized)
            {
                state = FormWindowState.Normal;
            }

            WindowState = state;
            _lastWindowStateToRestore = state;

            if (StartupArgs.LaunchArguments.IsStartup && startAsMinimized)
            {
                if (closeToTray)
                {
                    BeginInvoke(Hide);
                    return;
                }
                state = FormWindowState.Minimized;
                WindowState = state;
            }
        }
        catch (ArgumentException ex)
        {
            Logger.Error(CultureInfo.InvariantCulture, ex);
        }

        Browser.Invalidate();
    }

    private static int ReadStoredInt(string key) =>
        int.TryParse(VRCXStorage.Instance.Get(key), CultureInfo.InvariantCulture, out int value) ? value : 0;

    private void MainForm_Resize(object sender, EventArgs e)
    {
        if (WindowState != FormWindowState.Minimized)
        {
            _lastWindowStateToRestore = WindowState;
        }

        if (WindowState != FormWindowState.Normal)
        {
            return;
        }

        _lastSizeWidth = Size.Width;
        _lastSizeHeight = Size.Height;

        _saveTimer?.Start();
    }

    private void SaveTimer_Tick(object? sender, EventArgs e)
    {
        SaveWindowState();
        _saveTimer?.Stop();
    }

    private void MainForm_Move(object sender, EventArgs e)
    {
        if (WindowState != FormWindowState.Normal)
        {
            return;
        }
        _lastLocationX = Location.X;
        _lastLocationY = Location.Y;

        _saveTimer?.Start();
    }

    private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing &&
            string.Equals("true", VRCXStorage.Instance.Get("VRCX_CloseToTray"), StringComparison.Ordinal))
        {
            e.Cancel = true;
            Hide();
        }
    }

    private void SaveWindowState()
    {
        VRCXStorage.Instance.Set("VRCX_LocationX", _lastLocationX.ToString(CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_LocationY", _lastLocationY.ToString(CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_SizeWidth", _lastSizeWidth.ToString(CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_SizeHeight", _lastSizeHeight.ToString(CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_WindowState", ((int)_lastWindowStateToRestore).ToString(CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Save();
    }

    private void MainForm_FormClosed(object sender, FormClosedEventArgs e) => SaveWindowState();

    private void TrayIcon_MouseClick(object sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left)
        {
            Focus_Window();
        }
    }

    private void TrayMenu_Open_Click(object sender, EventArgs e) => Focus_Window();

    public void Focus_Window()
    {
        Show();
        if (WindowState == FormWindowState.Minimized)
        {
            WindowState = _lastWindowStateToRestore;
        }

        Activate();
    }

    private void TrayMenu_DevTools_Click(object sender, EventArgs e) => Browser.ShowDevTools();

    private void TrayMenu_ForceCrash_Click(object sender, EventArgs e) => Browser.LoadUrl("chrome://crash");

    private void TrayMenu_Quit_Click(object sender, EventArgs e)
    {
        SaveWindowState();
        Application.Exit();
    }

    public void SetTrayIconNotification(bool notify) => TrayIcon.Icon = notify ? _appIconNoty : _appIcon;
}
