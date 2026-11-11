using System.Globalization;
using NLog;

namespace VRCX.Overlay.Electron;

internal sealed class SystemMonitorElectron
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static readonly SystemMonitorElectron Instance = new();
    private bool _enabled;
    private long _lastTotalTime;
    private long _lastIdleTime;
    private bool _firstReading = true;
    private Thread? _thread;

    public float CpuUsage { get; private set; }

    public double UpTime { get; private set; }

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
        _firstReading = true;
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
    }

    private void StartThread()
    {
        Exit();

        try
        {
            ReadCpuInfo();
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Error(CultureInfo.InvariantCulture, $"Failed to initialize CPU monitoring: {ex}");
            return;
        }

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
                UpdateMetrics();
                Thread.Sleep(1000);
            }
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"SystemMonitor thread exception: {ex}");
        }

        Exit();
    }

    private static bool IsReadFailure(Exception exception) =>
        exception is IOException or UnauthorizedAccessException or NotSupportedException or FormatException or OverflowException or InvalidOperationException or ArgumentException;

    private void UpdateMetrics()
    {
        try
        {
            CpuUsage = GetCpuUsage();
            UpTime = GetUptime();
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"Error updating metrics: {ex}");
        }
    }

    private float GetCpuUsage()
    {
        try
        {
            (long TotalTime, long IdleTime)? cpuInfo = ReadCpuInfo();
            if (cpuInfo == null)
            {
                return 0;
            }

            long totalTime = cpuInfo.Value.TotalTime;
            long idleTime = cpuInfo.Value.IdleTime;

            if (_firstReading)
            {
                _lastTotalTime = totalTime;
                _lastIdleTime = idleTime;
                _firstReading = false;
                return 0;
            }

            long totalTimeDiff = totalTime - _lastTotalTime;
            long idleTimeDiff = idleTime - _lastIdleTime;

            if (totalTimeDiff > 0)
            {
                float cpuUsage = 100.0f * (1.0f - ((float)idleTimeDiff / totalTimeDiff));
                _lastTotalTime = totalTime;
                _lastIdleTime = idleTime;

                return Math.Max(0, Math.Min(100, cpuUsage));
            }

            return 0;
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"Error reading CPU usage: {ex}");
            return 0;
        }
    }

    private static double GetUptime()
    {
        try
        {
            string uptimeContent = File.ReadAllText("/proc/uptime");
            string[] parts = uptimeContent.Split(' ');
            if (parts.Length > 0 && double.TryParse(parts[0], CultureInfo.InvariantCulture, out double uptimeSeconds))
            {
                return TimeSpan.FromSeconds(uptimeSeconds).TotalMilliseconds;
            }
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"Error reading uptime: {ex}");
        }

        return 0;
    }

    private static (long TotalTime, long IdleTime)? ReadCpuInfo()
    {
        try
        {
            string statContent = File.ReadAllText("/proc/stat");
            string[] lines = statContent.Split('\n');

            foreach (string line in lines)
            {
                if (line.StartsWith("cpu ", StringComparison.Ordinal))
                {
                    string[] parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 5)
                    {
                        long user = long.Parse(parts[1], CultureInfo.InvariantCulture);
                        long nice = long.Parse(parts[2], CultureInfo.InvariantCulture);
                        long system = long.Parse(parts[3], CultureInfo.InvariantCulture);
                        long idle = long.Parse(parts[4], CultureInfo.InvariantCulture);
                        long iowait = parts.Length > 5 ? long.Parse(parts[5], CultureInfo.InvariantCulture) : 0;
                        long irq = parts.Length > 6 ? long.Parse(parts[6], CultureInfo.InvariantCulture) : 0;
                        long softirq = parts.Length > 7 ? long.Parse(parts[7], CultureInfo.InvariantCulture) : 0;
                        long steal = parts.Length > 8 ? long.Parse(parts[8], CultureInfo.InvariantCulture) : 0;

                        long totalTime = user + nice + system + idle + iowait + irq + softirq + steal;
                        return (totalTime, idle);
                    }
                }
            }
        }
        catch (Exception ex) when (IsReadFailure(ex))
        {
            Logger.Warn(CultureInfo.InvariantCulture, $"Error reading /proc/stat: {ex}");
        }

        return null;
    }
}
