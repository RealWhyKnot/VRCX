using System.Diagnostics;
using System.Runtime.Versioning;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace VRCX;

internal sealed partial class AutoAppLaunchManager
{
    [SupportedOSPlatform("windows")]
    public async Task StartSteamGameAsync(string appId, CancellationToken cancellationToken)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo($"steam://launch/{appId}")
                {
                    UseShellExecute = true,
                },
            };
            process.Start();
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            Logger.Error(ex, "Error starting steam game with appid {0}", appId);
        }

        string? appDirPath = GetPathWithAppId(appId);
        if (appDirPath == null)
        {
            return;
        }

        const int RetryLimit = 10;
        for (int i = 0; i < RetryLimit; i++)
        {
            Process[] processes = Process.GetProcesses();
            Process? foundProcess = processes.FirstOrDefault(p => IsProcessInDirectory(p, appDirPath));
            if (foundProcess?.MainModule?.FileName == null)
            {
                await Task.Delay(1000, cancellationToken).ConfigureAwait(false);
                continue;
            }

            string processPath = foundProcess.MainModule.FileName;
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Found process for appid {0}: {1} (PID: {2})", appId, processPath, foundProcess.Id);
            lock (_startedProcesses)
            {
                _startedProcesses.Add(processPath, [foundProcess.Id]);
            }

            return;
        }
        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Failed to find process for appid {0} after starting. Steam may have failed to launch the game or it may have taken too long to start.", appId);
    }

    [SupportedOSPlatform("windows")]
    private static bool IsProcessInDirectory(Process process, string appDirPath)
    {
        try
        {
            return !process.HasExited &&
                   process.MainModule?.FileName != null &&
                   process.MainModule.FileName.StartsWith(appDirPath, StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            Logger.Debug(ex, "Could not read the module of process {0}", process.Id);
            return false;
        }
    }

    [SupportedOSPlatform("windows")]
    private static string? GetPathWithAppId(string appId)
    {
        string? steamPath = GetSteamInstallPath();
        if (steamPath == null)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Cant find Steam install path");
            return null;
        }

        string libraryFoldersVdfPath = Path.Join(steamPath, @"config\libraryfolders.vdf");
        if (!File.Exists(libraryFoldersVdfPath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Cant find Steam libraryfolders.vdf");
            return null;
        }

        foreach (string libraryPath in ReadSteamLibraryFolders(libraryFoldersVdfPath))
        {
            string[] appManifestFiles = Directory.GetFiles(libraryPath, "appmanifest_*.acf");
            foreach (string file in appManifestFiles)
            {
                string? installPath = GetInstallPathFromManifest(file, libraryPath, appId);
                if (installPath != null)
                {
                    return installPath;
                }
            }
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Could not find install dir for appid {0}", appId);
        return null;
    }

    [SupportedOSPlatform("windows")]
    private static string? GetSteamInstallPath()
    {
        string? steamPath = null;
        try
        {
            using RegistryKey? key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Wow6432Node\Valve\Steam");
            if (key?.GetValue("InstallPath") is string path)
            {
                steamPath = path;
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException or ArgumentException)
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Could not read the Steam install path from the local machine registry: {0}", ex);
        }

        if (steamPath != null)
        {
            return steamPath;
        }

        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
            if (key?.GetValue("SteamPath") is string path)
            {
                steamPath = path.Replace("/", "\\", StringComparison.Ordinal);
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException or ArgumentException)
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Could not read the Steam install path from the current user registry: {0}", ex);
        }

        return steamPath;
    }

    private static List<string> ReadSteamLibraryFolders(string libraryFoldersVdfPath)
    {
        var libraryFolders = new List<string>();
        foreach (string line in File.ReadLines(libraryFoldersVdfPath))
        {
            if (!line.Contains("\"path\"", StringComparison.Ordinal))
            {
                continue;
            }

            string[] parts = line.Split("\t");
            if (parts.Length < 4)
            {
                continue;
            }

            string basePath = parts[4].Replace("\"", "", StringComparison.Ordinal).Replace(@"\\", @"\", StringComparison.Ordinal);
            string path = Path.Join(basePath, @"steamapps");
            if (Directory.Exists(path))
            {
                libraryFolders.Add(path);
            }
        }

        return libraryFolders;
    }

    private static string? GetInstallPathFromManifest(string manifestFile, string libraryPath, string appId)
    {
        try
        {
            string acf = File.ReadAllText(manifestFile);
            Match idMatch = AppIdRegex().Match(acf);
            Match dirMatch = InstallDirRegex().Match(acf);
            if (!idMatch.Success || !dirMatch.Success)
            {
                return null;
            }

            string foundAppId = idMatch.Groups["id"].Value;
            if (!string.Equals(foundAppId, appId, StringComparison.Ordinal))
            {
                return null;
            }

            string fullPath = Path.Join(libraryPath, "common", dirMatch.Groups["dir"].Value);
            return Directory.Exists(fullPath) ? fullPath : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            Logger.Debug(ex, "Could not read Steam app manifest {0}", manifestFile);
            return null;
        }
    }

    [GeneratedRegex(@"""appid""\s+""(?<id>\d+)""", RegexOptions.NonBacktracking)]
    private static partial Regex AppIdRegex();

    [GeneratedRegex(@"""installdir""\s+""(?<dir>[^""]+)""", RegexOptions.NonBacktracking)]
    private static partial Regex InstallDirRegex();
}
