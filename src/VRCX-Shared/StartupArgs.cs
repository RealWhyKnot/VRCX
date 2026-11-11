using System.Diagnostics;

#if !LINUX
using System.Globalization;
using System.IO.Pipes;
using System.Management;
using System.Text;
using CefSharp.Internals;
using VRCX.IPC;
#endif

namespace VRCX;

internal sealed class StartupArgs
{
    public static VrcxLaunchArguments LaunchArguments = new();
    public static string[]? Args;

    public static void ArgsCheck(string[] args)
    {
        Args = args;
        Debug.Assert(Program.LaunchDebug = true);

        LaunchArguments = ParseArgs(args);

        if (LaunchArguments.IsDebug)
        {
            Program.LaunchDebug = true;
        }

        if (LaunchArguments.ConfigDirectory != null)
        {
            if (File.Exists(LaunchArguments.ConfigDirectory))
            {
                string message =
                    "Move your \"VRCX.sqlite3\" into a folder then specify the folder in the launch parameter e.g.\n--config=\"C:\\VRCX\\\"";
#if !LINUX
                MessageBox.Show(message, "--config is now a directory", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
                Console.WriteLine(message);
                Environment.Exit(0);
            }

            Program.AppDataDirectory = LaunchArguments.ConfigDirectory;
        }

#if !LINUX
        bool disableClosing = LaunchArguments.IsUpgrade ||
                                    !string.IsNullOrEmpty(CommandLineArgsParser.GetArgumentValue(args, CefSharpArguments.SubProcessTypeArgument));


        if (!disableClosing && IsDuplicateProcessRunning(LaunchArguments))
        {
            IPCToMain();
            Thread.Sleep(10);
            Environment.Exit(0);
        }
#endif
    }

#if !LINUX
    private static bool IsDuplicateProcessRunning(VrcxLaunchArguments launchArguments)
    {
        Process[] processes = Process.GetProcessesByName("VRCX");
        try
        {
            foreach (Process process in processes)
            {
                if (process.Id == Environment.ProcessId)
                {
                    continue;
                }
                string commandLine = string.Empty;
                try
                {
                    using var searcher = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId = " + process.Id.ToString(CultureInfo.InvariantCulture));
                    using ManagementObjectCollection objects = searcher.Get();
                    commandLine = objects.Cast<ManagementBaseObject>().SingleOrDefault()?["CommandLine"]?.ToString() ?? string.Empty;
                }
                catch (ManagementException exception)
                {
                    Console.Error.WriteLine(exception.Message);
                }
                catch (UnauthorizedAccessException exception)
                {
                    Console.Error.WriteLine(exception.Message);
                }
                if (commandLine.Contains(CefSharpArguments.SubProcessTypeArgument, StringComparison.Ordinal))
                {
                    continue;
                }
                if (launchArguments.IsOverlay)
                {
                    if (commandLine.Contains(VrcxLaunchArguments.Overlay, StringComparison.Ordinal))
                    {
                        Console.WriteLine("Another overlay instance is already running. Exiting this instance.");
                        Environment.Exit(0);
                    }
                    continue;
                }
                if (commandLine.Contains(VrcxLaunchArguments.Overlay, StringComparison.Ordinal))
                {
                    continue;
                }
                VrcxLaunchArguments processArguments = ParseArgs(commandLine.Split(' '));
                if (string.Equals(processArguments.ConfigDirectory, launchArguments.ConfigDirectory, StringComparison.Ordinal))
                {
                    return true;
                }
            }
            return false;
        }
        finally
        {
            foreach (Process process in processes)
            {
                process.Dispose();
            }
        }
    }

    private static void IPCToMain()
    {
        new IPCServer().CreateIPCServer();
        using var ipcClient = new NamedPipeClientStream(".", IPCServer.GetIpcName(), PipeDirection.InOut);
        ipcClient.Connect();
        if (ipcClient.IsConnected)
        {
            byte[] buffer = Encoding.UTF8.GetBytes($"{{\"type\":\"LaunchCommand\",\"command\":\"{LaunchArguments.LaunchCommand}\"}}\0");
            ipcClient.Write(buffer);
        }
    }
#endif

    private static VrcxLaunchArguments ParseArgs(string[] args)
    {
        var arguments = new VrcxLaunchArguments();
        foreach (string arg in args)
        {
            if (string.Equals(arg, VrcxLaunchArguments.IsStartupPrefix, StringComparison.Ordinal))
            {
                arguments.IsStartup = true;
            }

            if (string.Equals(arg, VrcxLaunchArguments.IsUpgradePrefix, StringComparison.Ordinal))
            {
                arguments.IsUpgrade = true;
            }

            if (arg.StartsWith(VrcxLaunchArguments.IsDebugPrefix, StringComparison.Ordinal))
            {
                arguments.IsDebug = true;
            }

            if (string.Equals(arg, VrcxLaunchArguments.Overlay, StringComparison.Ordinal))
            {
                arguments.IsOverlay = true;
            }

            if (arg.StartsWith(VrcxLaunchArguments.LaunchCommandPrefix, StringComparison.Ordinal) && arg.Length > VrcxLaunchArguments.LaunchCommandPrefix.Length)
            {
                arguments.LaunchCommand = arg[VrcxLaunchArguments.LaunchCommandPrefix.Length..];
            }

            if (arg.StartsWith(VrcxLaunchArguments.LinuxLaunchCommandPrefix, StringComparison.Ordinal) && arg.Length > VrcxLaunchArguments.LinuxLaunchCommandPrefix.Length)
            {
                arguments.LaunchCommand = arg[VrcxLaunchArguments.LinuxLaunchCommandPrefix.Length..];
            }

            if (arg.StartsWith(VrcxLaunchArguments.ConfigDirectoryPrefix, StringComparison.Ordinal) && arg.Length > VrcxLaunchArguments.ConfigDirectoryPrefix.Length)
            {
                arguments.ConfigDirectory = arg[(VrcxLaunchArguments.ConfigDirectoryPrefix.Length + 1)..];
            }

            if (arg.StartsWith(VrcxLaunchArguments.ProxyUrlPrefix, StringComparison.Ordinal) && arg.Length > VrcxLaunchArguments.ProxyUrlPrefix.Length)
            {
                arguments.ProxyUrl = arg[(VrcxLaunchArguments.ProxyUrlPrefix.Length + 1)..].Replace("'", string.Empty, StringComparison.Ordinal).Replace("\"", string.Empty, StringComparison.Ordinal);
            }
        }
        return arguments;
    }

    internal sealed class VrcxLaunchArguments
    {
        public const string IsStartupPrefix = "--startup";
        public bool IsStartup { get; set; }

        public const string IsUpgradePrefix = "/Upgrade";
        public bool IsUpgrade { get; set; }

        public const string IsDebugPrefix = "--debug";
        public bool IsDebug { get; set; }

        public const string Overlay = "--overlay";
        public bool IsOverlay { get; set; }

        public const string LaunchCommandPrefix = "/uri=vrcx://";
        public const string LinuxLaunchCommandPrefix = "vrcx://";
        public string? LaunchCommand { get; set; }

        public const string ConfigDirectoryPrefix = "--config";
        public string? ConfigDirectory { get; set; }

        public const string ProxyUrlPrefix = "--proxy-server";
        public string? ProxyUrl { get; set; }
    }
}
