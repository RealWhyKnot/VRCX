using Timer = System.Windows.Forms.Timer;
using CefSharp;
using CefSharp.WinForms;
using NLog;

namespace VRCX;

internal sealed partial class MainForm : WinformBase
{
    public static MainForm? Instance;
    public static NativeWindow? nativeWindow;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public ChromiumWebBrowser Browser;
    private readonly Icon _appIcon;
    private readonly Icon _appIconNoty;
    private readonly Timer _saveTimer;
    private int LastLocationX;
    private int LastLocationY;
    private int LastSizeWidth;
    private int LastSizeHeight;
    private FormWindowState LastWindowStateToRestore = FormWindowState.Normal;

    public MainForm()
    {
        Instance = this;
        InitializeComponent();
        nativeWindow = NativeWindow.FromHandle(Handle);


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
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, ex);
        }

        Browser = new ChromiumWebBrowser(Program.LaunchDebug ? "http://localhost:9000/index.html" : "file://vrcx/index.html")
        {
            DragHandler = new CustomDragHandler(),
            MenuHandler = new CustomMenuHandler(),
            DownloadHandler = new CustomDownloadHandler(),
            RequestHandler = new CustomRequestHandler(),
            BrowserSettings =
            {
                DefaultEncoding = "UTF-8",
            },
            RenderProcessMessageHandler = PlatformRenderProcessMessageHandler.Instance,
            Dock = DockStyle.Fill,
        };
        Browser.IsBrowserInitializedChanged += (_, _) =>
        {
            if (Program.LaunchDebug)
            {
                Browser.ShowDevTools();
            }
        };
        Browser.AddressChanged += (_, addressChangedEventArgs) =>
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Address changed: " + addressChangedEventArgs.Address);
        };
        Browser.LoadingStateChanged += (_, loadingFailedEventArgs) =>
        {
            if (loadingFailedEventArgs.IsLoading)
            {
                Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Loading page");
            }
            else
            {
                Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Loaded page: " + loadingFailedEventArgs.Browser.MainFrame.Url);
            }
        };
        Browser.ConsoleMessage += (_, consoleMessageEventArgs) =>
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, consoleMessageEventArgs.Message + " (" + consoleMessageEventArgs.Source + ":" + consoleMessageEventArgs.Line + ")");
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

        JavascriptBindings.ApplyAppJavascriptBindings(Browser.JavascriptObjectRepository);
        Controls.Add(Browser);
    }

    private void MainForm_Load(object sender, EventArgs e)
    {
        try
        {
            int.TryParse(VRCXStorage.Instance.Get("VRCX_LocationX"), System.Globalization.CultureInfo.InvariantCulture, out LastLocationX);
            int.TryParse(VRCXStorage.Instance.Get("VRCX_LocationY"), System.Globalization.CultureInfo.InvariantCulture, out LastLocationY);
            int.TryParse(VRCXStorage.Instance.Get("VRCX_SizeWidth"), System.Globalization.CultureInfo.InvariantCulture, out LastSizeWidth);
            int.TryParse(VRCXStorage.Instance.Get("VRCX_SizeHeight"), System.Globalization.CultureInfo.InvariantCulture, out LastSizeHeight);
            var location = new Point(LastLocationX, LastLocationY);
            var size = new Size(LastSizeWidth, LastSizeHeight);
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
        }
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, ex);
        }

        try
        {
            FormWindowState state = WindowState;
            bool startAsMinimized = string.Equals(VRCXStorage.Instance.Get("VRCX_StartAsMinimizedState"), "true", StringComparison.Ordinal);
            bool closeToTray = string.Equals(VRCXStorage.Instance.Get("VRCX_CloseToTray"), "true", StringComparison.Ordinal);
            if (int.TryParse(VRCXStorage.Instance.Get("VRCX_WindowState"), System.Globalization.CultureInfo.InvariantCulture, out int value))
            {
                state = (FormWindowState)value;
            }
            if (state == FormWindowState.Minimized)
            {
                state = FormWindowState.Normal;
            }

            WindowState = state;
            LastWindowStateToRestore = state;

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
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, ex);
        }

        Browser.Invalidate();
    }

    private void MainForm_Resize(object sender, EventArgs e)
    {
        if (WindowState != FormWindowState.Minimized)
        {
            LastWindowStateToRestore = WindowState;
        }

        if (WindowState != FormWindowState.Normal)
        {
            return;
        }

        LastSizeWidth = Size.Width;
        LastSizeHeight = Size.Height;

        _saveTimer?.Start();
    }

    private void SaveTimer_Tick(object sender, EventArgs e)
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
        LastLocationX = Location.X;
        LastLocationY = Location.Y;

        _saveTimer?.Start();
    }

    private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing &&
            "true".Equals(VRCXStorage.Instance.Get("VRCX_CloseToTray")))
        {
            e.Cancel = true;
            Hide();
        }
    }

    private void SaveWindowState()
    {
        VRCXStorage.Instance.Set("VRCX_LocationX", LastLocationX.ToString(System.Globalization.CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_LocationY", LastLocationY.ToString(System.Globalization.CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_SizeWidth", LastSizeWidth.ToString(System.Globalization.CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_SizeHeight", LastSizeHeight.ToString(System.Globalization.CultureInfo.InvariantCulture));
        VRCXStorage.Instance.Set("VRCX_WindowState", ((int)LastWindowStateToRestore).ToString(System.Globalization.CultureInfo.InvariantCulture));
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
            WindowState = LastWindowStateToRestore;
        }

        Activate();
    }

    private void TrayMenu_DevTools_Click(object sender, EventArgs e) => Instance.Browser.ShowDevTools();

    private void TrayMenu_ForceCrash_Click(object sender, EventArgs e) => Instance.Browser.LoadUrl("chrome://crash");

    private void TrayMenu_Quit_Click(object sender, EventArgs e)
    {
        SaveWindowState();
        Application.Exit();
    }

    public void SetTrayIconNotification(bool notify) => TrayIcon.Icon = notify ? _appIconNoty : _appIcon;
}
