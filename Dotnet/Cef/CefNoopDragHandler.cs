using CefSharp;
using CefSharp.Enums;

namespace VRCX;

internal sealed class CefNoopDragHandler : IDragHandler
{
    public bool OnDragEnter(IWebBrowser chromiumWebBrowser, IBrowser browser, IDragData dragData, DragOperationsMask mask) => true;

    void IDragHandler.OnDraggableRegionsChanged(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IList<DraggableRegion> regions)
    {
    }
}
