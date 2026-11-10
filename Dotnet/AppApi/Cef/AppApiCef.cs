using System.Diagnostics;
using CefSharp;
using CefSharp.DevTools;
using Microsoft.Toolkit.Uwp.Notifications;
using Microsoft.Win32;
using NLog;

namespace VRCX;

public sealed partial class AppApiCef : AppApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();




    public override void ShowDevTools() => MainForm.Instance.Browser.ShowDevTools();

    public override void SetVR(bool active, bool hmdOverlay, bool wristOverlay, bool menuButton, int overlayHand)
    {
        var updateVars = new OverlayVars
        {
            Active = active,
            HmdOverlay = hmdOverlay,
            WristOverlay = wristOverlay,
            MenuButton = menuButton,
            OverlayHand = overlayHand,
        };
        OverlayServer.Instance.UpdateVars(updateVars);
    }

    public override void SetZoom(double zoomLevel) => MainForm.Instance.Browser.SetZoomLevel(zoomLevel);

    public override async Task<double> GetZoomAsync() => await MainForm.Instance.Browser.GetZoomLevelAsync();

    public override void DesktopNotification(string BoldText, string Text = "", string Image = "")
    {
        try
        {
            var builder = new ToastContentBuilder();

            if (Uri.TryCreate(Image, UriKind.Absolute, out Uri uri))
            {
                builder.AddAppLogoOverride(uri);
            }

            if (!string.IsNullOrEmpty(BoldText))
            {
                builder.AddText(BoldText);
            }

            if (!string.IsNullOrEmpty(Text))
            {
                builder.AddText(Text);
            }

            builder.Show();
        }
        catch (AccessViolationException ex)
        {
            Logger.Warn(ex, "Unable to send desktop notification");
        }
        catch (Exception ex)
        {
            Logger.Error(ex, "Unknown error when sending desktop notification");
        }
    }

    public override void RestartApplication(bool isUpgrade)
    {
        var args = new List<string>();

        if (isUpgrade)
        {
            args.Add(StartupArgs.VrcxLaunchArguments.IsUpgradePrefix);
        }

        if (StartupArgs.LaunchArguments.IsDebug)
        {
            args.Add(StartupArgs.VrcxLaunchArguments.IsDebugPrefix);
        }

        if (!string.IsNullOrWhiteSpace(StartupArgs.LaunchArguments.ConfigDirectory))
        {
            args.Add($"{StartupArgs.VrcxLaunchArguments.ConfigDirectoryPrefix}={StartupArgs.LaunchArguments.ConfigDirectory}");
        }

        if (!string.IsNullOrWhiteSpace(StartupArgs.LaunchArguments.ProxyUrl))
        {
            args.Add($"{StartupArgs.VrcxLaunchArguments.ProxyUrlPrefix}={StartupArgs.LaunchArguments.ProxyUrl}");
        }

        var vrcxProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = Path.Join(Program.BaseDirectory, "VRCX.exe"),
                Arguments = string.Join(' ', args),
                UseShellExecute = true,
                WorkingDirectory = Program.BaseDirectory,
            },
        };
        vrcxProcess.Start();
        Environment.Exit(0);
    }

    public override bool CheckForUpdateExe() => File.Exists(Path.Join(Program.AppDataDirectory, "update.exe"));

    public override void ExecuteVrOverlayFunction(string function, string json)
    {
        var message = new OverlayMessage
        {
            Type = OverlayMessageType.JsFunctionCall,
            FunctionName = function,
            Data = json,
        };
        OverlayServer.Instance.SendMessage(message);
    }

    public override void FocusWindow() => MainForm.Instance.Invoke(new Action(MainForm.Instance.Focus_Window));

    public override void ChangeTheme(int value) => WinformThemer.SetGlobalTheme(value);

    public override void DoFunny() => WinformThemer.DoFunny();

    public override string GetClipboard()
    {
        string clipboard = string.Empty;
        var thread = new Thread(() => clipboard = Clipboard.GetText());
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return clipboard;
    }

    public override void SetStartup(bool enabled)
    {
        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", writable: true);
            if (key == null)
            {
                Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Failed to open startup registry key");
                return;
            }

            if (enabled)
            {
                string path = Application.ExecutablePath;
                key.SetValue("VRCX", $"\"{path}\" --startup");
            }
            else
            {
                key.DeleteValue("VRCX", throwOnMissingValue: false);
            }
        }
        catch (Exception e)
        {
            Logger.Warn(e, "Failed to set startup");
        }
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

        MainForm.Instance.BeginInvoke(new MethodInvoker(() =>
        {
            var image = Image.FromFile(path);

            var data = new DataObject();
            data.SetData(DataFormats.Bitmap, image);
            data.SetFileDropList([path]);
            Clipboard.SetDataObject(data, copy: true);
        }));
    }

    public override void FlashWindow() => MainForm.Instance.BeginInvoke(new MethodInvoker(() => { WinformThemer.Flash(MainForm.Instance); }));

    public override void SetUserAgent()
    {
        using DevToolsClient client = MainForm.Instance.Browser.GetDevToolsClient();
        _ = client.Network.SetUserAgentOverrideAsync(Program.Version);
    }

    public override void SetTrayIconNotification(bool notify) => MainForm.Instance.BeginInvoke(new MethodInvoker(() => { MainForm.Instance.SetTrayIconNotification(notify); }));

    public override void OpenCalendarFile(string icsContent)
    {

        if (!icsContent.StartsWith("BEGIN:VCALENDAR", StringComparison.Ordinal) ||
            !icsContent.EndsWith("END:VCALENDAR", StringComparison.Ordinal))
        {
            throw new Exception("Invalid calendar file");
        }

        try
        {
            string tempPath = Path.Combine(Program.AppDataDirectory, "event.ics");
            File.WriteAllText(tempPath, icsContent);
            Process.Start(new ProcessStartInfo
            {
                FileName = tempPath,
                UseShellExecute = true,
            })?.Dispose();
        }
        catch (Exception ex)
        {
            Logger.Error(ex, "Failed to open calendar file");
        }
    }
}
