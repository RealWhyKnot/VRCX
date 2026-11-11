namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public void CreateConfigTable() => _ = Run("CREATE TABLE IF NOT EXISTS configs (`key` TEXT PRIMARY KEY, `value` TEXT)");

    public string GetConfigValue(string key) => Rows("SELECT value FROM configs WHERE key = @key", ("@key", key));

    public void SetConfigValue(string key, string value) => _ = Run("INSERT OR REPLACE INTO configs (key, value) VALUES (@key, @value)", ("@key", key), ("@value", value));

    public void RemoveConfigValue(string key) => _ = Run("DELETE FROM configs WHERE key = @key", ("@key", key));
}
