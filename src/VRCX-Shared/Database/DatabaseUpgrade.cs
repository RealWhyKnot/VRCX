using System.Globalization;

namespace VRCX.Database;

internal static class DatabaseUpgrade
{
    private const string UpgradedSuffix = "-v2";
    private const string BackupSuffix = "-backup";
    private const string PartialSuffix = ".importing";
    private const int CopyAttempts = 3;

    public static string UpgradedPath(string legacyPath) => WithSuffix(legacyPath, UpgradedSuffix);

    public static string BackupPath(string path) => WithSuffix(path, BackupSuffix);

    public static string Prepare(string legacyPath)
    {
        if (string.IsNullOrEmpty(legacyPath))
        {
            return legacyPath;
        }

        string path = UpgradedPath(legacyPath);
        if (!File.Exists(path) && File.Exists(legacyPath))
        {
            Import(legacyPath, path);
        }

        return path;
    }

    private static string WithSuffix(string path, string suffix)
    {
        string directory = Path.GetDirectoryName(path) ?? string.Empty;
        return Path.Join(directory, $"{Path.GetFileNameWithoutExtension(path)}{suffix}{Path.GetExtension(path)}");
    }

    private static void Import(string legacyPath, string path)
    {
        string partialPath = $"{path}{PartialSuffix}";
        bool isImported = false;
        try
        {
            using var legacy = SQLiteDatabase.OpenReadOnly(legacyPath);
            string? difference = null;
            for (int attempt = 0; attempt < CopyAttempts; attempt++)
            {
                difference = CopyOnce(legacy, partialPath);
                if (difference is null)
                {
                    break;
                }
            }

            if (difference is not null)
            {
                throw new InvalidOperationException($"The database copy does not match the original: {difference}");
            }

            isImported = true;
        }
        finally
        {
            if (!isImported)
            {
                File.Delete(partialPath);
            }
        }

        File.Move(partialPath, path);
    }

    private static string? CopyOnce(SQLiteDatabase legacy, string partialPath)
    {
        Dictionary<string, long> expected = RowCounts(legacy);
        legacy.BackupTo(partialPath);
        using var copy = SQLiteDatabase.OpenReadOnly(partialPath);
        return FirstDifference(expected, RowCounts(copy));
    }

    private static Dictionary<string, long> RowCounts(SQLiteDatabase database)
    {
        object[][] tables = database.Execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
        var counts = new Dictionary<string, long>(tables.Length, StringComparer.Ordinal);
        foreach (object[] table in tables)
        {
            string name = Convert.ToString(table[0], CultureInfo.InvariantCulture) ?? string.Empty;
            string quoted = name.Replace("\"", "\"\"", StringComparison.Ordinal);
            object[][] rows = database.Execute($"SELECT COUNT(*) FROM \"{quoted}\"");
            counts[name] = Convert.ToInt64(rows[0][0], CultureInfo.InvariantCulture);
        }

        return counts;
    }

    private static string? FirstDifference(Dictionary<string, long> expected, Dictionary<string, long> actual)
    {
        if (expected.Count != actual.Count)
        {
            return $"{expected.Count} tables became {actual.Count}";
        }

        foreach ((string name, long rows) in expected)
        {
            if (!actual.TryGetValue(name, out long copied) || copied != rows)
            {
                return $"a table with {rows} rows was not copied in full";
            }
        }

        return null;
    }
}
