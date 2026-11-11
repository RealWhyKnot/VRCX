using System.Data.SQLite;
using System.Globalization;
using System.Text.RegularExpressions;
using NLog;

namespace DBMerger;

internal sealed partial class Merger
{

    private const string JSDateTimeFormat = "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fffzzz";

    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly Regex UserIdPattern = UserIDRegex();

    private List<string> _unMergedTables = [];

    private readonly SQLiteConnection _dbConn;
    private readonly string _oldDBName;
    private readonly string _newDBName;
    private readonly Config _config;

    public Merger(SQLiteConnection dbConn, string oldDBName, string newDBName, Config config)
    {
        _dbConn = dbConn;
        _oldDBName = oldDBName;
        _newDBName = newDBName;
        _config = config;
    }

    public void Merge()
    {
        Logger.Info(CultureInfo.InvariantCulture, "Starting merge process...");

        Logger.Debug(CultureInfo.InvariantCulture, "Creating transaction for databases");
        SQLiteTransaction transaction = _dbConn.BeginTransaction();
        try
        {
            MergeInternal();

            Logger.Debug(CultureInfo.InvariantCulture, "Committing changes to database");
            transaction.Commit();
        }
        catch
        {
            Logger.Warn(CultureInfo.InvariantCulture, "Encountered error! Rolling back changes to databases");
            transaction.Rollback();

            throw;
        }
        finally
        {
            transaction.Dispose();
        }

        Logger.Info(CultureInfo.InvariantCulture, "Optimizing database size...");
        SqliteExtensions.ExecuteNonQuery(_dbConn, "VACUUM new_db;");
        Logger.Info(CultureInfo.InvariantCulture, "Merge completed without any major issues!");
    }

    private void MergeInternal()
    {
        _unMergedTables = SqliteExtensions.ReadStrings(_dbConn, $"SELECT name FROM {_oldDBName}.sqlite_schema WHERE type='table';");

        _unMergedTables.Remove("cookies");

        _unMergedTables.RemoveAll(table => table.StartsWith("sqlite_", StringComparison.Ordinal));

        Logger.Info(CultureInfo.InvariantCulture, "Creating tables not present on new database that are present on old database...");
        var newDBTables = SqliteExtensions.ReadStrings(_dbConn, $"SELECT name FROM {_newDBName}.sqlite_schema WHERE type='table';").ToHashSet(StringComparer.Ordinal);
        for (int i = 0; i < _unMergedTables.Count; i++)
        {
            string table = _unMergedTables[i];
            if (newDBTables.Contains(table) || string.Equals(table, "configs", StringComparison.Ordinal))
            {
                continue;
            }
            _unMergedTables.RemoveAt(i);
            i--;

            Logger.Info(CultureInfo.InvariantCulture, $"Adding table: {table}...");
            string createQuery = SqliteExtensions.ReadScalarString(_dbConn, $"SELECT sql FROM {_oldDBName}.sqlite_schema WHERE type='table' AND name=@p0;", table) ?? throw new InvalidDataException("Table definition is missing.");

            createQuery = createQuery[..13] + _newDBName + "." + createQuery[13..];
            Logger.Debug(CultureInfo.InvariantCulture, $"Using command: {createQuery}");
            SqliteExtensions.ExecuteNonQuery(_dbConn, createQuery);

            Logger.Debug(CultureInfo.InvariantCulture, "Addings rows to table");
            SqliteExtensions.ExecuteNonQuery(_dbConn, $"INSERT INTO {_newDBName}.{table} SELECT * FROM {_oldDBName}.{table};");
        }

        Logger.Info(CultureInfo.InvariantCulture, "Merging memos into new database...");
        MergeMemos();

        Logger.Info(CultureInfo.InvariantCulture, "Merging favorites into new database...");
        MergeFavorites();

        Logger.Info(CultureInfo.InvariantCulture, "Merging avatar and world cache into new database...");
        MergeCaches();

        Logger.Info(CultureInfo.InvariantCulture, "Merging gamelog into new database...");
        MergeGamelog();

        Logger.Info(CultureInfo.InvariantCulture, "Merging user feed tables into new database...");
        MergeUsers();

        if (_config.ImportConfig)
        {
            Logger.Info(CultureInfo.InvariantCulture, "Importing _config from old database...");
            ImportConfig();
        }
        else
        {
            _unMergedTables.Remove("configs");
        }
        ResetDatabaseVersion();

        foreach (string table in _unMergedTables)
        {
            Logger.Warn(CultureInfo.InvariantCulture, "Found unmerged table: " + table);
        }
    }

    private void MergeMemos()
    {
        MergeTable(
            table => table.EndsWith("memos", StringComparison.Ordinal),
            [0],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new memo");
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing memo");

                var oldDateTime = DateTime.Parse(ReadText(old[1]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[1]), CultureInfo.InvariantCulture);
                DateTime updatedDateTime = oldDateTime > newDateTime ? oldDateTime : newDateTime;
                old[1] = updatedDateTime.ToString(JSDateTimeFormat, CultureInfo.InvariantCulture);

                old[2] = existing[2] == old[2] || ReadText(existing[2]).EndsWith(ReadText(old[2]), StringComparison.Ordinal)
                    ? existing[2] : old[2] + "\n" + existing[2];

                return old;
            }
        );
    }

    private void MergeFavorites()
    {
        MergeTable(
            table => string.Equals(table, "favorite_print", StringComparison.Ordinal),
            [1, 2],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new print favorite");
                    old[0] = null;
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing print favorite");

                var oldDateTime = DateTime.Parse(ReadText(old[2]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[2]), CultureInfo.InvariantCulture);
                DateTime updatedDateTime = oldDateTime < newDateTime ? oldDateTime : newDateTime;
                existing[2] = updatedDateTime;

                return existing;
            }
        );

        MergeTable(
            table => table.StartsWith("favorite_", StringComparison.Ordinal) && !string.Equals(table, "favorite_print", StringComparison.Ordinal),
            [2, 3],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new favorite");
                    old[0] = null;
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing favorite");

                var oldDateTime = DateTime.Parse(ReadText(old[1]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[1]), CultureInfo.InvariantCulture);
                DateTime updatedDateTime = oldDateTime < newDateTime ? oldDateTime : newDateTime;
                existing[1] = updatedDateTime;

                return existing;
            }
        );
    }

    private void MergeCaches()
    {
        MergeTable(
            table => table.StartsWith("cache_", StringComparison.Ordinal),
            [0],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new cache entry");
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing cache entry");

                var oldDateTime = DateTime.Parse(ReadText(old[1]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[1]), CultureInfo.InvariantCulture);

                return oldDateTime > newDateTime ? old : existing;
            }
        );
    }

    private void MergeGamelog()
    {

        MergeTable(
            table => table.StartsWith("gamelog_", StringComparison.Ordinal) && !string.Equals(table, "gamelog_join_leave", StringComparison.Ordinal),

            [1, 2],

            (old, existing) =>
            {
                if (existing != null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Determined these rows to be the same: ");
                    Logger.Trace(CultureInfo.InvariantCulture, string.Join(", ", old));
                    Logger.Trace(CultureInfo.InvariantCulture, string.Join(", ", existing));
                }
                old[0] = null;

                return existing ?? old;
            },
            table => SortTable(_dbConn, _newDBName, table, 1)
        );

        MergeTable(
            table => string.Equals(table, "gamelog_join_leave", StringComparison.Ordinal),
            [1, 3],
            (old, existing) =>
            {
                if (existing != null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Determined these rows to be the same: ");
                    Logger.Trace(CultureInfo.InvariantCulture, string.Join(", ", old));
                    Logger.Trace(CultureInfo.InvariantCulture, string.Join(", ", existing));
                }
                old[0] = null;
                return existing ?? old;
            },
            table => SortTable(_dbConn, _newDBName, table, 1)
        );
    }

    private void ImportConfig()
    {
        _unMergedTables.Remove("configs");

        SqliteExtensions.ExecuteNonQuery(
            _dbConn,
            $"INSERT OR REPLACE INTO {_newDBName}.configs " +
                $"SELECT * FROM {_oldDBName}.configs " +
                    "WHERE key!=@p0;",
            "_config:savedcredentials"
        );
    }

    private void ResetDatabaseVersion()
    {

        SqliteExtensions.ExecuteNonQuery(
            _dbConn,
            $"INSERT OR REPLACE INTO {_newDBName}.configs VALUES (@p0, 0)",
            "_config:vrcx_databaseversion"
        );
    }

    private void MergeTable(
        Predicate<string> tableMatcher,
        int[] colIndicesToMatch,
        Func<object?[], object?[]?, object?[]> rowTransformer,
        Action<string>? finalizer = null
    )
    {
        for (int i = 0; i < _unMergedTables.Count; i++)
        {

            string table = _unMergedTables[i];
            if (!tableMatcher(table))
            {
                continue;
            }
            _unMergedTables.RemoveAt(i);
            i--;

            Logger.Debug(CultureInfo.InvariantCulture, $"Merging table `{table}` into new database");

            List<string> colNames = GetTableColumnNames(_dbConn, _newDBName, table);

            string valuesClause = string.Join(',', Enumerable.Range(0, colNames.Count).Select(index => $"@p{index}"));
            string insertQuery = $"INSERT INTO {_newDBName}.{table} VALUES ({valuesClause});";

            string whereClause = string.Join(" AND ", colIndicesToMatch.Select((columnIndex, parameterIndex) => colNames[columnIndex] + $"=@p{parameterIndex}"));
            string existsQuery = $"DELETE FROM {_newDBName}.{table} WHERE {whereClause} RETURNING *;";

            using SQLiteCommand rowsCommand = SqliteExtensions.CreateCommand(_dbConn, $"SELECT * FROM {_oldDBName}.{table};");
            using SQLiteDataReader rowsReader = rowsCommand.ExecuteReader();
            while (rowsReader.Read())
            {
                object?[] oldRow = new object?[rowsReader.FieldCount];
                for (int columnIndex = 0; columnIndex < rowsReader.FieldCount; columnIndex++)
                {
                    oldRow[columnIndex] = rowsReader.IsDBNull(columnIndex) ? null : rowsReader.GetValue(columnIndex);
                }

                object?[] colsToMatch = [.. colIndicesToMatch.Select(columnIndex => oldRow[columnIndex])];
                object?[]? existingRow = SqliteExtensions.ReadFirstRow(_dbConn, existsQuery, colsToMatch);

                object?[] newRow = rowTransformer(oldRow, existingRow);
                if (newRow.Length < colNames.Count)
                {

                    object?[] temp = new object?[colNames.Count];
                    newRow.CopyTo(temp, 0);
                    newRow = temp;
                }
                using SQLiteCommand insertCommand = SqliteExtensions.CreateCommand(_dbConn, insertQuery, newRow);
                insertCommand.ExecuteNonQuery();
            }

            finalizer?.Invoke(table);
        }
    }

    private static List<string> GetTableColumnNames(SQLiteConnection conn, string db, string table)
        => SqliteExtensions.ReadStrings(conn, "SELECT name FROM pragma_table_info(@p0, @p1);", table, db);

    private static void SortTable(SQLiteConnection conn, string db, string table, int sortCol, bool isDesc = false)
    {
        Logger.Debug(CultureInfo.InvariantCulture, $"Sorting table {db}.{table}");

        long time = DateTime.Now.Ticks;
        string newTableName = table + time.ToString(CultureInfo.InvariantCulture);
        Logger.Debug(CultureInfo.InvariantCulture, "Creating new table: " + newTableName);

        string createQuery = SqliteExtensions.ReadScalarString(conn, $"SELECT sql FROM {db}.sqlite_schema WHERE type='table' AND name=@p0;", table) ?? throw new InvalidDataException("Table definition is missing.");
        string[] words = createQuery.Split(' ');

        words[2] = db + "." + newTableName;
        createQuery = string.Join(' ', words);

        Logger.Debug(CultureInfo.InvariantCulture, "Creating table with command: " + createQuery);
        SqliteExtensions.ExecuteNonQuery(conn, createQuery);

        Logger.Debug(CultureInfo.InvariantCulture, "Adding rows...");
        List<string> colNames = GetTableColumnNames(conn, db, table);

        string selectClause = string.Join(',', colNames.Skip(1));
        SqliteExtensions.ExecuteNonQuery(
            conn,
            $"INSERT INTO {db}.{newTableName} ({selectClause}) " +
                $"SELECT {selectClause} FROM {db}.{table} " +
                    $"ORDER BY {colNames[sortCol]} {(isDesc ? "DESC" : "ASC")};"
        );

        Logger.Debug(CultureInfo.InvariantCulture, "Dropping old and renaming");
        SqliteExtensions.ExecuteNonQuery(conn, $"DROP TABLE {db}.{table}");
        SqliteExtensions.ExecuteNonQuery(conn, $"ALTER TABLE {db}.{newTableName} RENAME TO {table}");
    }

    private static string ReadText(object? value) => value as string ?? throw new InvalidDataException("Database value is not text.");

    [GeneratedRegex("^([A-Za-z0-9]{10}|usr[0-9A-Fa-f]{32})", RegexOptions.ExplicitCapture, 1000)]
    private static partial Regex UserIDRegex();
}
