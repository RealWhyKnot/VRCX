namespace VRCX;

internal sealed class VRCXStorage
{
    private readonly Dictionary<string, string> _settings = new(StringComparer.Ordinal);

    public static VRCXStorage Instance { get; } = new();

    public string Get(string key) => _settings.GetValueOrDefault(key, string.Empty);
}
