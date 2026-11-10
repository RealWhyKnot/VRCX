using System.Diagnostics;
using NLog;

namespace VRCX;

internal sealed class OverlayManager
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    private static Process? _process;

    public static void StartOverlay()
    {
        if (OverlayServer.IsConnected() ||
            (_process != null && !_process.HasExited))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Overlay server already started");
            return;
        }

        StartOverlayProcess();
    }

    private static void StartOverlayProcess()
    {
        if (Environment.ProcessPath == null)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Cannot start Overlay process without a process path");
            return;
        }

        var args = new List<string>
        {
            StartupArgs.VrcxLaunchArguments.Overlay,
        };
        if (Program.LaunchDebug)
        {
            args.Add(StartupArgs.VrcxLaunchArguments.IsDebugPrefix);
        }

        if (StartupArgs.LaunchArguments.ConfigDirectory != null)
        {
            args.Add($"{StartupArgs.VrcxLaunchArguments.ConfigDirectoryPrefix}={StartupArgs.LaunchArguments.ConfigDirectory}");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = Environment.ProcessPath,
            Arguments = string.Join(' ', args),
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Program.BaseDirectory,
        };
        _process = Process.Start(startInfo);
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Overlay process started");
    }
}
