using CefSharp;

namespace VRCX;

internal static class JavascriptBindings
{
    public static void ApplyAppJavascriptBindings(IJavascriptObjectRepository repository)
    {
        repository.NameConverter = new global::VRCX.Cef.BridgeNameConverter();
        repository.Register("AppApi", Program.AppApiInstance);
        repository.Register("WebApi", WebApi.Instance);
        repository.Register("VRCXStorage", VRCXStorage.Instance);
        repository.Register("SQLite", SQLite.Instance);
        repository.Register("LogWatcher", LogWatcher.Instance);
        repository.Register("Discord", Discord.Instance);
        repository.Register("AssetBundleManager", AssetBundleManager.Instance);
    }
}
