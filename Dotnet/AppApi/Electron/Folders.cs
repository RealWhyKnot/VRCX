using System.Diagnostics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VRCX;

public partial class AppApiElectron
{
    public static string _homeDirectory;
    public static string _steamPath;
    public static string _steamUserdataPath;
    public static string _vrcPrefixPath;
    public static string _vrcAppDataPath;
    public static string _vrcCrashesPath;
    public static string _vrcInstallPath;

    static AppApiElectron()
    {
        const string vrchatAppid = "438100";
        _homeDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        _steamUserdataPath = Path.Join(_homeDirectory, ".steam/steam/userdata");
        _steamPath = Path.Join(_homeDirectory, ".local/share/Steam");

        string flatpakSteamPath = Path.Join(_homeDirectory, ".var/app/com.valvesoftware.Steam/.local/share/Steam");
        if (!IsValidSteamPath(_steamPath) && IsValidSteamPath(flatpakSteamPath))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Flatpak Steam detected.");
            _steamPath = flatpakSteamPath;
        }

        string legacySteamPath = Path.Join(_homeDirectory, ".steam/steam");
        if (!IsValidSteamPath(_steamPath) && IsValidSteamPath(legacySteamPath))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Legacy Steam path detected.");
            _steamPath = legacySteamPath;
        }

        if (!IsValidSteamPath(_steamPath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "No valid Steam library found.");
        }

        string libraryFoldersVdfPath = Path.Join(_steamPath, "config/libraryfolders.vdf");
        string? vrcLibraryPath = GetLibraryWithAppId(libraryFoldersVdfPath, vrchatAppid);
        if (string.IsNullOrEmpty(vrcLibraryPath))
        {
            Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Falling back to default VRChat path as libraryfolders.vdf was not found OR libraryfolders.vdf does not contain VRChat's appid (438100)");
            vrcLibraryPath = _steamPath;
        }
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Using steam library path {vrcLibraryPath}");
        _vrcPrefixPath = Path.Join(vrcLibraryPath, $"steamapps/compatdata/{vrchatAppid}/pfx");
        _vrcInstallPath = Path.Join(vrcLibraryPath, "steamapps/common/VRChat");
        _vrcAppDataPath = Path.Join(_vrcPrefixPath, "drive_c/users/steamuser/AppData/LocalLow/VRChat/VRChat");
        _vrcCrashesPath = Path.Join(_vrcPrefixPath, "drive_c/users/steamuser/AppData/Local/Temp/VRChat/VRChat/Crashes");
    }

    private static bool IsValidSteamPath(string path) => File.Exists(Path.Join(path, "config/libraryfolders.vdf"));

    private static string? GetLibraryWithAppId(string libraryFoldersVdfPath, string appId)
    {
        if (!File.Exists(libraryFoldersVdfPath))
        {
            return null;
        }

        string? libraryPath = null;
        foreach (string line in File.ReadLines(libraryFoldersVdfPath))
        {

            if (line.Contains("\"path\""))
            {
                string[] parts = line.Split("\t");
                if (parts.Length < 4)
                {
                    continue;
                }

                libraryPath = parts[4].Replace("\"", "");
            }

            if (line.Contains($"\"{appId}\"") && Directory.Exists(libraryPath))
            {
                return libraryPath;
            }
        }

        return null;
    }

    public override string GetVRChatAppDataLocation() => _vrcAppDataPath;

    public override string GetVRChatCacheLocation()
    {
        string defaultPath = Path.Join(GetVRChatAppDataLocation(), "Cache-WindowsPlayer");
        try
        {
            string json = ReadConfigFile();
            if (string.IsNullOrEmpty(json))
            {
                return defaultPath;
            }

            JObject? obj = JsonConvert.DeserializeObject<JObject>(json, JsonSerializerSettings);
            if (obj["cache_directory"] == null)
            {
                return defaultPath;
            }

            string? cacheDir = (string)obj["cache_directory"];
            if (string.IsNullOrEmpty(cacheDir))
            {
                return defaultPath;
            }

            string cachePath = Path.Join(cacheDir, "Cache-WindowsPlayer");
            return !Directory.Exists(cacheDir) ? defaultPath : cachePath;
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error reading VRChat config file for cache location: {e}");
        }
        return defaultPath;
    }

    public override string GetVRChatPhotosLocation()
    {
        string defaultPath = Path.Join(_vrcPrefixPath, "drive_c/users/steamuser/Pictures/VRChat");
        try
        {
            string json = ReadConfigFile();
            if (string.IsNullOrEmpty(json))
            {
                return defaultPath;
            }

            JObject? obj = JsonConvert.DeserializeObject<JObject>(json, JsonSerializerSettings);
            if (obj["picture_output_folder"] == null)
            {
                return defaultPath;
            }

            string? photosDir = (string)obj["picture_output_folder"];
            return string.IsNullOrEmpty(photosDir) || !Directory.Exists(photosDir) ? defaultPath : photosDir;
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error reading VRChat config file for photos location: {e}");
        }
        return defaultPath;
    }

    public override string GetUGCPhotoLocation(string path = "")
    {
        if (string.IsNullOrEmpty(path))
        {
            return GetVRChatPhotosLocation();
        }

        try
        {
            if (!Directory.Exists(path))
            {
                Directory.CreateDirectory(path);
            }
            return path;
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
            return GetVRChatPhotosLocation();
        }
    }

    private string GetSteamUserdataPathFromRegistry()
    {

        if (Directory.Exists(_steamUserdataPath))
        {
            string[] steamUserDirs = Directory.GetDirectories(_steamUserdataPath);
            if (steamUserDirs.Length > 0)
            {
                return steamUserDirs[0];
            }
        }
        return string.Empty;
    }

    public override string GetVRChatScreenshotsLocation() =>

        Path.Join(_steamUserdataPath, "760/remote/438100/screenshots");

    public override bool OpenVrcxAppDataFolder()
    {
        string? path = Program.AppDataDirectory;
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenVrcAppDataFolder()
    {
        string path = _vrcAppDataPath;
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenVrcPhotosFolder()
    {
        string path = GetVRChatPhotosLocation();
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenUGCPhotosFolder(string ugcPath = "")
    {
        string path = GetUGCPhotoLocation(ugcPath);
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenVrcScreenshotsFolder()
    {
        string path = GetVRChatScreenshotsLocation();
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenCrashVrcCrashDumps()
    {
        string path = _vrcCrashesPath;
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override void OpenShortcutFolder()
    {
        string path = AutoAppLaunchManager.Instance.AppShortcutDirectory;
        if (!Directory.Exists(path))
        {
            return;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
    }

    public override void OpenFolderAndSelectItem(string path, bool isFolder = false)
    {
        if (!File.Exists(path) && !Directory.Exists(path))
        {
            return;
        }

        string directoryPath = isFolder ? path : Path.GetDirectoryName(path);
        var commandAttempt = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { "nautilus", $"\"{path}\"" },
            { "nemo", $"\"{path}\"" },
            { "thunar", $"\"{path}\"" },
            { "caja", $"--select \"{path}\"" },
            { "pcmanfm-qt", $"\"{directoryPath}\"" },
            { "pcmanfm", $"\"{directoryPath}\"" },
            { "dolphin", $"--select \"{path}\"" },
            { "konqueror", $"--select \"{path}\"" },
            { "xdg-open", $"\"{directoryPath}\"" },
        };

        foreach (KeyValuePair<string, string> command in commandAttempt)
        {
            if (!IsCommandAvailable(command.Key))
            {
                continue;
            }

            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = command.Key,
                        Arguments = command.Value,
                        UseShellExecute = false,
                        RedirectStandardError = true,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true,
                    },
                };
                process.Start();
                return;
            }
            catch
            {

            }
        }
    }

    private bool IsCommandAvailable(string command)
    {
        try
        {
            var which = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "which",
                    Arguments = command,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                },
            };
            which.Start();
            string result = which.StandardOutput.ReadToEnd();
            which.WaitForExit();
            return which.ExitCode == 0 && !string.IsNullOrWhiteSpace(result);
        }
        catch
        {
            return false;
        }
    }

    public override Task<string> OpenFolderSelectorDialogAsync(string defaultPath = "") =>


        Task.FromResult(string.Empty);

    public override Task<string> OpenFileSelectorDialogAsync(string defaultPath = "", string defaultExt = "",
        string defaultFilter = "All files (*.*)|*.*") =>


        Task.FromResult(string.Empty);
}
