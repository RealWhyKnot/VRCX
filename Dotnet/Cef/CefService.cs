using System.IO.Compression;
using System.Text;
using CefSharp;
using CefSharp.SchemeHandler;
using CefSharp.WinForms;
using NLog;

namespace VRCX;

internal sealed class CefService
{
    public static readonly CefService Instance;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly string _lastCefVersionPath = string.Empty;

    static CefService()
    {
        _lastCefVersionPath = Path.Join(Program.AppDataDirectory, "LastCefVersion");
        Instance = new CefService();
    }

    internal void Init()
    {
        bool isOverlay = StartupArgs.LaunchArguments.IsOverlay;
        string userDataDir = Path.Join(Program.AppDataDirectory, "userdata");
        if (isOverlay)
        {
            userDataDir = Path.Join(Program.AppDataDirectory, "overlay/userdata");
        }

        CheckCefVersion(userDataDir);

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



        cefSettings.CefCommandLineArgs.Add("disable-spell-checking");
        cefSettings.CefCommandLineArgs.Add("disable-pdf-extension");
        cefSettings.CefCommandLineArgs["autoplay-policy"] = "no-user-gesture-required";
        cefSettings.CefCommandLineArgs.Add("disable-web-security");

        cefSettings.CefCommandLineArgs.Add("unsafely-disable-devtools-self-xss-warnings");
        cefSettings.CefCommandLineArgs.Add("do-not-de-elevate");

        if (WebApi.ProxySet)
        {
            cefSettings.CefCommandLineArgs["proxy-server"] = WebApi.ProxyUrl;
        }

        if (string.Equals(VRCXStorage.Instance.Get("VRCX_DisableGpuAcceleration"), "true", StringComparison.Ordinal))
        {
            cefSettings.CefCommandLineArgs.Add("disable-gpu");
        }

        if (Program.LaunchDebug)
        {



            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Debug mode enabled");
            cefSettings.RemoteDebuggingPort = !isOverlay ? 8089 : 8090;
            cefSettings.CefCommandLineArgs["remote-allow-origins"] = "*";
        }


        if (Program.LaunchDebug && !isOverlay)
        {
            string extensionsPath = Path.Join(Program.AppDataDirectory, "extensions");
            Directory.CreateDirectory(extensionsPath);


            string vueDevtoolsCrxPath = Path.Join(Program.BaseDirectory, @"..\..\Dotnet\build-tools\Vue-js-devtools.crx");
            if (File.Exists(vueDevtoolsCrxPath))
            {
                string vueDevtoolsPath = Path.Join(extensionsPath, "Vue-js-devtools");
                try
                {
                    if (Directory.Exists(vueDevtoolsPath))
                    {
                        Directory.Delete(vueDevtoolsPath, recursive: true);
                    }

                    Directory.CreateDirectory(vueDevtoolsPath);
                    ZipFile.ExtractToDirectory(vueDevtoolsCrxPath, vueDevtoolsPath);
                }
                catch (Exception ex)
                {
                    Logger.Error(ex, "Failed to extract Vue Devtools");
                }
            }


            string[] folders = Directory.GetDirectories(extensionsPath);
            foreach (string folder in folders)
            {
                cefSettings.CefCommandLineArgs.Add("load-extension", folder);
            }
        }

        CefSharpSettings.ShutdownOnExit = true;
        CefSharpSettings.SubprocessExitIfParentProcessClosed = true;
        CefSharpSettings.ConcurrentTaskExecution = true;

        if (!CefSharp.Cef.Initialize(cefSettings, performDependencyCheck: false))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Cef failed to initialize");
            throw new Exception("CefSharp.Cef.Initialize()");
        }
    }

    private void CheckCefVersion(string userDataDir)
    {
        string currentVersion = CefSharp.Cef.ChromiumVersion;
        if (File.Exists(_lastCefVersionPath))
        {
            string lastCefVersion = File.ReadAllText(_lastCefVersionPath).Trim();
            if (!Version.TryParse(lastCefVersion, out Version? lastVersion) ||
                !Version.TryParse(currentVersion, out Version? parsedCurrentVersion))
            {
                Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Cef version mismatch detected, deleting userdata: {0} -> {1}", lastCefVersion,
                    currentVersion);
                DeleteUserData(userDataDir);
            }
            else if (lastVersion > parsedCurrentVersion)
            {
                Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Cef downgrade detected, deleting userdata: {0} -> {1}", lastCefVersion,
                    currentVersion);
                DeleteUserData(userDataDir);
            }
        }

        File.WriteAllBytes(_lastCefVersionPath, Encoding.UTF8.GetBytes(currentVersion));
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Cef version: {0}", currentVersion);
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
        catch (Exception ex)
        {
            Logger.Error(ex, "Failed to delete userdata directory: {0}", userDataDir);
        }
    }

    internal void Exit() => CefSharp.Cef.Shutdown();
}
