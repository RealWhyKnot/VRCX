using System.Diagnostics;

namespace VRCX;

internal sealed class MonitoredProcess
{
    public MonitoredProcess(Process process)
    {
        Process = process;
        ProcessName = process.ProcessName;

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
        ProcessName = process.ProcessName;
        IsRunning = true;
    }
}
