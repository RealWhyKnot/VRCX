using CefSharp;

namespace VRCX.Cef;

internal sealed class CefCustomMenuHandler : IContextMenuHandler
{
    public void OnBeforeContextMenu(IWebBrowser browserControl, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model)
    {
        if (!browser.IsSame(MainForm.Instance?.Browser.GetBrowser()))
        {

            return;
        }

        if (!Program.LaunchDebug &&
            !parameters.TypeFlags.HasFlag(ContextMenuType.Selection) &&
            !parameters.TypeFlags.HasFlag(ContextMenuType.Editable))
        {
            model.Clear();
        }
    }

    public bool OnContextMenuCommand(IWebBrowser browserControl, IBrowser browser, IFrame frame, IContextMenuParams parameters, CefMenuCommand commandId, CefEventFlags eventFlags) => false;

    public void OnContextMenuDismissed(IWebBrowser browserControl, IBrowser browser, IFrame frame)
    {
    }

    public bool RunContextMenu(IWebBrowser browserControl, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model, IRunContextMenuCallback callback) => false;
}
