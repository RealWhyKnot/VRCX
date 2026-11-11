using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using NLog;
using VRCX.IPC;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public virtual void Init()
    {
    }

    protected static readonly JsonSerializerSettings JsonSerializerSettings = new()
    {
        Error = delegate (object? _, Newtonsoft.Json.Serialization.ErrorEventArgs args)
        {
            args.ErrorContext.Handled = true;
        },
    };

    public virtual int GetColourFromUserID(string userId)
    {
        byte[] hash = CryptographicOperations.HashData(HashAlgorithmName.MD5, Encoding.UTF8.GetBytes(userId));
        return (hash[3] << 8) | hash[4];
    }

    public virtual void OpenLink(string url)
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
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException)
        {
            Logger.Error(CultureInfo.InvariantCulture, "Failed to open link: {url}", url);
        }
    }

    public virtual void OpenDiscordProfile(string discordId)
    {
        if (!long.TryParse(discordId, CultureInfo.InvariantCulture, out _))
        {
            throw new FormatException("Invalid user ID");
        }

        string uri = $"discord://-/users/{discordId}";
        Process.Start(new ProcessStartInfo(uri)
        {
            UseShellExecute = true,
        });
    }

    public virtual void OpenSteamStorePage(int appId)
    {
        Process.Start(new ProcessStartInfo($"steam://openurl/https://store.steampowered.com/app/{appId}/")
        {
            UseShellExecute = true,
        });
    }

    public virtual string? GetLaunchCommand()
    {
        string? command = StartupArgs.LaunchArguments.LaunchCommand;
        StartupArgs.LaunchArguments.LaunchCommand = string.Empty;
        return command;
    }

    public virtual void IPCAnnounceStart()
    {
        IPCServer.Send(new IPCPacket
        {
            Type = "VRCXLaunch",
            MsgType = "VRCXLaunch",
        });
    }

    public virtual void SendIpc(string type, string data)
    {
        IPCServer.Send(new IPCPacket
        {
            Type = "VrcxMessage",
            MsgType = type,
            Data = data,
        });
    }

    public virtual string CustomCss()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "custom.css");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }

    public virtual string CustomScript()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "custom.js");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }

    public virtual string CurrentCulture()
    {
        string culture = CultureInfo.CurrentCulture.ToString();
        if (string.IsNullOrEmpty(culture))
        {
            culture = "en-US";
        }

        return culture;
    }

    public virtual string CurrentLanguage() => CultureInfo.InstalledUICulture.Name;

    public virtual string? GetVersion() => Program.Version;

    public virtual bool VrcClosedGracefully() => LogWatcher.Instance.VrcClosedGracefully;

    public IDictionary<string, int> GetColourBulk(object[] userIds)
    {
        var output = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (string userId in userIds.Cast<string>())
        {
            output.Add(userId, GetColourFromUserID(userId));
        }

        return output;
    }

    public virtual void SetAppLauncherSettings(bool enabled, bool killOnExit, bool runProcessOnce)
    {
        AutoAppLaunchManager.Instance.Enabled = enabled;
        AutoAppLaunchManager.Instance.KillChildrenOnExit = killOnExit;
        AutoAppLaunchManager.Instance.RunProcessOnce = runProcessOnce;
    }

    public virtual string? GetFileBase64(string path) => File.Exists(path) ? Convert.ToBase64String(File.ReadAllBytes(path)) : null;

    public virtual Task<bool> TryOpenInstanceInVrcAsync(string launchLink, CancellationToken cancellationToken = default) => VRCIPC.SendAsync(launchLink, cancellationToken);

    internal void OpenLink(Uri url) => OpenLink(url.AbsoluteUri);
}
