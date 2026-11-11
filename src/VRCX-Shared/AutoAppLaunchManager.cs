using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Timers;
using NLog;
using Timer = System.Timers.Timer;

namespace VRCX;

internal sealed partial class AutoAppLaunchManager : IDisposable
{
    public static AutoAppLaunchManager Instance { get; private set; }
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public const string VRChatProcessName = "VRChat";

    public bool Enabled;

    public bool KillChildrenOnExit = true;
    public bool RunProcessOnce = true;
    public readonly string AppShortcutDirectory;
    public readonly string AppShortcutDesktop;
    public readonly string AppShortcutVR;

    private readonly DateTime _startTime = DateTime.Now;
    private readonly Dictionary<string, HashSet<int>> _startedProcesses = [];
    private readonly Timer _childUpdateTimer;
    private int _timerTicks;
    private static readonly byte[] ShortcutSignatureBytes = [0x4C, 0x00, 0x00, 0x00];
    private static readonly byte[] UrlShortcutHeader = "[{000214A0-0000-0000-C000-000000000046}]"u8.ToArray();

    private const uint TH32CS_SNAPPROCESS = 2;

    [LibraryImport("kernel32.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial bool Process32First(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial bool Process32Next(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [StructLayout(LayoutKind.Sequential)]
    internal struct PROCESSENTRY32
    {
        public uint DwSize;
        public uint CntUsage;
        public uint Th32ProcessID;
        public IntPtr Th32DefaultHeapID;
        public uint Th32ModuleID;
        public uint CntThreads;
        public uint Th32ParentProcessID;
        public int PcPriClassBase;
        public uint DwFlags;
        public ExeFileNameBuffer SzExeFile;
    }

    [InlineArray(260)]
    internal struct ExeFileNameBuffer
    {
        private byte _element0;
    }

    [SupportedOSPlatform("windows")]
    static AutoAppLaunchManager()
    {
        Instance = new AutoAppLaunchManager();
    }

    [SupportedOSPlatform("windows")]
    public AutoAppLaunchManager()
    {
        AppShortcutDirectory = Path.Join(Program.AppDataDirectory, "startup");
        AppShortcutDesktop = Path.Join(AppShortcutDirectory, "desktop");
        AppShortcutVR = Path.Join(AppShortcutDirectory, "vr");

        Directory.CreateDirectory(AppShortcutDirectory);
        Directory.CreateDirectory(AppShortcutDesktop);
        Directory.CreateDirectory(AppShortcutVR);

        ProcessMonitor.Instance.ProcessStarted += OnProcessStarted;
        ProcessMonitor.Instance.ProcessExited += OnProcessExited;

        _childUpdateTimer = new Timer
        {
            Interval = 60000,
        };
        _childUpdateTimer.Elapsed += ChildUpdateTimer_Elapsed;
    }

    private void OnProcessExited(object? sender, MonitoredProcessEventArgs e)
    {
        MonitoredProcess monitoredProcess = e.MonitoredProcess;
        if (!monitoredProcess.HasName(VRChatProcessName))
        {
            return;
        }

        lock (_startedProcesses)
        {
            if (KillChildrenOnExit)
            {
                _childUpdateTimer.Stop();

                KillChildProcesses();
            }
            else
            {
                UpdateChildProcesses();
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private void OnProcessStarted(object? sender, MonitoredProcessEventArgs e)
    {
        MonitoredProcess monitoredProcess = e.MonitoredProcess;
        if (!Enabled || !monitoredProcess.HasName(VRChatProcessName) || monitoredProcess.Process is not { } process || process.StartTime < _startTime)
        {
            return;
        }

        lock (_startedProcesses)
        {
            if (KillChildrenOnExit)
            {
                KillChildProcesses();
            }
            else
            {
                UpdateChildProcesses();
            }

            (List<string> shortcutFiles, List<string> steamIds) = FindShortcutFiles(AppShortcutDirectory);
            (List<string> platformShortcutFiles, List<string> platformSteamIds) = FindShortcutFiles(Program.AppApiInstance?.IsSteamVRRunning() == true ? AppShortcutVR : AppShortcutDesktop);
            shortcutFiles.AddRange(platformShortcutFiles);
            steamIds.AddRange(platformSteamIds);
            foreach (string file in shortcutFiles)
            {
                if (RunProcessOnce && IsProcessRunning(file))
                {
                    continue;
                }

                if (IsChildProcessRunning(file))
                {
                    continue;
                }

                StartChildProcess(file);
            }
            foreach (string steamId in steamIds)
            {
                _ = StartSteamGameAsync(steamId, CancellationToken.None);
            }

            if (shortcutFiles.Count == 0 && steamIds.Count == 0)
            {
                return;
            }

            _timerTicks = 0;
            _childUpdateTimer.Interval = 1000;
            _childUpdateTimer.Start();
        }
    }

    private void KillChildProcesses()
    {
        UpdateChildProcesses();

        Parallel.ForEach(_startedProcesses.ToArray(), pair =>
        {
            HashSet<int> processes = pair.Value;
            int[] pids = [.. processes];
            foreach (int pid in pids)
            {
                if (!WinApi.HasProcessExited(pid))
                {
                    KillProcessTree(pid);
                }
            }
        });

        _startedProcesses.Clear();
    }

    public static List<int> FindChildProcesses(int pid, bool recursive = true)
    {
        List<int> pids = [];

        IntPtr snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == IntPtr.Zero)
        {
            return pids;
        }

        var procEntry = new PROCESSENTRY32
        {
            DwSize = (uint)Marshal.SizeOf<PROCESSENTRY32>(),
        };

        if (Process32First(snapshot, ref procEntry))
        {
            do
            {
                if (procEntry.Th32ParentProcessID == pid)
                {
                    pids.Add((int)procEntry.Th32ProcessID);

                    if (recursive)
                    {
                        pids.AddRange(FindChildProcesses((int)procEntry.Th32ProcessID));
                    }
                }
            }
            while (Process32Next(snapshot, ref procEntry));
        }

        return pids;
    }

    public static void KillProcessTree(int pid)
    {
        List<int> pids = FindChildProcesses(pid);
        pids.Add(pid);

        foreach (int p in pids)
        {
            try
            {
                using var proc = Process.GetProcessById(p);
                if (proc.HasExited)
                {
                    continue;
                }

                proc.Kill();
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
            {
                Logger.Debug(ex, "Could not stop process {0}", p);
            }
        }
    }

    private void StartChildProcess(string path)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo(path)
                {
                    UseShellExecute = true,
                },
            };
            process.Start();
            if (process.Id != 0)
            {
                _startedProcesses.Add(path, [process.Id]);
            }
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, ex);
        }
    }

    private void UpdateChildProcesses()
    {
        foreach (KeyValuePair<string, HashSet<int>> pair in _startedProcesses.ToArray())
        {
            HashSet<int> processes = pair.Value;
            foreach (int pid in processes.ToArray())
            {
                bool recursiveChildSearch = processes.Count == 1;
                List<int> childProcesses = FindChildProcesses(pid, recursiveChildSearch);

                foreach (int childPid in childProcesses)
                {
                    processes.Add(childPid);
                }

                if (WinApi.HasProcessExited(pid))
                {
                    processes.Remove(pid);
                }
            }

            if (processes.Count == 0)
            {
                _startedProcesses.Remove(pair.Key);
            }
        }
    }

    private bool IsChildProcessRunning(string path) => _startedProcesses.ContainsKey(path);

    private static bool IsProcessRunning(string filePath)
    {
        try
        {
            string processName = Path.GetFileNameWithoutExtension(filePath);
            Process[] processes = Process.GetProcessesByName(processName);
            bool isProcessRunning = processes.Length != 0;
            foreach (Process process in processes)
            {
                process.Dispose();
            }

            return isProcessRunning;
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            Logger.Error(ex, "Error checking if process is running: {0}", filePath);
            return false;
        }
    }

    public static void Init()
    {
    }

    public void Exit()
    {
        _childUpdateTimer.Stop();

        Enabled = false;
    }

    private void ChildUpdateTimer_Elapsed(object? sender, ElapsedEventArgs e)
    {
        lock (_startedProcesses)
        {
            UpdateChildProcesses();
        }

        if (_timerTicks < 5)
        {
            _timerTicks++;

            if (_timerTicks == 5)
            {
                _childUpdateTimer.Interval = 60000;
            }
        }
    }

    private static Tuple<List<string>, List<string>> FindShortcutFiles(string folderPath)
    {
        var directoryInfo = new DirectoryInfo(folderPath);
        FileInfo[] files = directoryInfo.GetFiles();
        var shortcuts = new List<string>();
        var steamIds = new List<string>();

        foreach (FileInfo file in files)
        {
            if (IsShortcutFile(file.FullName))
            {
                shortcuts.Add(file.FullName);
                continue;
            }
            if (IsUrlShortcutFile(file.FullName))
            {
                try
                {
                    const string UrlPrefix = "URL=steam://rungameid/";
                    string[] lines = File.ReadAllLines(file.FullName);
                    string? urlLine = lines.FirstOrDefault(l => l.StartsWith(UrlPrefix, StringComparison.Ordinal));
                    if (urlLine == null)
                    {
                        continue;
                    }

                    string appId = urlLine[UrlPrefix.Length..].Trim();
                    steamIds.Add(appId);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
                {
                    Logger.Error(ex, "Error reading shortcut file: {0}", file.FullName);
                }
            }
        }

        return new Tuple<List<string>, List<string>>(shortcuts, steamIds);
    }

    private static bool IsShortcutFile(string filePath)
    {
        byte[] headerBytes = new byte[4];
        using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (fileStream.Length < 4)
        {
            return false;
        }

        fileStream.ReadExactly(headerBytes, 0, 4);

        return headerBytes.SequenceEqual(ShortcutSignatureBytes);
    }

    private static bool IsUrlShortcutFile(string filePath)
    {
        byte[] headerBytes = new byte[UrlShortcutHeader.Length];
        using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (fileStream.Length < headerBytes.Length)
        {
            return false;
        }

        fileStream.ReadExactly(headerBytes, 0, headerBytes.Length);

        return headerBytes.SequenceEqual(UrlShortcutHeader);
    }

    void IDisposable.Dispose() => _childUpdateTimer.Dispose();
}
