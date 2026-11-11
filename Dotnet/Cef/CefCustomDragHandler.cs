using CefSharp;
using CefSharp.Enums;

namespace VRCX.Cef;

internal sealed class CefCustomDragHandler : IDragHandler
{
    public bool OnDragEnter(IWebBrowser chromiumWebBrowser, IBrowser browser, IDragData dragData, DragOperationsMask mask)
    {
        if (dragData.IsFile && dragData.FilePaths != null && dragData.FilePaths.Count > 0)
        {
            string file = dragData.FilePaths[0];
            if (!file.EndsWith(".png", StringComparison.Ordinal) && !file.EndsWith(".jpg", StringComparison.Ordinal) && !file.EndsWith(".jpeg", StringComparison.Ordinal))
            {
                dragData.Dispose();
                return true;
            }

            if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading && MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
            {
                MainForm.Instance.Browser.ExecuteScriptAsync("window?.$pinia?.vrcx.dragEnterCef", file);
            }

            dragData.Dispose();
            return false;
        }

        dragData.Dispose();
        return true;
    }

    public void OnDraggableRegionsChanged(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IList<DraggableRegion> regions)
    {

    }
}
