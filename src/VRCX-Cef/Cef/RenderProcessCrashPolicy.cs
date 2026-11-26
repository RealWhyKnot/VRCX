namespace VRCX.Cef;

internal sealed class RenderProcessCrashPolicy
{
    internal const string SafeRoute = "#/feed";
    internal static readonly TimeSpan CrashWindow = TimeSpan.FromHours(1);

    private static readonly TimeSpan[] RecoveryDelays =
    [
        TimeSpan.Zero,
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(5),
    ];

    private readonly Queue<DateTimeOffset> _recentCrashes = new();
    private readonly TimeProvider _timeProvider;

    public RenderProcessCrashPolicy(TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
    }

    internal static int MaxRecoveriesInWindow => RecoveryDelays.Length;

    public RenderProcessRecovery RecordCrash()
    {
        DateTimeOffset now = _timeProvider.GetUtcNow();
        while (_recentCrashes.TryPeek(out DateTimeOffset oldest) && now - oldest >= CrashWindow)
        {
            _recentCrashes.Dequeue();
        }

        _recentCrashes.Enqueue(now);
        int crashCount = _recentCrashes.Count;
        if (crashCount > RecoveryDelays.Length)
        {
            return new RenderProcessRecovery(RenderProcessRecoveryAction.StopReloading, TimeSpan.Zero, crashCount);
        }

        RenderProcessRecoveryAction action = crashCount == 1
            ? RenderProcessRecoveryAction.ReloadCurrentPage
            : RenderProcessRecoveryAction.LoadSafeRoute;
        return new RenderProcessRecovery(action, RecoveryDelays[crashCount - 1], crashCount);
    }

    public void Reset() => _recentCrashes.Clear();

    public static string GetSafeUrl(string currentUrl)
    {
        int fragmentStart = currentUrl.IndexOf('#', StringComparison.Ordinal);
        string page = fragmentStart < 0 ? currentUrl : currentUrl[..fragmentStart];
        return page + SafeRoute;
    }

    public static string GetLoggableUrl(string url)
    {
        int queryStart = url.IndexOf('?', StringComparison.Ordinal);
        return queryStart < 0 ? url : url[..queryStart];
    }
}
