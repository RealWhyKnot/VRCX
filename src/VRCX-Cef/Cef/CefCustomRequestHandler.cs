using System.Globalization;
using System.Security.Cryptography.X509Certificates;
using CefSharp;
using NLog;

namespace VRCX.Cef;

internal sealed class CefCustomRequestHandler : IRequestHandler
{
    private readonly Logger _logger = LogManager.GetCurrentClassLogger();
    private readonly Lock _crashLock = new();
    private readonly RenderProcessCrashPolicy _crashPolicy;
    private readonly string _safeUrl;
    private bool _isReloadingStopped;

    public CefCustomRequestHandler(string startUrl, TimeProvider timeProvider)
    {
        _crashPolicy = new RenderProcessCrashPolicy(timeProvider);
        _safeUrl = RenderProcessCrashPolicy.GetSafeUrl(startUrl);
    }

    public bool OnBeforeBrowse(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IRequest request, bool userGesture, bool isRedirect)
    {
        if (Program.LaunchDebug ||
            request.Url.StartsWith("file://vrcx/", StringComparison.Ordinal) ||
            request.Url.StartsWith("chrome-extension://", StringComparison.Ordinal))
        {
            return false;
        }

        _logger.Error(CultureInfo.InvariantCulture, "Blocking navigation to: {Url}", request.Url);
        return true;
    }

    public void OnDocumentAvailableInMainFrame(IWebBrowser chromiumWebBrowser, IBrowser browser)
    {
    }

    public bool OnOpenUrlFromTab(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, string targetUrl,
        WindowOpenDisposition targetDisposition, bool userGesture)
    {
        _logger.Debug(CultureInfo.InvariantCulture, "Blocking OnOpenUrlFromTab: {TargetUrl}",
            targetUrl);

        return true;
    }

    public IResourceRequestHandler? GetResourceRequestHandler(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame,
        IRequest request, bool isNavigation, bool isDownload, string requestInitiator, ref bool disableDefaultHandling) => null;

    public bool GetAuthCredentials(IWebBrowser chromiumWebBrowser, IBrowser browser, string originUrl, bool isProxy, string host,
        int port, string realm, string scheme, IAuthCallback callback) => false;

    public bool OnCertificateError(IWebBrowser chromiumWebBrowser, IBrowser browser, CefErrorCode errorCode, string requestUrl,
        ISslInfo sslInfo, IRequestCallback callback) => true;

    public bool OnSelectClientCertificate(IWebBrowser chromiumWebBrowser, IBrowser browser, bool isProxy, string host, int port,
        X509Certificate2Collection certificates, ISelectClientCertificateCallback callback) => false;

    public void OnRenderViewReady(IWebBrowser chromiumWebBrowser, IBrowser browser)
    {
    }

    public void OnRenderProcessTerminated(IWebBrowser chromiumWebBrowser, IBrowser browser, CefTerminationStatus status,
        int errorCode, string errorMessage)
    {
        string message = status switch
        {
            CefTerminationStatus.AbnormalTermination => "Browser terminated abnormally.",
            CefTerminationStatus.ProcessWasKilled => "Browser was killed.",
            CefTerminationStatus.ProcessCrashed => "Browser crashed.",
            CefTerminationStatus.OutOfMemory => "Browser out of memory.",
            _ => $"Browser terminated with unhandled status code '{status}'",
        };
        if (browser.IsPopup)
        {
            _logger.Error(CultureInfo.InvariantCulture,
                "Popup render process terminated: {Message} Status: {Status} ErrorCode: {ErrorCode} ErrorMessage: {ErrorMessage} Url: {Url}",
                message, status, errorCode, errorMessage, RenderProcessCrashPolicy.GetLoggableUrl(browser.MainFrame?.Url ?? string.Empty));
            return;
        }

        string currentUrl = chromiumWebBrowser.Address ?? string.Empty;
        RenderProcessRecovery recovery;
        lock (_crashLock)
        {
            recovery = _crashPolicy.RecordCrash();
            _isReloadingStopped = recovery.Action == RenderProcessRecoveryAction.StopReloading;
        }

        _logger.Error(CultureInfo.InvariantCulture,
            "Render process terminated: {Message} Status: {Status} ErrorCode: {ErrorCode} ErrorMessage: {ErrorMessage} Url: {Url} CrashCount: {CrashCount} in {CrashWindow}",
            message, status, errorCode, errorMessage, RenderProcessCrashPolicy.GetLoggableUrl(currentUrl), recovery.CrashCount,
            RenderProcessCrashPolicy.CrashWindow);
        StartupArgs.LaunchArguments.LaunchCommand = $"crash/{message}";

        if (chromiumWebBrowser.IsDisposed || chromiumWebBrowser.IsLoading)
        {
            return;
        }

        if (recovery.Action == RenderProcessRecoveryAction.StopReloading)
        {
            _logger.Error(CultureInfo.InvariantCulture,
                "Render process crashed {CrashCount} times in {CrashWindow}, auto reload stopped until the window is opened again",
                recovery.CrashCount, RenderProcessCrashPolicy.CrashWindow);
            return;
        }

        if (recovery.Delay == TimeSpan.Zero)
        {
            Recover(chromiumWebBrowser, recovery);
            return;
        }

        _ = RecoverAfterDelayAsync(chromiumWebBrowser, recovery, CancellationToken.None);
    }

    public void ResumeIfReloadingStopped(IWebBrowser chromiumWebBrowser)
    {
        lock (_crashLock)
        {
            if (!_isReloadingStopped)
            {
                return;
            }

            _isReloadingStopped = false;
            _crashPolicy.Reset();
        }

        if (chromiumWebBrowser.IsDisposed)
        {
            return;
        }

        _logger.Info(CultureInfo.InvariantCulture, "Window opened after auto reload stopped, loading {Url}", _safeUrl);
        chromiumWebBrowser.LoadUrl(_safeUrl);
    }

    private async Task RecoverAfterDelayAsync(IWebBrowser chromiumWebBrowser, RenderProcessRecovery recovery, CancellationToken cancellationToken)
    {
        _logger.Info(CultureInfo.InvariantCulture, "Waiting {Delay} before recovering the browser", recovery.Delay);
        await Task.Delay(recovery.Delay, cancellationToken);
        Recover(chromiumWebBrowser, recovery);
    }

    private void Recover(IWebBrowser chromiumWebBrowser, RenderProcessRecovery recovery)
    {
        if (chromiumWebBrowser.IsDisposed)
        {
            return;
        }

        if (recovery.Action == RenderProcessRecoveryAction.ReloadCurrentPage)
        {
            _logger.Info(CultureInfo.InvariantCulture, "Attempting to reload browser...");
            chromiumWebBrowser.Reload();
            return;
        }

        _logger.Info(CultureInfo.InvariantCulture, "Loading safe route after repeated crashes: {Url}", _safeUrl);
        chromiumWebBrowser.LoadUrl(_safeUrl);
    }
}
