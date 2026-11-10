using NLog;

namespace VRCX.Overlay;

internal static class OverlayProgram
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static VRCXVRInterface? VRCXVRInstance;

    public static void OverlayMain()
    {
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay starting...");
        CefService.Instance.Init();
        AppApiVr.Instance = new AppApiVrCef();
        bool isLegacy = string.Equals(VRCXStorage.Instance.Get("VRCX_DisableVrOverlayGpuAcceleration"), "true", StringComparison.Ordinal);
        VRCXVRInstance = new VRCXVRCef(isLegacy);
        VRCXVRInstance.Init();

        OverlayClient.InitAsync();

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay started...");
        QuitProcessAsync();
        ApplicationConfiguration.Initialize();
        var context = new ApplicationContext();
        Application.Run(context);
        Exit();
    }

    private static void Exit()
    {
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay exiting...");

        OverlayClient.ExitAsync();
        VRCXVRInstance.Exit();
        Environment.Exit(0);
    }

    private static async Task QuitProcessAsync()
    {
        await Task.Delay(5000);
        while (Program.LaunchDebug ?
                   OverlayClient.Connected :
                   OverlayClient.ConnectedAndActive)
        {
            await Task.Delay(500);
        }
        Exit();
    }
}
