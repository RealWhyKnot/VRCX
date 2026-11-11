using System.Diagnostics;
using System.Text.RegularExpressions;
using CefSharp;
using Microsoft.Win32;
using VRCX.Cef;

namespace VRCX;

internal partial class AppApiCef
{
    internal override void OnProcessStateChanged(MonitoredProcess monitoredProcess)
    {
        if (!monitoredProcess.HasName("VRChat") && !monitoredProcess.HasName("vrserver"))
        {
            return;
        }

        CheckGameRunning();
    }

    public override void CheckGameRunning()
    {
        bool isGameRunning = false;
        bool isSteamVRRunning = false;

        if (ProcessMonitor.Instance.IsProcessRunning("VRChat"))
        {
            isGameRunning = true;
        }

        if (ProcessMonitor.Instance.IsProcessRunning("vrserver"))
        {
            isSteamVRRunning = true;
        }

        if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading && MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
        {
            MainForm.Instance.Browser.ExecuteScriptAsync("window?.$bridge?.updateIsGameRunning", isGameRunning, isSteamVRRunning);
        }
    }

    public override bool IsGameRunning() => ProcessMonitor.Instance.IsProcessRunning("VRChat");

    public override bool IsSteamVRRunning() => ProcessMonitor.Instance.IsProcessRunning("vrserver");

    public override int QuitGame()
    {
        Process[] processes = Process.GetProcessesByName("VRChat");
        if (processes.Length == 1)
        {
            processes[0].Kill();
        }

        foreach (Process process in processes)
        {
            process.Dispose();
        }

        return processes.Length;
    }

    public override bool StartGame(string arguments)
    {
        try
        {
            using RegistryKey? key = Registry.ClassesRoot.OpenSubKey(@"steam\shell\open\command");

            Match match = MyRegex().Match(key?.GetValue(string.Empty) as string ?? string.Empty);
            if (match.Success)
            {
                string path = match.Groups["path"].Value;

                Process.Start(new ProcessStartInfo
                {
                    WorkingDirectory = path,
                    FileName = $"{path}\\steam.exe",
                    UseShellExecute = false,
                    Arguments = $"-applaunch 438100 {arguments}",
                })?.Dispose();
                return true;
            }
        }
        catch (Exception ex) when (ex is System.Security.SecurityException or ArgumentException or IOException or UnauthorizedAccessException or ObjectDisposedException or RegexMatchTimeoutException)
        {
            Logger.Warn(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to start VRChat from Steam");
        }

        try
        {
            using RegistryKey? key = Registry.ClassesRoot.OpenSubKey(@"VRChat\shell\open\command");

            Match match = MyRegex1().Match(key?.GetValue(string.Empty) as string ?? string.Empty);
            if (match.Success)
            {
                string path = match.Groups["path"].Value;
                return StartGameFromPath(path, arguments);
            }
        }
        catch (Exception ex) when (ex is System.Security.SecurityException or ArgumentException or IOException or UnauthorizedAccessException or ObjectDisposedException or RegexMatchTimeoutException)
        {
            Logger.Warn(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to start VRChat from registry");
        }

        return false;
    }

    public override bool StartGameFromPath(string path, string arguments)
    {
        if (!path.EndsWith(".exe", StringComparison.Ordinal))
        {
            path = Path.Join(path, "launch.exe");
        }

        if (!path.EndsWith("launch.exe", StringComparison.Ordinal) || !File.Exists(path))
        {
            return false;
        }

        Process.Start(new ProcessStartInfo
        {
            WorkingDirectory = Path.GetDirectoryName(path),
            FileName = path,
            UseShellExecute = false,
            Arguments = arguments,
        })?.Dispose();
        return true;
    }

    [GeneratedRegex("^\"(?<path>.+?)\\\\steam.exe\"", RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex();

    [GeneratedRegex("(?!\")(?<path>.+?\\\\VRChat.*)(?:!?\\\\launch.exe\")", RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex1();
}
