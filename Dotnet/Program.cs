using System.Data.SQLite;
using System.Text.Json;
using NLog;
using NLog.Targets;
#if !LINUX
using VRCX.Overlay;
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
            Logger.Error(exception, "Failed to read version file");
            Version = "VRCX Nightly Build";
        }
        catch (UnauthorizedAccessException exception)
        {
            Logger.Error(exception, "Failed to read version file");
            Version = "VRCX Nightly Build";
        }
    }

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
        AppDomain.CurrentDomain.UnhandledException += (_, exception) =>
            Logger.Fatal(System.Globalization.CultureInfo.InvariantCulture, "Unhandled exception: {0}", exception.ExceptionObject);
        TaskScheduler.UnobservedTaskException += (_, exception) =>
            Logger.Error(exception.Exception, System.Globalization.CultureInfo.InvariantCulture, "Unobserved task exception");
        BrowserSubprocess.Start();
        if (global::VRCX.Cef.Wine.GetIfWine())
        {
            MessageBox.Show(
                "VRCX Cef has detected Wine.\nPlease switch to our native Electron build for Linux.",
                "Wine Detected", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        try
        {
            Run();
        }

        #region Handle CEF Explosion

        catch (FileNotFoundException e)
        {
            Logger.Error(e, "Handled Exception, Missing file found in Handle Cef Explosion.");

            DialogResult result = MessageBox.Show(
                "VRCX has encountered an error with the CefSharp backend,\nthis is typically caused by missing files or dependencies.\nWould you like to try autofix by automatically installing vc_redist?.",
                "VRCX CefSharp not found.", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
            switch (result)
            {
                case DialogResult.Yes:
                    Logger.Fatal(System.Globalization.CultureInfo.InvariantCulture, "Handled Exception, user selected auto install of vc_redist.");
                    await Update.DownloadInstallRedistAsync();
                    MessageBox.Show(
                        "vc_redist has finished installing, if the issue persists upon next restart, please reinstall VRCX From GitHub,\nVRCX Will now restart.",
                        "vc_redist installation complete", MessageBoxButtons.OK);
                    await Task.Delay(5000);
                    AppApiInstance.RestartApplication(isUpgrade: false);
                    break;

                case DialogResult.No:
                    Logger.Fatal(System.Globalization.CultureInfo.InvariantCulture, "Handled Exception, user chose manual.");
                    MessageBox.Show(
                        "VRCX will now close, try reinstalling VRCX using the setup from Github as a potential fix.",
                        "VRCX CefSharp not found", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    await Task.Delay(5000);
                    Environment.Exit(0);
                    break;
                case DialogResult.None:
                    break;
                case DialogResult.OK:
                    break;
                case DialogResult.Cancel:
                    break;
                case DialogResult.Abort:
                    break;
                case DialogResult.Retry:
                    break;
                case DialogResult.Ignore:
                    break;
                case DialogResult.TryAgain:
                    break;
                case DialogResult.Continue:
                    break;
                default:
                    break;
            }
        }

        #endregion

        #region Handle Database Error

        catch (SQLiteException e)
        {
            Logger.Fatal(e, "Unhandled SQLite Exception, closing.");
            DialogResult messageBoxResult = MessageBox.Show(
                "A fatal database error has occured.\n" +
                "Please try to repair your database by following the steps in the provided repair guide, or alternatively rename your \"%AppData%\\VRCX\" folder to reset VRCX. " +
                "If the issue still persists after following the repair guide please join the Discord (https://vrcx.app/discord) for further assistance. " +
                "Would you like to open the webpage for database repair steps?\n" +
                e, "Database error", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
            if (messageBoxResult == DialogResult.Yes)
            {
                AppApiInstance.OpenLink("https://github.com/vrcx-team/VRCX/wiki#how-to-repair-vrcx-database");
            }
        }

        #endregion

        catch (Exception e)
        {
            (string, string)? cpuError = WinApi.GetCpuErrorMessage();
            if (cpuError != null)
            {
                DialogResult messageBoxResult = MessageBox.Show(cpuError.Value.Item1, "Potentially Faulty CPU Detected",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                if (messageBoxResult == DialogResult.Yes)
                {
                    AppApiInstance.OpenLink(cpuError.Value.Item2);
                }
            }

            Logger.Fatal(e, "Unhandled Exception, program dying");
            DialogResult result = MessageBox.Show(e.ToString(), $"{Version} crashed, open Discord for support?", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
            if (result == DialogResult.Yes)
            {
                AppApiInstance.OpenLink("https://vrcx.app/discord");
            }
            Environment.Exit(0);
        }
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

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "{0} Starting...", Version);
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);
        }

        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Wine detection: {0}", global::VRCX.Cef.Wine.GetIfWine());

        IPCServer.Instance.Init();
        SQLite.Instance.Init();
        AppApiInstance = new AppApiCef();

        ProcessMonitor.Instance.Init();
        Discord.Instance.Init();
        WebApi.Instance.Init();
        LogWatcher.Instance.Init();
        AutoAppLaunchManager.Instance.Init();
        CefService.Instance.Init();
        OverlayServer.Instance.InitAsync();

        Application.Run(new MainForm());

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "{0} Exiting...", Version);
        WebApi.Instance.SaveCookies();
        OverlayServer.Instance.ExitAsync();
        CefService.Instance.Exit();
        AutoAppLaunchManager.Instance.Exit();
        LogWatcher.Instance.Exit();
        WebApi.Instance.Exit();
        Discord.Instance.Exit();
        VRCXStorage.Instance.Save();
        SQLite.Instance.Exit();
        ProcessMonitor.Instance.Exit();
    }
#else
    public static VRCXVRInterface VRCXVRInstance;

    public static void PreInit(string version, string[] args)
    {
        Version = version;
        StartupArgs.ArgsCheck(args);
        SetProgramDirectories();
    }

    public static void Init()
    {
        ConfigureLogger();
        Update.Check();

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "{0} Starting...", Version);
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);
        }

        AppApiInstance = new AppApiElectron();

        VRCXVRInstance = new VRCXVRElectron();
        VRCXVRInstance.Init();
    }
#endif
}

#if LINUX
public sealed class ProgramElectron
{
    public void PreInit(string version, string[] args) => Program.PreInit(version, args);

    public void Init() => Program.Init();
}
#endif
