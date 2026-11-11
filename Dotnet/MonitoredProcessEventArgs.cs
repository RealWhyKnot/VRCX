namespace VRCX;

internal sealed class MonitoredProcessEventArgs(MonitoredProcess monitoredProcess) : EventArgs
{
    public MonitoredProcess MonitoredProcess { get; } = monitoredProcess;
}
