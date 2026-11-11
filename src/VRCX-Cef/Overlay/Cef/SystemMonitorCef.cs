using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using NLog;

namespace VRCX.Overlay.Cef;

internal sealed class SystemMonitorCef : IDisposable
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static readonly SystemMonitorCef Instance = new();
    public float CpuUsage;
    public double UpTime;
    private bool _enabled;
    private PerformanceCounter? _performanceCounterCpuUsage;
    private PerformanceCounter? _performanceCounterUpTime;
    private Thread? _thread;

    public void Start(bool enabled)
    {
        if (enabled == _enabled)
        {
            return;
        }

        _enabled = enabled;
        if (enabled)
        {
            StartThread();
        }
        else
        {
            Exit();
        }
    }

    public void Dispose() => Exit();

    internal void Exit()
    {
        CpuUsage = 0;
        UpTime = 0;
        try
        {
            if (_thread != null)
            {
                _thread.Interrupt();
                _thread.Join();
                _thread = null;
            }
        }
        catch (ThreadInterruptedException)
        {
            Logger.Debug(CultureInfo.InvariantCulture, "SystemMonitor thread interrupted during exit");
        }

        _performanceCounterCpuUsage?.Dispose();
        _performanceCounterCpuUsage = null;
        _performanceCounterUpTime?.Dispose();
        _performanceCounterUpTime = null;
    }

    private void StartThread()
    {
        Exit();

        _performanceCounterCpuUsage = TryCreateCounter("Processor Information", "% Processor Utility", "_Total", "Processor Utility")
            ?? TryCreateCounter("Processor", "% Processor Time", "_Total", "Processor Time");
        _performanceCounterUpTime = TryCreateCounter("System", "System Up Time", instanceName: null, "System Up Time");

        if (_performanceCounterCpuUsage == null &&
            _performanceCounterUpTime == null)
        {
            Logger.Error(CultureInfo.InvariantCulture, "Failed to create any PerformanceCounter");
            return;
        }

        Logger.Info(CultureInfo.InvariantCulture, "SystemMonitor started");

        _thread = new Thread(ThreadProc)
        {
            IsBackground = true,
        };
        _thread.Start();
    }

    private static PerformanceCounter? TryCreateCounter(string category, string counterName, string? instanceName, string label)
    {
        try
        {
            PerformanceCounter counter = instanceName == null
                ? new PerformanceCounter(category, counterName)
                : new PerformanceCounter(category, counterName, instanceName, readOnly: true);
            counter.NextValue();
            return counter;
        }
        catch (Exception ex) when (IsPerformanceCounterFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"Failed to create \"{label}\" PerformanceCounter {ex}");
            return null;
        }
    }

    private static bool IsPerformanceCounterFailure(Exception exception) =>
        exception is InvalidOperationException or UnauthorizedAccessException or Win32Exception or PlatformNotSupportedException or ArgumentException;

    private void ThreadProc()
    {
        try
        {
            while (_enabled)
            {
                if (_performanceCounterCpuUsage != null)
                {
                    CpuUsage = _performanceCounterCpuUsage.NextValue();
                }

                if (_performanceCounterUpTime != null)
                {
                    UpTime = TimeSpan.FromSeconds(_performanceCounterUpTime.NextValue()).TotalMilliseconds;
                }

                Thread.Sleep(1000);
            }
        }
        catch (ThreadInterruptedException)
        {
            Logger.Debug(CultureInfo.InvariantCulture, "SystemMonitor thread interrupted");
        }
        catch (Exception ex) when (IsPerformanceCounterFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"SystemMonitor thread exception: {ex}");
        }

        Exit();
    }
}
