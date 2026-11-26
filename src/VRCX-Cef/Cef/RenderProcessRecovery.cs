namespace VRCX.Cef;

internal sealed record RenderProcessRecovery(RenderProcessRecoveryAction Action, TimeSpan Delay, int CrashCount);
