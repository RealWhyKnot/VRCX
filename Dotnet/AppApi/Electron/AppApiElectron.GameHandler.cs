using System.ComponentModel;
using System.Diagnostics;

namespace VRCX;

public partial class AppApiElectron
{
    internal override void OnProcessStateChanged(MonitoredProcess monitoredProcess)
    {
    }

    public override void CheckGameRunning()
    {
    }

    public override bool IsGameRunning()
    {
        Process[] processes = Process.GetProcessesByName("VRChat.exe");
        bool isGameRunning = processes.Length > 0;
        foreach (Process process in processes)
        {
            process.Dispose();
        }

        return isGameRunning;
    }

    public override bool IsSteamVRRunning()
    {
        string[] processNames = ["vrmonitor", "monado-service"];
        foreach (string? name in processNames)
        {
            Process[] processes = Process.GetProcessesByName(name);
            bool isSteamVRRunning = processes.Length > 0;
            foreach (Process process in processes)
            {
                process.Dispose();
            }

            if (isSteamVRRunning)
            {
                return true;
            }
        }


        Process[] allProcesses = Process.GetProcesses();
        bool isRunning = allProcesses.Any(process => process.ProcessName.EndsWith("wivrn-server", StringComparison.Ordinal));
        foreach (Process process in allProcesses)
        {
            process.Dispose();
        }

        return isRunning;
    }

    public override int QuitGame()
    {
        Process[] processes = Process.GetProcessesByName("VRChat.exe");
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
            Process.Start(new ProcessStartInfo
            {
                FileName = "steam",
                Arguments = $"-applaunch 438100 {arguments}",
                UseShellExecute = false,
            })?.Dispose();
            return true;
        }
        catch (Exception e) when (e is Win32Exception or InvalidOperationException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to start VRChat: {e.Message}, attempting to start via Steam path.");
        }

        try
        {
            string steamPath = SteamPath;
            if (string.IsNullOrEmpty(steamPath))
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Steam path could not be determined.");
                return false;
            }

            string steamExecutable = Path.Join(steamPath, "steam.sh");
            if (!File.Exists(steamExecutable))
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Steam executable not found.");
                return false;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = steamExecutable,
                Arguments = $"-applaunch 438100 {arguments}",
                UseShellExecute = false,
            })?.Dispose();

            return true;
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to start VRChat: {ex.Message}");
            return false;
        }
    }

    public override bool StartGameFromPath(string path, string arguments) =>

        false;

    public override Task<bool> TryOpenInstanceInVrcAsync(string launchUrl)
    {
        try
        {
            int pid = FindVRChatPid();
            if (pid <= 0)
            {
                return Task.FromResult(false);
            }

            string launchExe = Path.Join(VrcInstallPath, "launch.exe");
            if (!File.Exists(launchExe))
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"TryOpenInstanceInVrc: launch.exe not found at {launchExe}");
                return Task.FromResult(false);
            }

            string url = launchUrl.Contains("attach=1", StringComparison.Ordinal) ? launchUrl : launchUrl + "&attach=1";

            const string Inner =
                "while IFS= read -r -d '' kv; do export \"$kv\"; done < \"/proc/$1/environ\"; exec wine \"$2\" \"$3\"";

            var psi = new ProcessStartInfo
            {
                FileName = "nsenter",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (string? arg in new[]
                     {
                         "-t", pid.ToString(System.Globalization.CultureInfo.InvariantCulture), "-U", "-m", "--preserve-credentials", "--",
                         "/bin/bash", "-c", Inner, "_", pid.ToString(System.Globalization.CultureInfo.InvariantCulture), launchExe, url,
                     })
            {
                psi.ArgumentList.Add(arg);
            }

            using var process = Process.Start(psi);
            bool started = process != null;
            return Task.FromResult(started);
        }
        catch (Exception e) when (e is Win32Exception or InvalidOperationException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"TryOpenInstanceInVrc failed: {e.Message}");
            return Task.FromResult(false);
        }
    }

    private static int FindVRChatPid()
    {
        Process[] processes = Process.GetProcessesByName("VRChat.exe");
        try
        {
            foreach (Process process in processes)
            {
                if (ProcessEnvironmentContainsVrcPrefix(process.Id))
                {
                    return process.Id;
                }
            }

            return processes.Length > 0 ? processes[0].Id : -1;
        }
        finally
        {
            foreach (Process process in processes)
            {
                process.Dispose();
            }
        }
    }

    private static bool ProcessEnvironmentContainsVrcPrefix(int processId)
    {
        try
        {
            string environ = File.ReadAllText($"/proc/{processId}/environ");
            return environ.Contains("compatdata/438100", StringComparison.Ordinal);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}
