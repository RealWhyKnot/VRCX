namespace VRCX;

internal sealed class MonitoredProcessEventArgs : EventArgs
{
    public MonitoredProcessEventArgs(MonitoredProcess monitoredProcess)
    {
        MonitoredProcess = monitoredProcess;
    }

    public MonitoredProcess MonitoredProcess { get; }
}
