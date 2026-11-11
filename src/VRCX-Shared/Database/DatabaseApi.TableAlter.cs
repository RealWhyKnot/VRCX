using System.Data.SQLite;
using System.Globalization;
using NLog;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public void UpdateTableForGroupNames()
    {
        string[] tables = TableNames("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_gps' OR name LIKE '%_feed_online_offline' OR name = 'gamelog_location'");
        RunAll(tables.Select(tableName => $"ALTER TABLE {tableName} ADD group_name TEXT DEFAULT ''"), "duplicate column name");
        RunAll(["ALTER TABLE gamelog_location DROP COLUMN groupName"], "no such column");
    }

    public void AddFriendLogFriendNumberColumn() => RunAll(TableNames("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_current' OR name LIKE '%_friend_log_history'").Select(tableName => $"ALTER TABLE {tableName} ADD friend_number INTEGER DEFAULT 0"), "duplicate column name");

    public void AddAvatarHistoryTimeColumn() => RunAll(TableNames("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_avatar_history'").Select(tableName => $"ALTER TABLE {tableName} ADD time INTEGER DEFAULT 0"), "duplicate column name");

    public void AddFriendLogHistoryUserIdIndexes() => RunAll(TableNames("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'").Select(tableName => $"CREATE INDEX IF NOT EXISTS {tableName}_user_id_idx ON {tableName} (user_id)"), expectedMessage: null);

    public void AddFeedBioLinkColumns()
    {
        string[] tables = TableNames("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_bio'");
        foreach (string tableName in tables)
        {
            RunAll([$"ALTER TABLE {tableName} ADD bio_links TEXT DEFAULT '[]'", $"ALTER TABLE {tableName} ADD previous_bio_links TEXT DEFAULT '[]'"], "duplicate column name");
        }
    }

    private string[] TableNames(string sql) => [.. Store.Execute(sql).Select(row => Convert.ToString(row[0], CultureInfo.InvariantCulture) ?? string.Empty)];

    private void RunAll(IEnumerable<string> statements, string? expectedMessage)
    {
        foreach (string statement in statements)
        {
            try
            {
                _ = Run(statement);
            }
            catch (SQLiteException error)
            {
                if (expectedMessage is null || !error.Message.Contains(expectedMessage, StringComparison.Ordinal))
                {
                    Logger.Error(error, CultureInfo.InvariantCulture, "Database table upgrade step failed");
                }
            }
        }
    }
}
