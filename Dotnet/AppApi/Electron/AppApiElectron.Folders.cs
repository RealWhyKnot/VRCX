using System.ComponentModel;
using System.Diagnostics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace VRCX;

public partial class AppApiElectron
{
    private const string VrchatAppId = "438100";

    private static readonly string HomeDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    private static readonly string SteamUserdataPath = Path.Join(HomeDirectory, ".steam/steam/userdata");
    private static readonly string SteamPath = ResolveSteamPath();
    private static readonly string VrcLibraryPath = ResolveVrcLibraryPath(SteamPath);
    private static readonly string VrcPrefixPath = Path.Join(VrcLibraryPath, $"steamapps/compatdata/{VrchatAppId}/pfx");
    private static readonly string VrcInstallPath = Path.Join(VrcLibraryPath, "steamapps/common/VRChat");
    private static readonly string VrcAppDataPath = Path.Join(VrcPrefixPath, "drive_c/users/steamuser/AppData/LocalLow/VRChat/VRChat");
    private static readonly string VrcCrashesPath = Path.Join(VrcPrefixPath, "drive_c/users/steamuser/AppData/Local/Temp/VRChat/VRChat/Crashes");

    private static string ResolveSteamPath()
    {
        string steamPath = Path.Join(HomeDirectory, ".local/share/Steam");

        string flatpakSteamPath = Path.Join(HomeDirectory, ".var/app/com.valvesoftware.Steam/.local/share/Steam");
        if (!IsValidSteamPath(steamPath) && IsValidSteamPath(flatpakSteamPath))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Flatpak Steam detected.");
            steamPath = flatpakSteamPath;
        }

        string legacySteamPath = Path.Join(HomeDirectory, ".steam/steam");
        if (!IsValidSteamPath(steamPath) && IsValidSteamPath(legacySteamPath))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Legacy Steam path detected.");
            steamPath = legacySteamPath;
        }

        if (!IsValidSteamPath(steamPath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "No valid Steam library found.");
        }

        return steamPath;
    }

    private static string ResolveVrcLibraryPath(string steamPath)
    {
        string libraryFoldersVdfPath = Path.Join(steamPath, "config/libraryfolders.vdf");
        string? vrcLibraryPath = GetLibraryWithAppId(libraryFoldersVdfPath, VrchatAppId);
        if (string.IsNullOrEmpty(vrcLibraryPath))
        {
            Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Falling back to default VRChat path as libraryfolders.vdf was not found OR libraryfolders.vdf does not contain VRChat's appid (438100)");
            vrcLibraryPath = steamPath;
        }

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Using steam library path {vrcLibraryPath}");
        return vrcLibraryPath;
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
            if (line.Contains("\"path\"", StringComparison.Ordinal))
            {
                string[] parts = line.Split("\t");
                if (parts.Length < 4)
                {
                    continue;
                }

                libraryPath = parts[4].Replace("\"", "", StringComparison.Ordinal);
            }

            if (line.Contains($"\"{appId}\"", StringComparison.Ordinal) && Directory.Exists(libraryPath))
            {
                return libraryPath;
            }
        }

        return null;
    }

    public override string GetVRChatAppDataLocation() => VrcAppDataPath;

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
            if (obj?["cache_directory"] == null)
            {
                return defaultPath;
            }

            string? cacheDir = (string?)obj["cache_directory"];
            if (string.IsNullOrEmpty(cacheDir))
            {
                return defaultPath;
            }

            string cachePath = Path.Join(cacheDir, "Cache-WindowsPlayer");
            return !Directory.Exists(cacheDir) ? defaultPath : cachePath;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException or InvalidCastException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error reading VRChat config file for cache location: {e}");
        }
        return defaultPath;
    }

    public override string GetVRChatPhotosLocation()
    {
        string defaultPath = Path.Join(VrcPrefixPath, "drive_c/users/steamuser/Pictures/VRChat");
        try
        {
            string json = ReadConfigFile();
            if (string.IsNullOrEmpty(json))
            {
                return defaultPath;
            }

            JObject? obj = JsonConvert.DeserializeObject<JObject>(json, JsonSerializerSettings);
            if (obj?["picture_output_folder"] == null)
            {
                return defaultPath;
            }

            string? photosDir = (string?)obj["picture_output_folder"];
            return string.IsNullOrEmpty(photosDir) || !Directory.Exists(photosDir) ? defaultPath : photosDir;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException or InvalidCastException)
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
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
            return GetVRChatPhotosLocation();
        }
    }

    private static string GetSteamUserdataPathFromRegistry()
    {
        if (Directory.Exists(SteamUserdataPath))
        {
            string[] steamUserDirs = Directory.GetDirectories(SteamUserdataPath);
            if (steamUserDirs.Length > 0)
            {
                return steamUserDirs[0];
            }
        }
        return string.Empty;
    }

    public override string GetVRChatScreenshotsLocation() =>

        Path.Join(SteamUserdataPath, "760/remote/438100/screenshots");

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
        string path = VrcAppDataPath;
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
        string path = VrcCrashesPath;
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

        string? directoryPath = isFolder ? path : Path.GetDirectoryName(path);
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

            if (TryStartFileManager(command.Key, command.Value))
            {
                return;
            }
        }
    }

    private static bool TryStartFileManager(string fileName, string arguments)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardError = true,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                },
            };
            process.Start();
            return true;
        }
        catch (Exception e) when (e is Win32Exception or InvalidOperationException)
        {
            return false;
        }
    }

    private static bool IsCommandAvailable(string command)
    {
        try
        {
            using var which = new Process
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
        catch (Exception e) when (e is Win32Exception or InvalidOperationException or IOException)
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
