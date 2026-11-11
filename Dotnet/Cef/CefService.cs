using System.Globalization;
using System.Text;
using CefSharp;
using CefSharp.SchemeHandler;
using CefSharp.WinForms;
using NLog;

namespace VRCX.Cef;

internal static class CefService
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly string LastCefVersionPath = Path.Join(Program.AppDataDirectory, "LastCefVersion");

    private static CefSettings? Settings;

    internal static void Init()
    {
        bool isOverlay = StartupArgs.LaunchArguments.IsOverlay;
        string userDataDir = Path.Join(Program.AppDataDirectory, "userdata");
        if (isOverlay)
        {
            userDataDir = Path.Join(Program.AppDataDirectory, "overlay/userdata");
        }

        CheckCefVersion(userDataDir);

        Settings = CreateSettings(isOverlay, userDataDir);
        if (!CefSharp.Cef.Initialize(Settings, performDependencyCheck: false))
        {
            Logger.Error(CultureInfo.InvariantCulture, "Cef failed to initialize");
            throw new InvalidOperationException("CefSharp.Cef.Initialize()");
        }
    }

    private static CefSettings CreateSettings(bool isOverlay, string userDataDir)
    {
        var cefSettings = new CefSettings
        {
            RootCachePath = userDataDir,
            CachePath = Path.Join(userDataDir, "cache"),
            LogSeverity = Program.LaunchDebug ? LogSeverity.Verbose : LogSeverity.Error,
            LogFile = Path.Join(Program.AppDataDirectory, "logs", "cef.log"),
            WindowlessRenderingEnabled = true,
            PersistSessionCookies = true,
            UserAgent = Program.Version,
            BrowserSubprocessPath = Environment.ProcessPath,
            BackgroundColor = 0xFF0A0A0A,
        };
        if (isOverlay)
        {
            cefSettings.LogFile = Path.Join(Program.AppDataDirectory, "overlay/logs/cef.log");
        }

        cefSettings.RegisterScheme(new CefCustomScheme
        {
            SchemeName = "file",
            DomainName = "vrcx",
            SchemeHandlerFactory = new FolderSchemeHandlerFactory(
                Path.Join(Program.BaseDirectory, "html"),
                "file",
                defaultPage: "index.html"
            ),
            IsLocal = true,
        });

        AddCommandLineArgs(cefSettings, isOverlay);

        CefSharpSettings.ShutdownOnExit = true;
        CefSharpSettings.SubprocessExitIfParentProcessClosed = true;
        CefSharpSettings.ConcurrentTaskExecution = true;

        return cefSettings;
    }

    private static void AddCommandLineArgs(CefSettings cefSettings, bool isOverlay)
    {
        cefSettings.CefCommandLineArgs.Add("disable-spell-checking");
        cefSettings.CefCommandLineArgs.Add("disable-pdf-extension");
        cefSettings.CefCommandLineArgs["autoplay-policy"] = "no-user-gesture-required";
        cefSettings.CefCommandLineArgs.Add("disable-web-security");

        cefSettings.CefCommandLineArgs.Add("unsafely-disable-devtools-self-xss-warnings");
        cefSettings.CefCommandLineArgs.Add("do-not-de-elevate");

        if (WebApi.ProxySet)
        {
            cefSettings.CefCommandLineArgs["proxy-server"] = WebApi.ProxyServer;
        }

        if (string.Equals(VRCXStorage.Instance.Get("VRCX_DisableGpuAcceleration"), "true", StringComparison.Ordinal))
        {
            cefSettings.CefCommandLineArgs.Add("disable-gpu");
        }

        if (Program.LaunchDebug)
        {
            Logger.Info(CultureInfo.InvariantCulture, "Debug mode enabled");
            cefSettings.RemoteDebuggingPort = !isOverlay ? 8089 : 8090;
            cefSettings.CefCommandLineArgs["remote-allow-origins"] = "*";
        }

        if (Program.LaunchDebug && !isOverlay)
        {
            AddDevToolsExtensions(cefSettings);
        }
    }

    private static void AddDevToolsExtensions(CefSettings cefSettings)
    {
        string extensionsPath = Path.Join(Program.AppDataDirectory, "extensions");
        Directory.CreateDirectory(extensionsPath);

        string[] folders = Directory.GetDirectories(extensionsPath);
        foreach (string folder in folders)
        {
            cefSettings.CefCommandLineArgs.Add("load-extension", folder);
        }
    }

    private static void CheckCefVersion(string userDataDir)
    {
        string currentVersion = CefSharp.Cef.ChromiumVersion;
        if (File.Exists(LastCefVersionPath))
        {
            string lastCefVersion = File.ReadAllText(LastCefVersionPath).Trim();
            if (!Version.TryParse(lastCefVersion, out Version? lastVersion) ||
                !Version.TryParse(currentVersion, out Version? parsedCurrentVersion))
            {
                Logger.Info(CultureInfo.InvariantCulture, "Cef version mismatch detected, deleting userdata: {0} -> {1}", lastCefVersion,
                    currentVersion);
                DeleteUserData(userDataDir);
            }
            else if (lastVersion > parsedCurrentVersion)
            {
                Logger.Info(CultureInfo.InvariantCulture, "Cef downgrade detected, deleting userdata: {0} -> {1}", lastCefVersion,
                    currentVersion);
                DeleteUserData(userDataDir);
            }
        }

        File.WriteAllBytes(LastCefVersionPath, Encoding.UTF8.GetBytes(currentVersion));
        Logger.Info(CultureInfo.InvariantCulture, "Cef version: {0}", currentVersion);
    }

    private static void DeleteUserData(string userDataDir)
    {
        if (!Directory.Exists(userDataDir))
        {
            return;
        }

        try
        {
            Directory.Delete(userDataDir, recursive: true);
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException)
        {
            Logger.Error(ex, CultureInfo.InvariantCulture, "Failed to delete userdata directory: {0}", userDataDir);
        }
    }

    internal static void Exit() => CefSharp.Cef.Shutdown();
}
