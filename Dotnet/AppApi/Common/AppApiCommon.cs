using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using NLog;

namespace VRCX;

public partial class AppApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public void Init()
    {
    }

    public JsonSerializerSettings JsonSerializerSettings = new()
    {
        Error = delegate (object _, Newtonsoft.Json.Serialization.ErrorEventArgs args)
        {
            args.ErrorContext.Handled = true;
        },
    };

    public int GetColourFromUserID(string userId)
    {
        using var hasher = MD5.Create();
        byte[] hash = hasher.ComputeHash(Encoding.UTF8.GetBytes(userId));
        return (hash[3] << 8) | hash[4];
    }

    public void OpenLink(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? uri))
        {
            return;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.Ordinal) &&
!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.Ordinal))
        {
            return;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = uri.AbsoluteUri,
                UseShellExecute = true,
            };
            Process.Start(psi);
        }
        catch
        {
            Logger.Error(CultureInfo.InvariantCulture, "Failed to open link: {url}", url);
        }
    }

    public void OpenDiscordProfile(string discordId)
    {
        if (!long.TryParse(discordId, CultureInfo.InvariantCulture, out _))
        {
            throw new Exception("Invalid user ID");
        }

        string uri = $"discord://-/users/{discordId}";
        Process.Start(new ProcessStartInfo(uri)
        {
            UseShellExecute = true,
        });
    }

    public void OpenSteamStorePage(int appId)
    {
        Process.Start(new ProcessStartInfo($"steam://openurl/https://store.steampowered.com/app/{appId}/")
        {
            UseShellExecute = true,
        });
    }

    public string GetLaunchCommand()
    {
        string command = StartupArgs.LaunchArguments.LaunchCommand;
        StartupArgs.LaunchArguments.LaunchCommand = string.Empty;
        return command;
    }

    public void IPCAnnounceStart()
    {
        IPCServer.Send(new IPCPacket
        {
            Type = "VRCXLaunch",
            MsgType = "VRCXLaunch",
        });
    }

    public void SendIpc(string type, string data)
    {
        IPCServer.Send(new IPCPacket
        {
            Type = "VrcxMessage",
            MsgType = type,
            Data = data,
        });
    }

    public string CustomCss()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "custom.css");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }

    public string CustomScript()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "custom.js");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }

    public string CurrentCulture()
    {
        string culture = CultureInfo.CurrentCulture.ToString();
        if (string.IsNullOrEmpty(culture))
        {
            culture = "en-US";
        }

        return culture;
    }

    public string CurrentLanguage() => CultureInfo.InstalledUICulture.Name;

    public string GetVersion() => Program.Version;

    public bool VrcClosedGracefully() => LogWatcher.Instance.VrcClosedGracefully;

    public Dictionary<string, int> GetColourBulk(List<object> userIds)
    {
        var output = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (string userId in userIds.Cast<string>())
        {
            output.Add(userId, GetColourFromUserID(userId));
        }

        return output;
    }

    public void SetAppLauncherSettings(bool enabled, bool killOnExit, bool runProcessOnce)
    {
        AutoAppLaunchManager.Instance.Enabled = enabled;
        AutoAppLaunchManager.Instance.KillChildrenOnExit = killOnExit;
        AutoAppLaunchManager.Instance.RunProcessOnce = runProcessOnce;
    }

    public string GetFileBase64(string path) => File.Exists(path) ? Convert.ToBase64String(File.ReadAllBytes(path)) : null;

    public virtual Task<bool> TryOpenInstanceInVrcAsync(string launchUrl) => IPC.VRCIPC.SendAsync(launchUrl);

    public void OpenLink(Uri url) => OpenLink(url.AbsoluteUri);

    public virtual Task<bool> TryOpenInstanceInVrcAsync(Uri launchUrl) => TryOpenInstanceInVrcAsync(launchUrl.AbsoluteUri);
}
