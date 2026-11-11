using NLog;
using VRCX.Cef;

namespace VRCX.Overlay.Cef;

internal static class OverlayProgram
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static VRCXVRInterface? VRCXVRInstance;

    public static VRCXVRInterface RequireVrInstance() =>
        VRCXVRInstance ?? throw new InvalidOperationException("VRCX VR overlay instance has not been created yet.");

    public static void OverlayMain()
    {
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay starting...");
        CefService.Init();
        AppApiVr.Instance = new AppApiVrCef();
        bool isLegacy = string.Equals(VRCXStorage.Instance.Get("VRCX_DisableVrOverlayGpuAcceleration"), "true", StringComparison.Ordinal);
        VRCXVRInstance = new VRCXVRCef(isLegacy);
        VRCXVRInstance.Init();

        OverlayClient.Init();

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay started...");
        _ = QuitProcessAsync(CancellationToken.None);
        ApplicationConfiguration.Initialize();
        using var context = new ApplicationContext();
        Application.Run(context);
        Exit();
    }

    private static void Exit()
    {
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX Overlay exiting...");

        OverlayClient.Exit();
        RequireVrInstance().Shutdown();
        Environment.Exit(0);
    }

    private static async Task QuitProcessAsync(CancellationToken cancellationToken)
    {
        await Task.Delay(5000, cancellationToken);
        while (Program.LaunchDebug ?
                   OverlayClient.Connected :
                   OverlayClient.ConnectedAndActive)
        {
            await Task.Delay(500, cancellationToken);
        }
        Exit();
    }
}
