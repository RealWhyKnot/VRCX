using System.Data.SQLite;

namespace VRCX.ScreenshotMetadata;

internal sealed class ScreenshotMetadataDatabase : IDisposable
{
    private readonly SQLiteConnection _sqlite;

    public ScreenshotMetadataDatabase(string databaseLocation)
    {
        _sqlite = SQLiteConnectionFactory.Open(databaseLocation);
        using var cmd = new SQLiteCommand(_sqlite);
        cmd.CommandText = @"CREATE TABLE IF NOT EXISTS cache (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    file_path TEXT NOT NULL UNIQUE,
                                    metadata TEXT,
                                    cached_at INTEGER NOT NULL
                                );";
        cmd.ExecuteNonQuery();
    }

    public void AddMetadataCache(string filePath, string metadata)
    {
        int isFileCached = IsFileCached(filePath);
        if (isFileCached != -1)
        {
            return;
        }

        var cache = new MetadataCache()
        {
            FilePath = filePath,
            Metadata = metadata,
            CachedAt = DateTimeOffset.Now,
        };
        const string Sql = "INSERT OR REPLACE INTO cache (file_path, metadata, cached_at) VALUES (@FilePath, @Metadata, @CachedAt);";
        using var command = new SQLiteCommand(Sql, _sqlite);
        command.Parameters.AddWithValue("@FilePath", cache.FilePath);
        command.Parameters.AddWithValue("@Metadata", cache.Metadata);
        command.Parameters.AddWithValue("@CachedAt", cache.CachedAt.Ticks);
        command.ExecuteNonQuery();
    }

    public void BulkAddMetadataCache(IEnumerable<MetadataCache> cache)
    {
        using SQLiteTransaction transaction = _sqlite.BeginTransaction();
        using var command = new SQLiteCommand(_sqlite);
        const string Sql = "INSERT OR REPLACE INTO cache (file_path, metadata, cached_at) VALUES (@FilePath, @Metadata, @CachedAt);";
        command.CommandText = Sql;
        SQLiteParameter filePathParam = command.Parameters.Add("@FilePath", System.Data.DbType.String);
        SQLiteParameter metadataParam = command.Parameters.Add("@Metadata", System.Data.DbType.String);
        SQLiteParameter cachedAtParam = command.Parameters.Add("@CachedAt", System.Data.DbType.Int64);
        foreach (MetadataCache item in cache)
        {
            if (item.FilePath is null || IsFileCached(item.FilePath) != -1)
            {
                continue;
            }

            filePathParam.Value = item.FilePath;
            metadataParam.Value = item.Metadata;
            cachedAtParam.Value = item.CachedAt.Ticks;
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    public int IsFileCached(string filePath)
    {
        const string Sql = "SELECT id FROM cache WHERE file_path = @FilePath;";
        using var command = new SQLiteCommand(Sql, _sqlite);
        command.Parameters.AddWithValue("@FilePath", filePath);
        using SQLiteDataReader reader = command.ExecuteReader();
        var result = new List<int>();
        while (reader.Read())
        {
            result.Add(reader.GetInt32(0));
        }
        return result.Count > 0 ? result[0] : -1;
    }

    public string? GetMetadata(string filePath)
    {
        const string Sql = "SELECT id, file_path, metadata, cached_at FROM cache WHERE file_path = @FilePath;";
        using var command = new SQLiteCommand(Sql, _sqlite);
        command.Parameters.AddWithValue("@FilePath", filePath);
        using SQLiteDataReader reader = command.ExecuteReader();
        var result = new List<MetadataCache>();
        while (reader.Read())
        {
            result.Add(ReadMetadataCache(reader));
        }
        return result.Count > 0 ? result[0].Metadata : null;
    }

    public string? GetMetadataById(int id)
    {
        const string Sql = "SELECT id, file_path, metadata, cached_at FROM cache WHERE id = @Id;";
        using var command = new SQLiteCommand(Sql, _sqlite);
        command.Parameters.AddWithValue("@Id", id);
        using SQLiteDataReader reader = command.ExecuteReader();
        var result = new List<MetadataCache>();
        while (reader.Read())
        {
            result.Add(ReadMetadataCache(reader));
        }
        return result.Count > 0 ? result[0].Metadata : null;
    }

    private static MetadataCache ReadMetadataCache(SQLiteDataReader reader) => new()
    {
        Id = reader.GetInt32(0),
        FilePath = reader.GetString(1),
        Metadata = reader.IsDBNull(2) ? null : reader.GetString(2),
        CachedAt = new DateTimeOffset(new DateTime(reader.GetInt64(3))),
    };

    public void Dispose() => _sqlite.Dispose();
}
