using CefSharp;
using VRCX.Database;

namespace VRCX.Cef;

internal static class JavascriptBindings
{
    public static void ApplyAppJavascriptBindings(IJavascriptObjectRepository repository)
    {
        repository.NameConverter = new BridgeNameConverter();
        repository.Register("AppApi", Program.AppApiInstance);
        repository.Register("WebApi", WebApi.Instance);
        repository.Register("VRCXStorage", VRCXStorage.Instance);
        repository.Register("DatabaseApi", DatabaseApi.Instance);
        repository.Register("LogWatcher", LogWatcher.Instance);
        repository.Register("Discord", Discord.Instance);
        repository.Register("AssetBundleManager", AssetBundleManager.Instance);
    }
}
