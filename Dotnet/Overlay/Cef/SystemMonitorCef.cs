using System.Diagnostics;
using NLog;

namespace VRCX;

internal sealed class SystemMonitorCef
{
    public static readonly SystemMonitorCef Instance;
    public float CpuUsage;
    public double UpTime;
    private bool _enabled;
    private PerformanceCounter? _performanceCounterCpuUsage;
    private PerformanceCounter? _performanceCounterUpTime;
    private Thread? _thread;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    static SystemMonitorCef()
    {
        Instance = new SystemMonitorCef();
    }

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
        }

        _performanceCounterCpuUsage?.Dispose();
        _performanceCounterCpuUsage = null;
        _performanceCounterUpTime?.Dispose();
        _performanceCounterUpTime = null;
    }

    private void StartThread()
    {
        Exit();

        try
        {
            _performanceCounterCpuUsage = new PerformanceCounter(
                "Processor Information",
                "% Processor Utility",
                "_Total",
readOnly: true
            );
            _performanceCounterCpuUsage?.NextValue();
        }
        catch (Exception ex)
        {
            Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, $"Failed to create \"Processor Utility\" PerformanceCounter ${ex}");
        }


        if (_performanceCounterCpuUsage == null)
        {
            try
            {
                _performanceCounterCpuUsage = new PerformanceCounter(
                    "Processor",
                    "% Processor Time",
                    "_Total",
readOnly: true
                );
                _performanceCounterCpuUsage?.NextValue();
            }
            catch (Exception ex)
            {
                Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, $"Failed to create \"Processor Time\" PerformanceCounter ${ex}");
            }
        }

        try
        {
            _performanceCounterUpTime = new PerformanceCounter("System", "System Up Time");
            _performanceCounterUpTime?.NextValue();
        }
        catch
        {
            Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Failed to create \"System Up Time\" PerformanceCounter");
        }

        if (_performanceCounterCpuUsage == null &&
            _performanceCounterUpTime == null)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Failed to create any PerformanceCounter");
            return;
        }
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "SystemMonitor started");

        _thread = new Thread(ThreadProc)
        {
            IsBackground = true,
        };
        _thread.Start();
    }

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
        }
        catch (Exception ex)
        {
            Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, $"SystemMonitor thread exception: {ex}");
        }

        Exit();
    }
}
