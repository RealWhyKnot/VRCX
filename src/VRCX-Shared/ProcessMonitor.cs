using System.Diagnostics;
using System.Timers;
using NLog;
using Timer = System.Timers.Timer;

namespace VRCX;

internal sealed class ProcessMonitor : IDisposable
{
    private readonly Dictionary<string, MonitoredProcess> _monitoredProcesses = new(StringComparer.OrdinalIgnoreCase);
    private readonly Timer _monitorProcessTimer;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    static ProcessMonitor()
    {
        Instance = new ProcessMonitor();
        if (Program.AppApiInstance is { } appApi)
        {
            Instance.ProcessStarted += (_, e) => appApi.OnProcessStateChanged(e.MonitoredProcess);
            Instance.ProcessExited += (_, e) => appApi.OnProcessStateChanged(e.MonitoredProcess);
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

    public void Init()
    {
        AddProcess("vrchat");
        AddProcess("vrserver");
        _monitorProcessTimer.Start();
    }

    public void Exit()
    {
        _monitorProcessTimer.Stop();
        _monitoredProcesses.Values.ToList().ForEach(x => x.ProcessExited());
    }

    private void MonitorProcessTimer_Elapsed(object? sender, ElapsedEventArgs e)
    {
        var processesNeedingUpdate = new List<MonitoredProcess>();

        foreach (KeyValuePair<string, MonitoredProcess> keyValuePair in _monitoredProcesses)
        {
            MonitoredProcess monitoredProcess = keyValuePair.Value;

            if (monitoredProcess.IsRunning)
            {
                if (monitoredProcess.Process == null || WinApi.HasProcessExited(monitoredProcess.Process.Id))
                {
                    monitoredProcess.ProcessExited();
                    ProcessExited?.Invoke(this, new MonitoredProcessEventArgs(monitoredProcess));
                    Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Monitored process {monitoredProcess.ProcessName} (PID: {monitoredProcess.Process?.Id.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "null"}) exited.");
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
            ProcessStarted?.Invoke(this, new MonitoredProcessEventArgs(monitoredProcess));
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Monitored process {monitoredProcess.ProcessName} (PID: {process.Id}) started.");
        }
    }

    public bool IsProcessRunning(string processName, bool ensureCheck = false)
    {
        if (!_monitoredProcesses.TryGetValue(processName, out MonitoredProcess? process))
        {
            return false;
        }

        if (ensureCheck && process.Process == null)
        {
            Process[] processes = Process.GetProcessesByName(processName);
            bool isProcessRunning = processes.Length > 0;
            foreach (Process proc in processes)
            {
                proc.Dispose();
            }

            return isProcessRunning;
        }

        return process.IsRunning;
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
