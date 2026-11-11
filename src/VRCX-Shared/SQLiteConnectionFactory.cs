using System.Data.SQLite;

namespace VRCX;

internal static class SQLiteConnectionFactory
{
    private const string Pragmas = "PRAGMA locking_mode=NORMAL;PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA optimize=0x10002;";

    public static SQLiteConnection Open(string dataSource)
    {
        SQLiteConnection connection = OpenConnection($"Data Source=\"{dataSource}\";Version=3;");
        bool isReady = false;
        try
        {
            using var command = new SQLiteCommand(Pragmas, connection);
            _ = command.ExecuteNonQuery();
            isReady = true;
            return connection;
        }
        finally
        {
            if (!isReady)
            {
                connection.Dispose();
            }
        }
    }

    public static SQLiteConnection OpenReadOnly(string dataSource) => OpenConnection($"Data Source=\"{dataSource}\";Version=3;Read Only=True;");

    private static SQLiteConnection OpenConnection(string connectionString)
    {
        var connection = new SQLiteConnection(connectionString, parseViaFramework: true);
        bool isOpen = false;
        try
        {
            connection.Open();
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
