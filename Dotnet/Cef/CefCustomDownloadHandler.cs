using CefSharp;

namespace VRCX.Cef;

internal sealed class CefCustomDownloadHandler : IDownloadHandler
{
    public bool CanDownload(IWebBrowser chromiumWebBrowser, IBrowser browser, string url, string requestMethod) => true;

    public bool OnBeforeDownload(IWebBrowser chromiumWebBrowser, IBrowser browser, DownloadItem downloadItem, IBeforeDownloadCallback callback)
    {
        if (callback.IsDisposed)
        {
            return true;
        }

        using (callback)
        {
            callback.Continue(
                downloadItem.SuggestedFileName,
                showDialog: true
            );
        }

        return true;
    }

    public void OnDownloadUpdated(IWebBrowser chromiumWebBrowser, IBrowser browser, DownloadItem downloadItem, IDownloadItemCallback callback)
    {
    }
}
