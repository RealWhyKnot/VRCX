using Timer = System.Timers.Timer;
using System.Diagnostics;
using System.Timers;
using NLog;

namespace VRCX;










internal sealed class ProcessMonitor
{
    private readonly Dictionary<string, MonitoredProcess> monitoredProcesses;
    private readonly Timer monitorProcessTimer;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    static ProcessMonitor()
    {
        Instance = new ProcessMonitor();
        Instance.ProcessStarted += Program.AppApiInstance.OnProcessStateChanged;
        Instance.ProcessExited += Program.AppApiInstance.OnProcessStateChanged;
    }

    public ProcessMonitor()
    {
        monitoredProcesses = [];

        monitorProcessTimer = new Timer
        {
            Interval = 1000,
        };
        monitorProcessTimer.Elapsed += MonitorProcessTimer_Elapsed;
    }

    public static ProcessMonitor Instance { get; private set; }




    public event Action<MonitoredProcess> ProcessStarted;




    public event Action<MonitoredProcess> ProcessExited;

    public void Init()
    {
        AddProcess("vrchat");
        AddProcess("vrserver");
        monitorProcessTimer.Start();
    }

    public void Exit()
    {
        monitorProcessTimer.Stop();
        monitoredProcesses.Values.ToList().ForEach(x => x.ProcessExited());
    }

    private void MonitorProcessTimer_Elapsed(object sender, ElapsedEventArgs e)
    {
        var processesNeedingUpdate = new List<MonitoredProcess>();


        foreach (KeyValuePair<string, MonitoredProcess> keyValuePair in monitoredProcesses)
        {
            MonitoredProcess monitoredProcess = keyValuePair.Value;

            if (monitoredProcess.IsRunning)
            {
                if (monitoredProcess.Process == null || WinApi.HasProcessExited(monitoredProcess.Process.Id))
                {
                    monitoredProcess.ProcessExited();
                    ProcessExited?.Invoke(monitoredProcess);
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
            ProcessStarted?.Invoke(monitoredProcess);
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Monitored process {monitoredProcess.ProcessName} (PID: {process.Id}) started.");
        }
    }







    public bool IsProcessRunning(string processName, bool ensureCheck = false)
    {
        processName = processName.ToLowerInvariant();
        if (!monitoredProcesses.TryGetValue(processName, out MonitoredProcess? process))
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
        string processName = process.ProcessName.ToLowerInvariant();
        if (monitoredProcesses.ContainsKey(processName))
        {
            return;
        }

        monitoredProcesses.Add(processName, new MonitoredProcess(process));
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Added process {processName} to process monitor.");
    }





    public void AddProcess(string processName)
    {
        processName = processName.ToLowerInvariant();
        if (monitoredProcesses.ContainsKey(processName))
        {
            return;
        }

        monitoredProcesses.Add(processName, new MonitoredProcess(processName));
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Added process {processName} to process monitor.");
    }





    public void RemoveProcess(string processName)
    {
        processName = processName.ToLowerInvariant();
        monitoredProcesses.Remove(processName);
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, $"Removed process {processName} from process monitor.");
    }
}

public sealed class MonitoredProcess
{
    public MonitoredProcess(Process process)
    {
        Process = process;
        ProcessName = process.ProcessName.ToLowerInvariant();

        if (!WinApi.HasProcessExited(process.Id))
        {
            IsRunning = true;
        }
    }

    public MonitoredProcess(string processName)
    {
        ProcessName = processName;
        IsRunning = false;
    }

    public Process? Process { get; private set; }
    public string ProcessName { get; private set; }
    public bool IsRunning { get; private set; }

    public bool HasName(string processName) => ProcessName.Equals(processName, StringComparison.OrdinalIgnoreCase);

    public void ProcessExited()
    {
        IsRunning = false;
        Process?.Dispose();
        Process = null;
    }

    public void ProcessStarted(Process process)
    {
        Process = process;
        ProcessName = process.ProcessName.ToLowerInvariant();
        IsRunning = true;
    }
}
