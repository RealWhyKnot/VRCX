using System.Globalization;
using System.Text.Json;
#if !LINUX
using System.Data.SQLite;
#endif
using NLog;
using NLog.Targets;
#if !LINUX
using VRCX.Cef;
using VRCX.IPC;
using VRCX.Overlay.Cef;
using VRCX.OverlayWebSocket;
#else
using VRCX.Overlay;
using VRCX.Overlay.Electron;
#endif

namespace VRCX;

internal static class Program
{
    public static string? BaseDirectory { get; private set; }
    public static string? AppDataDirectory;
    public static string? ConfigLocation { get; private set; }
    public static string? Version { get; private set; }
    public static bool LaunchDebug;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public static AppApi? AppApiInstance { get; private set; }

    private static void SetProgramDirectories()
    {
        if (string.IsNullOrEmpty(AppDataDirectory))
        {
            AppDataDirectory = Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "VRCX");
        }

        BaseDirectory = AppDomain.CurrentDomain.BaseDirectory;
        ConfigLocation = Path.Join(AppDataDirectory, "VRCX.sqlite3");

        if (!Directory.Exists(AppDataDirectory))
        {
            Directory.CreateDirectory(AppDataDirectory);


            if (File.Exists(Path.Join(BaseDirectory, "VRCX.json")))
            {
                File.Move(Path.Join(BaseDirectory, "VRCX.json"), Path.Join(AppDataDirectory, "VRCX.json"));
                File.Copy(Path.Join(AppDataDirectory, "VRCX.json"),
                    Path.Join(AppDataDirectory, "VRCX-backup.json"));
            }

            if (File.Exists(Path.Join(BaseDirectory, "VRCX.sqlite3")))
            {
                File.Move(Path.Join(BaseDirectory, "VRCX.sqlite3"),
                    Path.Join(AppDataDirectory, "VRCX.sqlite3"));
                File.Copy(Path.Join(AppDataDirectory, "VRCX.sqlite3"),
                    Path.Join(AppDataDirectory, "VRCX-backup.sqlite3"));
            }
        }


        string oldCachePath = Path.Join(AppDataDirectory, "cache");
        string newCachePath = Path.Join(AppDataDirectory, "userdata", "cache");
        if (Directory.Exists(oldCachePath) && !Directory.Exists(newCachePath))
        {
            Directory.CreateDirectory(Path.Join(AppDataDirectory, "userdata"));
            Directory.Move(oldCachePath, newCachePath);
        }
    }

#if !LINUX
    private static void GetVersion()
    {
        try
        {
            string versionFile = File.ReadAllText(Path.Join(BaseDirectory, "Version")).Trim();
            string[] version = versionFile.Split('-');
            Version = version.Length > 0 && version[^1].Length == 7
                ? $"VRCX Nightly {versionFile}"
                : $"VRCX {versionFile}";
        }
        catch (IOException exception)
        {
            Logger.Error(exception, CultureInfo.InvariantCulture, "Failed to read version file");
            Version = "VRCX Nightly Build";
        }
        catch (UnauthorizedAccessException exception)
        {
            Logger.Error(exception, CultureInfo.InvariantCulture, "Failed to read version file");
            Version = "VRCX Nightly Build";
        }
    }
#endif

    private static void ConfigureLogger()
    {
        string fileName = Path.Join(AppDataDirectory, "logs", "VRCX.log");
        if (StartupArgs.LaunchArguments.IsOverlay)
        {
            fileName = Path.Join(AppDataDirectory, "logs", "VRCX.Overlay.log");
        }

        LogManager.Setup().LoadConfiguration(builder =>
        {
            var fileTarget = new FileTarget("fileTarget")
            {
                FileName = fileName,


                Layout =
                    "${longdate} [${level:uppercase=true:padding=-5}] ${logger:padding=-20} - ${message} ${exception:format=tostring}",
                ArchiveSuffixFormat = "{0:000}",
                ArchiveEvery = FileArchivePeriod.Day,
                MaxArchiveFiles = 4,
                MaxArchiveDays = 7,
                ArchiveAboveSize = 10000000,
                ArchiveOldFileOnStartup = true,
                KeepFileOpen = true,
                AutoFlush = true,
                Encoding = System.Text.Encoding.UTF8,
            };
            builder.ForLogger().FilterMinLevel(LogLevel.Debug).WriteTo(fileTarget);

            var consoleTarget = new ConsoleTarget("consoleTarget")
            {
                Layout = "${longdate} [${level:uppercase=true:padding=-5}] ${logger:padding=-20} - ${message} ${exception:format=tostring}",
                DetectConsoleAvailable = true,
            };
            builder.ForLogger().FilterMinLevel(LogLevel.Debug).WriteTo(consoleTarget);
        });
    }

#if !LINUX
    [STAThread]
    private static async Task Main()
    {
        OpenVrLibrary.Register();
        AppDomain.CurrentDomain.UnhandledException += (_, unhandled) =>
        {
            if (unhandled.ExceptionObject is Exception exception)
            {
                HandleUnhandledException(exception);
                return;
            }

            Logger.Fatal(CultureInfo.InvariantCulture, "Unhandled exception: {0}", unhandled.ExceptionObject);
        };
        TaskScheduler.UnobservedTaskException += (_, exception) =>
            Logger.Error(exception.Exception, CultureInfo.InvariantCulture, "Unobserved task exception");
        Application.ThreadException += (_, threadException) => HandleUnhandledException(threadException.Exception);
        BrowserSubprocess.Start();
        if (Wine.GetIfWine())
        {
            MessageBox.Show(
                "VRCX Cef has detected Wine.\nPlease switch to our native Electron build for Linux.",
                "Wine Detected", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        try
        {
            Run();
        }
        catch (FileNotFoundException exception)
        {
            await HandleMissingCefAsync(exception, CancellationToken.None);
        }
        catch (SQLiteException exception)
        {
            HandleDatabaseError(exception);
        }
    }

    private static async Task HandleMissingCefAsync(FileNotFoundException exception, CancellationToken cancellationToken)
    {
        Logger.Error(exception, CultureInfo.InvariantCulture, "Handled Exception, Missing file found in Handle Cef Explosion.");

        DialogResult result = MessageBox.Show(
            "VRCX has encountered an error with the CefSharp backend,\nthis is typically caused by missing files or dependencies.\nWould you like to try autofix by automatically installing vc_redist?.",
            "VRCX CefSharp not found.", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
        if (result == DialogResult.Yes)
        {
            Logger.Fatal(CultureInfo.InvariantCulture, "Handled Exception, user selected auto install of vc_redist.");
            await Update.DownloadInstallRedistAsync(cancellationToken);
            MessageBox.Show(
                "vc_redist has finished installing, if the issue persists upon next restart, please reinstall VRCX From GitHub,\nVRCX Will now restart.",
                "vc_redist installation complete", MessageBoxButtons.OK);
            await Task.Delay(5000, cancellationToken);
            AppApiInstance?.RestartApplication(isUpgrade: false);
        }
        else if (result == DialogResult.No)
        {
            Logger.Fatal(CultureInfo.InvariantCulture, "Handled Exception, user chose manual.");
            MessageBox.Show(
                "VRCX will now close, try reinstalling VRCX using the setup from Github as a potential fix.",
                "VRCX CefSharp not found", MessageBoxButtons.OK, MessageBoxIcon.Error);
            await Task.Delay(5000, cancellationToken);
            Environment.Exit(0);
        }
    }

    private static void HandleDatabaseError(SQLiteException exception)
    {
        Logger.Fatal(exception, CultureInfo.InvariantCulture, "Unhandled SQLite Exception, closing.");
        DialogResult messageBoxResult = MessageBox.Show(
            "A fatal database error has occurred.\n" +
            "Please try to repair your database by following the steps in the provided repair guide, or alternatively rename your \"%AppData%\\VRCX\" folder to reset VRCX. " +
            "If the issue still persists after following the repair guide please join the Discord (https://vrcx.app/discord) for further assistance. " +
            "Would you like to open the webpage for database repair steps?\n" +
            exception, "Database error", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
        if (messageBoxResult == DialogResult.Yes)
        {
            AppApiInstance?.OpenLink(new Uri("https://github.com/vrcx-team/VRCX/wiki#how-to-repair-vrcx-database"));
        }
    }

    private static void HandleUnhandledException(Exception exception)
    {
        (string, string)? cpuError = WinApi.GetCpuErrorMessage();
        if (cpuError != null)
        {
            DialogResult messageBoxResult = MessageBox.Show(cpuError.Value.Item1, "Potentially Faulty CPU Detected",
                MessageBoxButtons.YesNo, MessageBoxIcon.Error);
            if (messageBoxResult == DialogResult.Yes)
            {
                AppApiInstance?.OpenLink(new Uri(cpuError.Value.Item2));
            }
        }

        Logger.Fatal(exception, CultureInfo.InvariantCulture, "Unhandled Exception, program dying");
        DialogResult result = MessageBox.Show(exception.ToString(), $"{Version} crashed, open Discord for support?", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
        if (result == DialogResult.Yes)
        {
            AppApiInstance?.OpenLink(new Uri("https://vrcx.app/discord"));
        }

        Environment.Exit(0);
    }

    private static void Run()
    {
        string[] args = Environment.GetCommandLineArgs();
        StartupArgs.ArgsCheck(args);
        SetProgramDirectories();
        VRCXStorage.Instance.Load();
        ConfigureLogger();
        GetVersion();
        if (StartupArgs.LaunchArguments.IsOverlay)
        {
            OverlayProgram.OverlayMain();
        }

        Update.Check();

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(defaultValue: false);

        Logger.Info(CultureInfo.InvariantCulture, "{0} Starting...", Version);
        Logger.Info(CultureInfo.InvariantCulture, "Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
        {
            Logger.Info(CultureInfo.InvariantCulture, "Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);
        }

        Logger.Debug(CultureInfo.InvariantCulture, "Wine detection: {0}", Wine.GetIfWine());

        IPCServer.Init();
        SQLiteDatabase.Instance.Init();
        AppApiInstance = new AppApiCef();

        ProcessMonitor.Instance.Init();
        Discord.Instance.Init();
        WebApi.Instance.Init();
        LogWatcher.Instance.Init();
        AutoAppLaunchManager.Init();
        CefService.Init();
        _ = OverlayServer.InitAsync(CancellationToken.None);

        using (MainForm mainForm = new())
        {
            Application.Run(mainForm);
        }

        Logger.Info(CultureInfo.InvariantCulture, "{0} Exiting...", Version);
        WebApi.Instance.SaveCookies();
        _ = OverlayServer.ExitAsync(CancellationToken.None);
        CefService.Exit();
        AutoAppLaunchManager.Instance.Exit();
        LogWatcher.Instance.Exit();
        WebApi.Instance.Exit();
        Discord.Instance.Exit();
        VRCXStorage.Instance.Save();
        SQLiteDatabase.Instance.Exit();
        ProcessMonitor.Instance.Exit();
    }
#else
    public static VRCXVRInterface VRCXVRInstance
    {
        get => field ?? throw new InvalidOperationException("VRCXVRInstance has not been created yet.");
        set;
    }

    public static void PreInit(string version, string[] args)
    {
        OpenVrLibrary.Register();
        Version = version;
        StartupArgs.ArgsCheck(args);
        SetProgramDirectories();
    }

    public static void Init()
    {
        ConfigureLogger();
        Update.Check();

        Logger.Info(CultureInfo.InvariantCulture, "{0} Starting...", Version);
        Logger.Info(CultureInfo.InvariantCulture, "Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
        {
            Logger.Info(CultureInfo.InvariantCulture, "Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);
        }

        AppApiInstance = new AppApiElectron();

        VRCXVRInstance = new VRCXVRElectron();
        VRCXVRInstance.Init();
    }
#endif
}
