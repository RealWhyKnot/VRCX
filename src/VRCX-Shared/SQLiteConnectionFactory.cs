using System.Data.SQLite;

namespace VRCX;

internal static class SQLiteConnectionFactory
{
    private const string Pragmas = "PRAGMA locking_mode=NORMAL;PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA optimize=0x10002;";

    public static SQLiteConnection Open(string dataSource)
    {
        var connection = new SQLiteConnection($"Data Source=\"{dataSource}\";Version=3;", parseViaFramework: true);
        bool isOpen = false;
        try
        {
            connection.Open();
            using var command = new SQLiteCommand(Pragmas, connection);
            _ = command.ExecuteNonQuery();
            isOpen = true;
            return connection;
        }
        finally
        {
            if (!isOpen)
            {
                connection.Dispose();
            }
        }
    }
}
