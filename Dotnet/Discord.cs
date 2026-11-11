using System.Text;
using DiscordRPC;
using NLog;
using Button = DiscordRPC.Button;
using Timer = System.Threading.Timer;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class Discord : IDisposable
{
    private readonly Logger _logger = LogManager.GetCurrentClassLogger();
    public static readonly Discord Instance = new();
    private readonly ReaderWriterLockSlim _lock;
    private readonly Lock _syncRoot = new();
    private readonly RichPresence _presence;
    private DiscordRpcClient? _client;
    private readonly Timer _timer;
    private bool _active;
    private string? _discordAppId;
    private const string VrcxUrl = "https://vrcx.app";

    public Discord()
    {
        _lock = new ReaderWriterLockSlim();
        _presence = new RichPresence();
        _timer = new Timer(TimerCallback, state: null, -1, -1);
    }

    public void Init() => _timer.Change(0, 3000);

    public void Exit()
    {
        lock (_syncRoot)
        {
            _timer.Change(-1, -1);
            _client?.Dispose();
        }
    }

    private void TimerCallback(object? state)
    {
        lock (_syncRoot)
        {
            try
            {
                Update();
            }
            catch (Exception ex) when (ex is InvalidOperationException or IOException or ArgumentException or DiscordRPC.Exceptions.BadPresenceException or DiscordRPC.Exceptions.StringOutOfRangeException or DiscordRPC.Exceptions.UninitializedException)
            {
                _logger.Error(ex, "Error updating Discord Rich Presence {Error}", ex.Message);
            }
        }
    }

    private void Update()
    {
        if (_client == null && _active && !string.IsNullOrEmpty(_discordAppId))
        {
            _client = new DiscordRpcClient(_discordAppId);
            _client.OnReady += (sender, e) =>
            {
                _logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Discord Rich Presence connected: {User}", e.User.DisplayName);
            };
            _client.OnError += (sender, e) =>
            {
                _logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Discord Rich Presence error: {Error}", e.Message);
            };
            _client.OnConnectionFailed += (sender, e) =>
            {
                _logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Discord Rich Presence connection failed: {Error}", e.Type);
            };
            _client.OnConnectionEstablished += (sender, e) =>
            {
                _logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Discord Rich Presence connection established");
            };
            if (!_client.Initialize())
            {
                _client.Dispose();
                _client = null;
            }
        }

        if (_client != null && !_active)
        {
            _client.Dispose();
            _client = null;
        }

        if (_client != null && !_lock.IsWriteLockHeld)
        {
            _lock.EnterReadLock();
            try
            {
                _client.SetPresence(_presence);
            }
            finally
            {
                _lock.ExitReadLock();
            }
            _client.Invoke();
        }
    }

    public bool SetActive(bool active)
    {
        _active = active;
        return _active;
    }

    private static string LimitByteLength(string str, int maxBytesLength)
    {
        if (str == null)
        {
            return string.Empty;
        }

        byte[] bytesArr = Encoding.UTF8.GetBytes(str);
        int bytesToRemove = 0;
        int lastIndexInString = str.Length - 1;
        while (bytesArr.Length - bytesToRemove > maxBytesLength)
        {
            bytesToRemove += Encoding.UTF8.GetByteCount([str[lastIndexInString]]);
            --lastIndexInString;
        }
        return Encoding.UTF8.GetString(bytesArr, 0, bytesArr.Length - bytesToRemove);
    }

    public void SetAssets(
        string details,
        string state,
        string detailsLink,

        string largeKey,
        string largeText,

        string smallKey,
        string smallText,

        double startUnixMilliseconds,
        double endUnixMilliseconds,

        string partyId,
        int partySize,
        int partyMax,
        string buttonText,
        string buttonLink,
        string appId,
        int activityType,
        int statusDisplayType)
    {
        _lock.EnterWriteLock();
        try
        {
            if (string.IsNullOrEmpty(largeKey) &&
                string.IsNullOrEmpty(smallKey))
            {
                _presence.Assets = null;
                _presence.Party = null;
                _presence.Timestamps = null;
                return;
            }

            _presence.Details = LimitByteLength(details, 127);
            _presence.DetailsUrl = !string.IsNullOrEmpty(detailsLink) ? detailsLink : null;
            _presence.State = LimitByteLength(state, 127);

            SetImageAssets(largeKey, largeText, smallKey, smallText);
            SetTimestamps(startUnixMilliseconds, endUnixMilliseconds);
            SetParty(partyId, partySize, partyMax);

            _presence.Type = (ActivityType)activityType;
            _presence.StatusDisplay = (StatusDisplayType)statusDisplayType;

            SetButtons(buttonText, buttonLink);

            if (!string.Equals(_discordAppId, appId, StringComparison.Ordinal))
            {
                _discordAppId = appId;
                _client?.Dispose();
                _client = null;
                Update();
            }
        }
        catch (Exception ex) when (ex is InvalidOperationException or IOException or ArgumentException or DiscordRPC.Exceptions.BadPresenceException or DiscordRPC.Exceptions.StringOutOfRangeException or DiscordRPC.Exceptions.UninitializedException)
        {
            _logger.Error(ex, "Error setting Discord Rich Presence assets: {Error}", ex.Message);
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    private void SetImageAssets(string largeKey, string largeText, string smallKey, string smallText)
    {
        _presence.Assets ??= new Assets();

        _presence.Assets.LargeImageKey = largeKey;
        _presence.Assets.LargeImageText = largeText;
        _presence.Assets.LargeImageUrl = VrcxUrl;

        _presence.Assets.SmallImageKey = smallKey;
        _presence.Assets.SmallImageText = smallText;
    }

    private void SetTimestamps(double startUnixMilliseconds, double endUnixMilliseconds)
    {
        if (startUnixMilliseconds == 0)
        {
            _presence.Timestamps = null;
            return;
        }

        _presence.Timestamps ??= new Timestamps();
        _presence.Timestamps.StartUnixMilliseconds = (ulong)startUnixMilliseconds;
        if (endUnixMilliseconds == 0)
        {
            _presence.Timestamps.End = null;
        }
        else
        {
            _presence.Timestamps.EndUnixMilliseconds = (ulong)endUnixMilliseconds;
        }
    }

    private void SetParty(string partyId, int partySize, int partyMax)
    {
        if (partyMax == 0)
        {
            _presence.Party = null;
            return;
        }

        _presence.Party ??= new Party();
        _presence.Party.ID = partyId;
        _presence.Party.Size = partySize;
        _presence.Party.Max = partyMax;
    }

    private void SetButtons(string buttonText, string buttonLink)
    {
        Button[] buttons = [];
        if (!string.IsNullOrEmpty(buttonLink))
        {
            buttons =
            [
                new Button { Label = buttonText, Url = buttonLink },
            ];
        }
        _presence.Buttons = buttons;
    }


#if LINUX
    public void Dispose()
#else
    void IDisposable.Dispose()
#endif
    {
        lock (_syncRoot)
        {
            _timer.Dispose();
            _client?.Dispose();
            _client = null;
        }
        _lock.Dispose();
    }
}
