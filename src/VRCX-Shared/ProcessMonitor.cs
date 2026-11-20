using System.Diagnostics;
using System.Timers;
using NLog;
using Timer = System.Timers.Timer;

namespace VRCX;

internal sealed class ProcessMonitor : IDisposable
{
    private const string VrchatProcessName = "VRChat";
    private const int PollIdle = 0;
    private const int PollActive = 1;
    private const int PollStopped = 2;
    private readonly Dictionary<string, MonitoredProcess> _monitoredProcesses = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<int, MonitoredProcess> _vrchatProcesses = [];
    private readonly Timer _monitorProcessTimer;
    private volatile bool _isVrchatRunning;
    private int _pollState;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    static ProcessMonitor()
    {
        Instance = new ProcessMonitor();
        if (Program.AppApiInstance is { } appApi)
        {
            Instance.ProcessStateChanged += (_, e) => appApi.OnProcessStateChanged(e.MonitoredProcess);
        }
    }

    public ProcessMonitor()
    {
        _monitorProcessTimer = new Timer
        {
            Interval = 1000,
        };
        _monitorProcessTimer.Elapsed += MonitorProcessTimer_Elapsed;
    }

    public static ProcessMonitor Instance { get; private set; }

    public event EventHandler<MonitoredProcessEventArgs>? ProcessStarted;

    public event EventHandler<MonitoredProcessEventArgs>? ProcessExited;

    private event EventHandler<MonitoredProcessEventArgs>? ProcessStateChanged;

    public void Init()
    {
        AddProcess("vrserver");
        _monitorProcessTimer.Start();
    }

    public void Exit()
    {
        _monitorProcessTimer.Stop();
        if (Interlocked.Exchange(ref _pollState, PollStopped) == PollIdle)
        {
            ClearMonitoredProcesses();
        }
    }

    private void ClearMonitoredProcesses()
    {
        _monitoredProcesses.Values.ToList().ForEach(process => process.ProcessExited());
        _vrchatProcesses.Values.ToList().ForEach(process => process.ProcessExited());
        _vrchatProcesses.Clear();
        _isVrchatRunning = false;
    }

    private void MonitorProcessTimer_Elapsed(object? sender, ElapsedEventArgs e)
    {
        if (Interlocked.CompareExchange(ref _pollState, PollActive, PollIdle) != PollIdle)
        {
            return;
        }

        try
        {
            if (_monitorProcessTimer.Enabled)
            {
                PollOtherProcesses();
                PollVrchatProcesses();
            }
        }
        finally
        {
            if (Interlocked.CompareExchange(ref _pollState, PollIdle, PollActive) == PollStopped)
            {
                ClearMonitoredProcesses();
            }
        }
    }

    private void PollVrchatProcesses()
    {
        Process[] processes = Process.GetProcessesByName(VrchatProcessName);
        HashSet<int> processIds = [.. processes.Select(process => process.Id)];
        foreach ((int processId, MonitoredProcess monitoredProcess) in _vrchatProcesses.ToArray())
        {
            if (processIds.Contains(processId) && !WinApi.HasProcessExited(processId))
            {
                continue;
            }

            _vrchatProcesses.Remove(processId);
            _isVrchatRunning = _vrchatProcesses.Count > 0;
            ReportProcessExited(monitoredProcess, !_isVrchatRunning);
        }

        foreach (Process process in processes)
        {
            int processId = process.Id;
            if (_vrchatProcesses.ContainsKey(processId))
            {
                process.Dispose();
                continue;
            }

            var monitoredProcess = new MonitoredProcess(process);
            if (!monitoredProcess.IsRunning)
            {
                monitoredProcess.ProcessExited();
                continue;
            }

            bool didGameStart = _vrchatProcesses.Count == 0;
            _vrchatProcesses.Add(processId, monitoredProcess);
            _isVrchatRunning = true;
            ReportProcessStarted(monitoredProcess, didGameStart);
        }
    }

    private void PollOtherProcesses()
    {
        var processesNeedingUpdate = new List<MonitoredProcess>();

        foreach (KeyValuePair<string, MonitoredProcess> keyValuePair in _monitoredProcesses)
        {
            MonitoredProcess monitoredProcess = keyValuePair.Value;

            if (monitoredProcess.IsRunning)
            {
                if (monitoredProcess.Process == null || WinApi.HasProcessExited(monitoredProcess.Process.Id))
                {
                    ReportProcessExited(monitoredProcess);
                }
            }
            else
            {
                processesNeedingUpdate.Add(monitoredProcess);
            }
        }

        if (processesNeedingUpdate.Count == 0)
        {
            return;
        }

        Process[] processes = Process.GetProcesses();
        foreach (MonitoredProcess monitoredProcess in processesNeedingUpdate)
        {
            Process? process = processes.FirstOrDefault(p => string.Equals(p.ProcessName, monitoredProcess.ProcessName, StringComparison.OrdinalIgnoreCase));

            if (process == null || WinApi.HasProcessExited(process.Id))
            {
                continue;
            }

            monitoredProcess.ProcessStarted(process);
            ReportProcessStarted(monitoredProcess);
        }
    }

    private void ReportProcessStarted(MonitoredProcess monitoredProcess, bool notifySubscribers = true)
    {
        var args = new MonitoredProcessEventArgs(monitoredProcess);
        ProcessStateChanged?.Invoke(this, args);
        if (notifySubscribers)
        {
            ProcessStarted?.Invoke(this, args);
        }

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Monitored process {monitoredProcess.ProcessName} (PID: {monitoredProcess.ProcessId}) started.");
    }

    private void ReportProcessExited(MonitoredProcess monitoredProcess, bool notifySubscribers = true)
    {
        monitoredProcess.ProcessExited();
        var args = new MonitoredProcessEventArgs(monitoredProcess);
        ProcessStateChanged?.Invoke(this, args);
        if (notifySubscribers)
        {
            ProcessExited?.Invoke(this, args);
        }

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Monitored process {monitoredProcess.ProcessName} (PID: {monitoredProcess.ProcessId}) exited.");
    }

    public bool IsProcessRunning(string processName, bool ensureCheck = false)
    {
        return string.Equals(processName, VrchatProcessName, StringComparison.OrdinalIgnoreCase)
            ? _isVrchatRunning || (ensureCheck && HasProcess(processName))
            : _monitoredProcesses.TryGetValue(processName, out MonitoredProcess? process) &&
                (ensureCheck && process.Process == null ? HasProcess(processName) : process.IsRunning);
    }

    private static bool HasProcess(string processName)
    {
        Process[] processes = Process.GetProcessesByName(processName);
        foreach (Process process in processes)
        {
            process.Dispose();
        }

        return processes.Length > 0;
    }

    public void AddProcess(Process process)
    {
        string processName = process.ProcessName;
        if (_monitoredProcesses.ContainsKey(processName))
        {
            return;
        }

        _monitoredProcesses.Add(processName, new MonitoredProcess(process));
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Added process {processName} to process monitor.");
    }

    public void AddProcess(string processName)
    {
        if (_monitoredProcesses.ContainsKey(processName))
        {
            return;
        }

        _monitoredProcesses.Add(processName, new MonitoredProcess(processName));
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Added process {processName} to process monitor.");
    }

    public void RemoveProcess(string processName)
    {
        _monitoredProcesses.Remove(processName);
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Removed process {processName} from process monitor.");
    }

    void IDisposable.Dispose() => _monitorProcessTimer.Dispose();
}
