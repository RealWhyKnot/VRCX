using System.Data.SQLite;
using System.Text.Json;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class SQLiteDatabase : IDisposable
{
    public static SQLiteDatabase Instance { get; private set; } = new SQLiteDatabase();

    private readonly ReaderWriterLockSlim _connectionLock;
    private SQLiteConnection? _connection;

    public SQLiteDatabase()
    {
        _connectionLock = new ReaderWriterLockSlim();
    }

    private SQLiteConnection Connection => _connection ?? throw new InvalidOperationException("The database connection is not open.");

    public void Init()
    {
#if LINUX
        Instance = this;
#endif
        string dataSource = Program.ConfigLocation ?? string.Empty;
        string jsonDataSource = VRCXStorage.Instance.Get("VRCX_DatabaseLocation");
        if (!string.IsNullOrEmpty(jsonDataSource))
        {
            dataSource = jsonDataSource;
        }

        _connection = new SQLiteConnection($"Data Source=\"{dataSource}\";Version=3;PRAGMA locking_mode=NORMAL;PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA optimize=0x10002;", parseViaFramework: true);

        _connection.Open();
    }

    public void Exit()
    {
        Connection.Close();
        Connection.Dispose();
    }

    public string ExecuteJson(string sql, IDictionary<string, object>? args = null)
    {
        object[][] result = Execute(sql, args);
        return JsonSerializer.Serialize(result);
    }

    public object[][] Execute(string sql, IDictionary<string, object>? args = null)
    {
        _connectionLock.EnterReadLock();
        try
        {
            using var command = new SQLiteCommand(sql, Connection);
            if (args != null)
            {
                foreach (KeyValuePair<string, object> arg in args)
                {
                    command.Parameters.Add(new SQLiteParameter(arg.Key, arg.Value));
                }
            }

            using SQLiteDataReader reader = command.ExecuteReader();
            var result = new List<object[]>();
            while (reader.Read())
            {
                object[] values = new object[reader.FieldCount];
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    values[i] = reader.GetValue(i);
                }
                result.Add(values);
            }
            return [.. result];
        }
        finally
        {
            _connectionLock.ExitReadLock();
        }
    }

    public int ExecuteNonQuery(string sql, IDictionary<string, object>? args = null)
    {
        int result = -1;
        _connectionLock.EnterWriteLock();
        try
        {
            using var command = new SQLiteCommand(sql, Connection);
            if (args != null)
            {
                foreach (KeyValuePair<string, object> arg in args)
                {
                    command.Parameters.Add(new SQLiteParameter(arg.Key, arg.Value));
                }
            }
            result = command.ExecuteNonQuery();
        }
        finally
        {
            _connectionLock.ExitWriteLock();
        }

        return result;
    }

    public long ExecuteInsert(string sql, IDictionary<string, object>? args = null)
    {
        _connectionLock.EnterWriteLock();
        try
        {
            using var command = new SQLiteCommand(sql, Connection);
            if (args != null)
            {
                foreach (KeyValuePair<string, object> arg in args)
                {
                    command.Parameters.Add(new SQLiteParameter(arg.Key, arg.Value));
                }
            }

            return command.ExecuteNonQuery() > 0 ? Connection.LastInsertRowId : 0;
        }
        finally
        {
            _connectionLock.ExitWriteLock();
        }
    }

#if LINUX
    public void Dispose()
#else
    void IDisposable.Dispose()
#endif
    {
        _connection?.Dispose();
        _connectionLock.Dispose();
    }
}
