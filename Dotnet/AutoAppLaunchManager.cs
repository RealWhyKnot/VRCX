using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text.RegularExpressions;
using System.Timers;
using Microsoft.Win32;
using NLog;
using Timer = System.Timers.Timer;

namespace VRCX;




internal sealed partial class AutoAppLaunchManager
{
    public static AutoAppLaunchManager Instance { get; private set; }
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public const string VRChatProcessName = "VRChat";

    public bool Enabled = false;

    public bool KillChildrenOnExit = true;
    public bool RunProcessOnce = true;
    public readonly string AppShortcutDirectory;
    public readonly string AppShortcutDesktop;
    public readonly string AppShortcutVR;

    private readonly DateTime startTime = DateTime.Now;
    private readonly Dictionary<string, HashSet<int>> startedProcesses = [];
    private readonly Timer childUpdateTimer;
    private int timerTicks = 0;
    private static readonly byte[] shortcutSignatureBytes = [0x4C, 0x00, 0x00, 0x00];
    private static readonly byte[] urlShortcutHeader = "[{000214A0-0000-0000-C000-000000000046}]"u8.ToArray();

    private const uint TH32CS_SNAPPROCESS = 2;


    [DllImport("kernel32.dll")]
    public static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

    [DllImport("kernel32.dll")]
    public static extern bool Process32First(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [DllImport("kernel32.dll")]
    public static extern bool Process32Next(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [StructLayout(LayoutKind.Sequential)]
    internal struct PROCESSENTRY32 : IEquatable<PROCESSENTRY32>
    {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID;
        public uint cntThreads;
        public uint th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szExeFile;

        public override readonly bool Equals(object? obj) => obj is PROCESSENTRY32 other && Equals(other);

        public override readonly int GetHashCode()
        {
            var hash = new HashCode();
            hash.Add(dwSize);
            hash.Add(cntUsage);
            hash.Add(th32ProcessID);
            hash.Add(th32DefaultHeapID);
            hash.Add(th32ModuleID);
            hash.Add(cntThreads);
            hash.Add(th32ParentProcessID);
            hash.Add(pcPriClassBase);
            hash.Add(dwFlags);
            hash.Add(szExeFile, StringComparer.Ordinal);
            return hash.ToHashCode();
        }

        public static bool operator ==(PROCESSENTRY32 left, PROCESSENTRY32 right)
        {
            return left.Equals(right);
        }

        public static bool operator !=(PROCESSENTRY32 left, PROCESSENTRY32 right)
        {
            return !(left == right);
        }

        public readonly bool Equals(PROCESSENTRY32 other) =>
            dwSize == other.dwSize &&
            cntUsage == other.cntUsage &&
            th32ProcessID == other.th32ProcessID &&
            th32DefaultHeapID == other.th32DefaultHeapID &&
            th32ModuleID == other.th32ModuleID &&
            cntThreads == other.cntThreads &&
            th32ParentProcessID == other.th32ParentProcessID &&
            pcPriClassBase == other.pcPriClassBase &&
            dwFlags == other.dwFlags &&
            string.Equals(szExeFile, other.szExeFile, StringComparison.Ordinal);
    }
    static AutoAppLaunchManager()
    {
        Instance = new AutoAppLaunchManager();
    }

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

        childUpdateTimer = new Timer
        {
            Interval = 60000,
        };
        childUpdateTimer.Elapsed += ChildUpdateTimer_Elapsed;
    }

    private void OnProcessExited(MonitoredProcess monitoredProcess)
    {
        if (!monitoredProcess.HasName(VRChatProcessName))
        {
            return;
        }

        lock (startedProcesses)
        {
            if (KillChildrenOnExit)
            {
                childUpdateTimer.Stop();

                KillChildProcesses();
            }
            else
            {
                UpdateChildProcesses();
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private void OnProcessStarted(MonitoredProcess monitoredProcess)
    {
        if (!Enabled || !monitoredProcess.HasName(VRChatProcessName) || monitoredProcess.Process.StartTime < startTime)
        {
            return;
        }


        lock (startedProcesses)
        {
            if (KillChildrenOnExit)
            {
                KillChildProcesses();
            }
            else
            {
                UpdateChildProcesses();
            }

            (List<string>? shortcutFiles, List<string>? steamIds) = FindShortcutFiles(AppShortcutDirectory);
            (List<string>? platformShortcutFiles, List<string>? platformSteamIds) = FindShortcutFiles(Program.AppApiInstance.IsSteamVRRunning() ? AppShortcutVR : AppShortcutDesktop);
            shortcutFiles.AddRange(platformShortcutFiles);
            steamIds.AddRange(platformSteamIds);
            foreach (string? file in shortcutFiles)
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
            foreach (string? steamId in steamIds)
            {
                StartSteamGameAsync(steamId);
            }

            if (shortcutFiles.Count == 0 && steamIds.Count == 0)
            {
                return;
            }

            timerTicks = 0;
            childUpdateTimer.Interval = 1000;
            childUpdateTimer.Start();
        }
    }




    private void KillChildProcesses()
    {
        UpdateChildProcesses();


        Parallel.ForEach(startedProcesses.ToArray(), pair =>
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

        startedProcesses.Clear();
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
            dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32)),
        };

        if (Process32First(snapshot, ref procEntry))
        {
            do
            {
                if (procEntry.th32ParentProcessID == pid)
                {
                    pids.Add((int)procEntry.th32ProcessID);

                    if (recursive)
                    {
                        pids.AddRange(FindChildProcesses((int)procEntry.th32ProcessID));
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
            catch
            {
            }
        }
    }





    private void StartChildProcess(string path)
    {
        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo(path)
                {
                    UseShellExecute = true,
                },
            };
            process.Start();
            if (process.Id != 0)
            {
                startedProcesses.Add(path, [process.Id]);
            }
        }
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, ex);
        }
    }





    private void UpdateChildProcesses()
    {
        foreach (KeyValuePair<string, HashSet<int>> pair in startedProcesses.ToArray())
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
                startedProcesses.Remove(pair.Key);
            }
        }
    }








    private bool IsChildProcessRunning(string path) => startedProcesses.ContainsKey(path);

    private bool IsProcessRunning(string filePath)
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
        catch (Exception ex)
        {
            Logger.Error(ex, "Error checking if process is running: {0}", filePath);
            return false;
        }
    }

    public void Init()
    {

    }

    public void Exit()
    {
        childUpdateTimer.Stop();

        Enabled = false;




    }

    private void ChildUpdateTimer_Elapsed(object sender, ElapsedEventArgs e)
    {
        lock (startedProcesses)
        {
            UpdateChildProcesses();
        }

        if (timerTicks < 5)
        {
            timerTicks++;

            if (timerTicks == 5)
            {
                childUpdateTimer.Interval = 60000;
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
                    const string urlPrefix = "URL=steam://rungameid/";
                    string[] lines = File.ReadAllLines(file.FullName);
                    string? urlLine = lines.FirstOrDefault(l => l.StartsWith(urlPrefix, StringComparison.Ordinal));
                    if (urlLine == null)
                    {
                        continue;
                    }

                    string appId = urlLine[urlPrefix.Length..].Trim();
                    steamIds.Add(appId);
                }
                catch (Exception ex)
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

        return headerBytes.SequenceEqual(shortcutSignatureBytes);
    }

    private static bool IsUrlShortcutFile(string filePath)
    {
        byte[] headerBytes = new byte[urlShortcutHeader.Length];
        using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (fileStream.Length < headerBytes.Length)
        {
            return false;
        }

        fileStream.ReadExactly(headerBytes, 0, headerBytes.Length);

        return headerBytes.SequenceEqual(urlShortcutHeader);
    }



    [SupportedOSPlatform("windows")]
    public async Task StartSteamGameAsync(string appId)
    {
        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo($"steam://launch/{appId}")
                {
                    UseShellExecute = true,
                },
            };
            process.Start();
        }
        catch (Exception ex)
        {
            Logger.Error(ex, "Error starting steam game with appid {0}", appId);
        }

        string? appDirPath = GetPathWithAppId(appId);
        if (appDirPath == null)
        {
            return;
        }


        const int retryLimit = 10;
        for (int i = 0; i < retryLimit; i++)
        {

            Process[] processes = Process.GetProcesses();
            Process? foundProcess = processes.FirstOrDefault(p =>
            {
                try
                {
                    return !p.HasExited &&
                           p.MainModule?.FileName != null &&
                           p.MainModule.FileName.StartsWith(appDirPath, StringComparison.OrdinalIgnoreCase);
                }
                catch
                {
                    return false;
                }
            });
            if (foundProcess?.MainModule?.FileName == null)
            {
                await Task.Delay(1000);
                continue;
            }

            string processPath = foundProcess.MainModule.FileName;
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Found process for appid {0}: {1} (PID: {2})", appId, processPath, foundProcess.Id);
            lock (startedProcesses)
            {
                startedProcesses.Add(processPath, [foundProcess.Id]);
            }

            return;
        }
        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Failed to find process for appid {0} after starting. Steam may have failed to launch the game or it may have taken too long to start.", appId);
    }

    [SupportedOSPlatform("windows")]
    private static string? GetPathWithAppId(string appId)
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
        catch
        {

        }

        if (steamPath == null)
        {
            try
            {
                using RegistryKey? key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
                if (key?.GetValue("SteamPath") is string path)
                {
                    steamPath = path.Replace("/", "\\");
                }
            }
            catch
            {

            }
        }

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

        var libraryFolders = new List<string>();
        foreach (string line in File.ReadLines(libraryFoldersVdfPath))
        {
            if (!line.Contains("\"path\""))
            {
                continue;
            }

            string[] parts = line.Split("\t");
            if (parts.Length < 4)
            {
                continue;
            }

            string basePath = parts[4].Replace("\"", "").Replace(@"\\", @"\");
            string path = Path.Join(basePath, @"steamapps");
            if (Directory.Exists(path))
            {
                libraryFolders.Add(path);
            }
        }

        foreach (string libraryPath in libraryFolders)
        {
            string[] appManifestFiles = Directory.GetFiles(libraryPath, "appmanifest_*.acf");
            foreach (string file in appManifestFiles)
            {
                try
                {
                    string acf = File.ReadAllText(file);
                    Match idMatch = MyRegex().Match(acf);
                    Match dirMatch = MyRegex1().Match(acf);
                    if (!idMatch.Success || !dirMatch.Success)
                    {
                        continue;
                    }

                    string foundAppId = idMatch.Groups[1].Value;
                    if (!string.Equals(foundAppId, appId, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    string fullPath = Path.Join(libraryPath, "common", dirMatch.Groups[1].Value);
                    if (Directory.Exists(fullPath))
                    {
                        return fullPath;
                    }
                }
                catch
                {

                }
            }
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Could not find install dir for appid {0}", appId);
        return null;
    }

    [GeneratedRegex(@"""appid""\s+""(\d+)""")]
    private static partial Regex MyRegex();
    [GeneratedRegex(@"""installdir""\s+""([^""]+)""")]
    private static partial Regex MyRegex1();
}
