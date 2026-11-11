using System.ComponentModel;
using System.Diagnostics;
using CefSharp;
using CefSharp.DevTools;
using Microsoft.Toolkit.Uwp.Notifications;
using Microsoft.Win32;
using NLog;
using VRCX.Cef;
using VRCX.OverlayWebSocket;

namespace VRCX;

internal sealed partial class AppApiCef : AppApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    private static MainForm MainWindow => MainForm.Instance ?? throw new InvalidOperationException("The main window is not initialized.");

    public override void ShowDevTools() => MainWindow.Browser.ShowDevTools();

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
        OverlayServer.UpdateVars(updateVars);
    }

    public override void SetZoom(double zoomLevel) => MainWindow.Browser.SetZoomLevel(zoomLevel);

    public override async Task<double> GetZoomAsync(CancellationToken cancellationToken = default) => await MainWindow.Browser.GetZoomLevelAsync().WaitAsync(cancellationToken);

    public override void DesktopNotification(string boldText, string text = "", string image = "")
    {
        try
        {
            var builder = new ToastContentBuilder();

            if (Uri.TryCreate(image, UriKind.Absolute, out Uri? uri))
            {
                builder.AddAppLogoOverride(uri);
            }

            if (!string.IsNullOrEmpty(boldText))
            {
                builder.AddText(boldText);
            }

            if (!string.IsNullOrEmpty(text))
            {
                builder.AddText(text);
            }

            builder.Show();
        }
        catch (AccessViolationException ex)
        {
            Logger.Warn(ex, System.Globalization.CultureInfo.InvariantCulture, "Unable to send desktop notification");
        }
        catch (Exception ex) when (ex is InvalidOperationException or UnauthorizedAccessException or ArgumentException or System.Runtime.InteropServices.COMException)
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Unknown error when sending desktop notification");
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

        using var vrcxProcess = new Process
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

    public override void ExecuteVrOverlayFunction(string functionName, string json)
    {
        var message = new OverlayMessage
        {
            Type = OverlayMessageType.JsFunctionCall,
            FunctionName = functionName,
            Data = json,
        };
        OverlayServer.SendMessage(message);
    }

    public override void FocusWindow() => MainWindow.Invoke(new Action(MainWindow.Focus_Window));

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
        catch (Exception e) when (e is UnauthorizedAccessException or IOException or System.Security.SecurityException or ArgumentException)
        {
            Logger.Warn(e, System.Globalization.CultureInfo.InvariantCulture, "Failed to set startup");
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

        MainWindow.BeginInvoke(new MethodInvoker(() =>
        {
            using var image = Image.FromFile(path);

            var data = new DataObject();
            data.SetData(DataFormats.Bitmap, image);
            data.SetFileDropList([path]);
            Clipboard.SetDataObject(data, copy: true);
        }));
    }

    public override void FlashWindow() => MainWindow.BeginInvoke(new MethodInvoker(() => { WinformThemer.Flash(MainWindow); }));

    public override void SetUserAgent() => _ = SetUserAgentAsync(CancellationToken.None);

    private static async Task SetUserAgentAsync(CancellationToken cancellationToken)
    {
        using DevToolsClient client = MainWindow.Browser.GetDevToolsClient();
        _ = await client.Network.SetUserAgentOverrideAsync(Program.Version ?? string.Empty).WaitAsync(cancellationToken).ConfigureAwait(false);
    }

    public override void SetTrayIconNotification(bool notify) => MainWindow.BeginInvoke(new MethodInvoker(() => { MainWindow.SetTrayIconNotification(notify); }));

    public override void OpenCalendarFile(string icsContent)
    {
        if (!icsContent.StartsWith("BEGIN:VCALENDAR", StringComparison.Ordinal) ||
            !icsContent.EndsWith("END:VCALENDAR", StringComparison.Ordinal))
        {
            throw new InvalidDataException("Invalid calendar file");
        }

        try
        {
            string tempPath = Path.Join(Program.AppDataDirectory, "event.ics");
            File.WriteAllText(tempPath, icsContent);
            Process.Start(new ProcessStartInfo
            {
                FileName = tempPath,
                UseShellExecute = true,
            })?.Dispose();
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException or IOException or UnauthorizedAccessException or NotSupportedException)
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to open calendar file");
        }
    }
}
