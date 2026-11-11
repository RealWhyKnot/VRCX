using System.Buffers;
using System.Data.SQLite;
using System.Globalization;
using System.Text;
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

    internal string ExecuteJson(string sql, IReadOnlyDictionary<string, object?>? args = null)
    {
        var buffer = new ArrayBufferWriter<byte>();
        _connectionLock.EnterReadLock();
        try
        {
            using SQLiteCommand command = CreateCommand(sql, args);
            using SQLiteDataReader reader = command.ExecuteReader();
            using var writer = new Utf8JsonWriter(buffer);
            writer.WriteStartArray();
            while (reader.Read())
            {
                writer.WriteStartArray();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    WriteValue(writer, reader.GetValue(i));
                }

                writer.WriteEndArray();
            }

            writer.WriteEndArray();
        }
        finally
        {
            _connectionLock.ExitReadLock();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    internal object[][] Execute(string sql, IReadOnlyDictionary<string, object?>? args = null)
    {
        _connectionLock.EnterReadLock();
        try
        {
            using SQLiteCommand command = CreateCommand(sql, args);
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

    internal int ExecuteNonQuery(string sql, IReadOnlyDictionary<string, object?>? args = null)
    {
        _connectionLock.EnterWriteLock();
        try
        {
            using SQLiteCommand command = CreateCommand(sql, args);
            return command.ExecuteNonQuery();
        }
        finally
        {
            _connectionLock.ExitWriteLock();
        }
    }

    internal long ExecuteInsert(string sql, IReadOnlyDictionary<string, object?>? args = null)
    {
        _connectionLock.EnterWriteLock();
        try
        {
            using SQLiteCommand command = CreateCommand(sql, args);
            return command.ExecuteNonQuery() > 0 ? Connection.LastInsertRowId : 0;
        }
        finally
        {
            _connectionLock.ExitWriteLock();
        }
    }

    private SQLiteCommand CreateCommand(string sql, IReadOnlyDictionary<string, object?>? args)
    {
        var command = new SQLiteCommand(sql, Connection);
        if (args != null)
        {
            foreach (KeyValuePair<string, object?> arg in args)
            {
                command.Parameters.Add(new SQLiteParameter(arg.Key, arg.Value));
            }
        }

        return command;
    }

    private static void WriteValue(Utf8JsonWriter writer, object value)
    {
        switch (value)
        {
            case DBNull:
                writer.WriteNullValue();
                break;
            case string text:
                writer.WriteStringValue(text);
                break;
            case long number:
                writer.WriteNumberValue(number);
                break;
            case double number:
                writer.WriteNumberValue(number);
                break;
            case int number:
                writer.WriteNumberValue(number);
                break;
            case decimal number:
                writer.WriteNumberValue(number);
                break;
            case bool flag:
                writer.WriteBooleanValue(flag);
                break;
            case DateTime moment:
                writer.WriteStringValue(moment);
                break;
            case byte[] bytes:
                writer.WriteBase64StringValue(bytes);
                break;
            default:
                writer.WriteStringValue(Convert.ToString(value, CultureInfo.InvariantCulture));
                break;
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
