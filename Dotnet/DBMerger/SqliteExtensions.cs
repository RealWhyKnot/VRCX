using System.Data.SQLite;
using System.Diagnostics.CodeAnalysis;

namespace DBMerger;

internal static class SqliteExtensions
{
    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "Query text is built inside this assembly and every value is bound as a parameter.")]
    public static SQLiteCommand CreateCommand(this SQLiteConnection conn, string query, params object?[] args)
    {
        SQLiteCommand command = conn.CreateCommand();
        command.CommandText = query;

        for (int i = 0; i < args.Length; i++)
        {
            command.Parameters.AddWithValue($"@p{i}", args[i] ?? DBNull.Value);
        }

        return command;
    }

    public static void ExecuteNonQuery(this SQLiteConnection conn, string query, params object?[] args)
    {
        using SQLiteCommand command = conn.CreateCommand(query, args);
        command.ExecuteNonQuery();
    }

    public static string? ReadScalarString(this SQLiteConnection conn, string query, params object?[] args)
    {
        using SQLiteCommand command = conn.CreateCommand(query, args);
        object? value = command.ExecuteScalar();
        return value is null or DBNull ? null : value.ToString();
    }

    public static List<string> ReadStrings(this SQLiteConnection conn, string query, params object?[] args)
    {
        var results = new List<string>();
        using SQLiteCommand command = conn.CreateCommand(query, args);
        using SQLiteDataReader reader = command.ExecuteReader();

        while (reader.Read())
        {
            results.Add(reader.IsDBNull(0) ? throw new InvalidDataException("Database query returned a null name.") : reader.GetString(0));
        }

        return results;
    }

    public static object?[]? ReadFirstRow(this SQLiteConnection conn, string query, params object?[] args)
    {
        using SQLiteCommand command = conn.CreateCommand(query, args);
        using SQLiteDataReader reader = command.ExecuteReader();

        if (!reader.Read())
        {
            return null;
        }

        object?[] row = new object?[reader.FieldCount];
        for (int i = 0; i < reader.FieldCount; i++)
        {
            row[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        }

        return row;
    }
}
