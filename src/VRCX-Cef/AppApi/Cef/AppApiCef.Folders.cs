using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using VRCX.Cef;

namespace VRCX;

internal partial class AppApiCef
{
    public override string GetVRChatAppDataLocation() => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + @"Low\VRChat\VRChat";

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
        string defaultPath = Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "VRChat");
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
        string steamUserdataPath = Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Steam\userdata");

        try
        {
            using RegistryKey? key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam");
            if (key != null)
            {
                object? o = key.GetValue("InstallPath");
                if (o != null)
                {
                    steamUserdataPath = Path.Join(o.ToString(), @"userdata");
                }
            }
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.Security.SecurityException or ArgumentException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to get Steam userdata path from registry: {e}");
        }

        return steamUserdataPath;
    }

    public override string GetVRChatScreenshotsLocation()
    {
        string steamUserdataPath = GetSteamUserdataPathFromRegistry();
        string screenshotPath = string.Empty;
        DateTime latestWriteTime = DateTime.MinValue;
        if (!Directory.Exists(steamUserdataPath))
        {
            return screenshotPath;
        }

        string[] steamUserDirs = Directory.GetDirectories(steamUserdataPath);
        foreach (string steamUserDir in steamUserDirs)
        {
            string screenshotDir = Path.Join(steamUserDir, @"760\remote\438100\screenshots");
            if (!Directory.Exists(screenshotDir))
            {
                continue;
            }

            DateTime lastWriteTime = File.GetLastWriteTime(screenshotDir);
            if (lastWriteTime <= latestWriteTime)
            {
                continue;
            }

            latestWriteTime = lastWriteTime;
            screenshotPath = screenshotDir;
        }

        return screenshotPath;
    }

    public override bool OpenVrcxAppDataFolder()
    {
        string path = Program.AppDataDirectory ?? string.Empty;
        if (!Directory.Exists(path))
        {
            return false;
        }

        OpenFolderAndSelectItem(path, isFolder: true);
        return true;
    }

    public override bool OpenVrcAppDataFolder()
    {
        string path = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + @"Low\VRChat\VRChat";
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
        string path = Path.Join(Path.GetTempPath(), "VRChat", "VRChat", "Crashes");
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
        path = Path.GetFullPath(path);

        if (!File.Exists(path) && !Directory.Exists(path))
        {
            return;
        }

        string? folderPath = isFolder ? path : Path.GetDirectoryName(path);

        int result = WinApi.SHParseDisplayName(folderPath ?? string.Empty, IntPtr.Zero, out nint pidlFolder, 0, out _);
        if (result != 0)
        {
            OpenFolderAndSelectItemFallback(path);
            return;
        }

        result = WinApi.SHParseDisplayName(path, IntPtr.Zero, out nint pidlFile, 0, out _);
        if (result != 0)
        {
            Marshal.FreeCoTaskMem(pidlFolder);
            OpenFolderAndSelectItemFallback(path);
            return;
        }

        IntPtr[] files = [pidlFile];

        try
        {
            WinApi.SHOpenFolderAndSelectItems(pidlFolder, (uint)files.Length, files, 0);
        }
        catch (ExternalException)
        {
            OpenFolderAndSelectItemFallback(path);
        }
        finally
        {
            Marshal.FreeCoTaskMem(pidlFolder);
            Marshal.FreeCoTaskMem(pidlFile);
        }
    }

    private static void OpenFolderAndSelectItemFallback(string path)
    {
        if (!File.Exists(path) && !Directory.Exists(path))
        {
            return;
        }

        if (Directory.Exists(path))
        {
            Process.Start("explorer.exe", path);
        }
        else
        {
            Process.Start("explorer.exe", $"/select,\"{path}\"");
        }
    }

    public override async Task<string> OpenFolderSelectorDialogAsync(string defaultPath = "", CancellationToken cancellationToken = default)
    {
        var tcs = new TaskCompletionSource<string>();
        var staThread = new Thread(() =>
        {
            try
            {
                using var openFolderDialog = new FolderBrowserDialog();
                openFolderDialog.InitialDirectory = Directory.Exists(defaultPath) ? defaultPath : GetVRChatPhotosLocation();

                DialogResult dialogResult = openFolderDialog.ShowDialog(MainForm.MainNativeWindow);
                if (dialogResult == DialogResult.OK)
                {
                    tcs.SetResult(openFolderDialog.SelectedPath);
                }
                else
                {
                    tcs.SetResult(defaultPath);
                }
            }
            catch (Exception ex) when (ex is InvalidOperationException or ExternalException or IOException or ArgumentException)
            {
                tcs.SetException(ex);
            }
        });

        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();

        return await tcs.Task.WaitAsync(cancellationToken);
    }

    public override async Task<string> OpenFileSelectorDialogAsync(string defaultPath = "", string defaultExt = "", string defaultFilter = "All files (*.*)|*.*", CancellationToken cancellationToken = default)
    {
        var tcs = new TaskCompletionSource<string>();
        var staThread = new Thread(() =>
        {
            try
            {
                using var openFileDialog = new System.Windows.Forms.OpenFileDialog();
                if (Directory.Exists(defaultPath))
                {
                    openFileDialog.InitialDirectory = defaultPath;
                }

                openFileDialog.DefaultExt = defaultExt;
                openFileDialog.Filter = defaultFilter;

                DialogResult dialogResult = openFileDialog.ShowDialog(MainForm.MainNativeWindow);
                if (dialogResult == DialogResult.OK && !string.IsNullOrEmpty(openFileDialog.FileName))
                {
                    tcs.SetResult(openFileDialog.FileName);
                }
                else
                {
                    tcs.SetResult("");
                }
            }
            catch (Exception ex) when (ex is InvalidOperationException or ExternalException or IOException or ArgumentException)
            {
                tcs.SetException(ex);
            }
        });

        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();

        return await tcs.Task.WaitAsync(cancellationToken);
    }
}
