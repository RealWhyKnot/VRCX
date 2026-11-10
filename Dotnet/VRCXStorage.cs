using System.Collections.Concurrent;
using System.Text.Json;
using Timer = System.Threading.Timer;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class VRCXStorage
{
    public static readonly VRCXStorage Instance;

    private static ConcurrentDictionary<string, string> _storage = new(StringComparer.Ordinal);
    private static readonly string JsonPath = Path.Join(Program.AppDataDirectory, "VRCX.json");

    private static readonly TimeSpan SaveDebounce = TimeSpan.FromMilliseconds(500);
    private static readonly Timer SaveTimer;
    private static readonly Lock SaveLock = new();

    static VRCXStorage()
    {
        Instance = new VRCXStorage();
        SaveTimer = new Timer(_ => Instance.Save(), state: null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
    }

    public void Load()
    {
        var tmp = new Dictionary<string, string>(StringComparer.Ordinal);
        JsonFileSerializer.Deserialize(JsonPath, ref tmp);
        _storage = new ConcurrentDictionary<string, string>(tmp, StringComparer.Ordinal);
    }

    public void Save()
    {
        lock (SaveLock)
        {
            var snapshot = new Dictionary<string, string>(_storage, StringComparer.Ordinal);
            JsonFileSerializer.Serialize(JsonPath, snapshot);
        }
    }

    public void Clear()
    {
        if (!_storage.IsEmpty)
        {
            _storage.Clear();
            ScheduleSave();
        }
    }

    public bool Remove(string key)
    {
        bool result = _storage.TryRemove(key, out _);
        if (result)
        {
            ScheduleSave();
        }

        return result;
    }

    public string Get(string key) => _storage.TryGetValue(key, out string? value) ? value : string.Empty;

    public void Set(string key, string value)
    {
        _storage[key] = value;
        ScheduleSave();
    }

    public string GetAll() => JsonSerializer.Serialize(new Dictionary<string, string>(_storage, StringComparer.Ordinal));

    private static void ScheduleSave() => SaveTimer.Change(SaveDebounce, Timeout.InfiniteTimeSpan);
}
