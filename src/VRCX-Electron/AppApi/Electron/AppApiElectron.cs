using System.ComponentModel;
using System.Diagnostics;
using NLog;

namespace VRCX;

public sealed partial class AppApiElectron : AppApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public override void ShowDevTools()
    {
    }

    public override void SetVR(bool active, bool hmdOverlay, bool wristOverlay, bool menuButton, int overlayHand) => Program.VRCXVRInstance.SetActive(active, hmdOverlay, wristOverlay, menuButton, overlayHand);

    public override void SetZoom(double zoomLevel)
    {
    }

    public override Task<double> GetZoomAsync(CancellationToken cancellationToken = default) => Task.FromResult<double>(1);

    public override void DesktopNotification(string boldText, string text = "", string image = "")
    {
    }

    public override void RestartApplication(bool isUpgrade)
    {
    }

    public override bool CheckForUpdateExe() => false;

    public override void ExecuteVrOverlayFunction(string functionName, string json) => Program.VRCXVRInstance.ExecuteVrOverlayFunction(functionName, json);

    public override void FocusWindow()
    {
    }

    public override void ChangeTheme(int value)
    {
    }

    public override void DoFunny()
    {
    }

    public override string GetClipboard()
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "xclip",
                Arguments = "-o",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            },
        };
        try
        {
            process.Start();
            string output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return output;
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException or IOException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to get clipboard: {ex.Message}");
            return string.Empty;
        }
    }

    public override void SetStartup(bool enabled)
    {
    }

    public override void CopyImageToClipboard(string path)
    {
        if (!File.Exists(path) ||
            (!path.EndsWith(".png", StringComparison.Ordinal) &&
             !path.EndsWith(".jpg", StringComparison.Ordinal) &&
             !path.EndsWith(".jpeg", StringComparison.Ordinal) &&
             !path.EndsWith(".gif", StringComparison.Ordinal) &&
             !path.EndsWith(".bmp", StringComparison.Ordinal) &&
             !path.EndsWith(".webp", StringComparison.Ordinal)))
        {
            return;
        }

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "xclip",
                Arguments = $"-selection clipboard -t image/png -i \"{path}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            },
        };
        try
        {
            process.Start();
            process.WaitForExit();
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to copy image to clipboard: {ex.Message}");
        }
    }

    public override void FlashWindow()
    {
    }

    public override void SetUserAgent()
    {
    }

    public override void SetTrayIconNotification(bool notify)
    {
    }

    public override void OpenCalendarFile(string icsContent)
    {
    }
}
