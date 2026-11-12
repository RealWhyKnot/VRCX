using CefSharp;
using VRCX.Database;

namespace VRCX.Cef;

internal static class JavascriptBindings
{
    public static void ApplyAppJavascriptBindings(IJavascriptObjectRepository repository)
    {
        repository.NameConverter = new BridgeNameConverter();
        Register(repository, "AppApi", Program.AppApiInstance ?? throw new InvalidOperationException("The application API is not initialized."));
        Register(repository, "WebApi", WebApi.Instance);
        Register(repository, "VRCXStorage", VRCXStorage.Instance);
        Register(repository, "DatabaseApi", DatabaseApi.Instance);
        Register(repository, "LogWatcher", LogWatcher.Instance);
        Register(repository, "Discord", Discord.Instance);
        Register(repository, "AssetBundleManager", AssetBundleManager.Instance);
    }

    private static void Register(IJavascriptObjectRepository repository, string name, object target)
    {
        BindingOptions options = BindingOptions.DefaultBinder;
        options.MethodInterceptor = new BridgeMethodInterceptor(target.GetType());
        repository.Register(name, target, options);
    }
}
