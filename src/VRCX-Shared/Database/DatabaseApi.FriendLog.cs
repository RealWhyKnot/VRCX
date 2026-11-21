using System.Globalization;
using System.Text;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const int FriendLogHistoryChunkRows = 500;
    private const int FriendLogCurrentChunkRows = 1000;

    private static readonly string[] FriendLogHistoryColumns = ["created_at", "type", "user_id", "display_name", "previous_display_name", "trust_level", "previous_trust_level", "friend_number"];
    private static readonly string[] FriendLogCurrentColumns = ["user_id", "display_name", "trust_level", "friend_number"];

    public string GetFriendLogHistory() => Rows($"SELECT * FROM {UserTable("friend_log_history")}");

    public string GetFriendLogHistoryPage(long limit, long? beforeId) =>
        beforeId is null
            ? Rows($"SELECT * FROM {UserTable("friend_log_history")} ORDER BY id DESC LIMIT @limit", ("@limit", limit))
            : Rows($"SELECT * FROM {UserTable("friend_log_history")} WHERE id < @beforeId ORDER BY id DESC LIMIT @limit", ("@beforeId", beforeId), ("@limit", limit));

    private const string FriendHistoryFilter = """
        (@types = '[]' OR lower(type) IN (SELECT lower(value) FROM json_each(@types)))
        AND (@hideUnfriends = 0 OR type IS NOT 'Unfriend')
        AND (@search = '' OR vrcx_contains(coalesce(display_name, ''), @search))
        """;

    public string GetFilteredFriendLogHistoryPage(long limit, long? beforeId, string? beforeDate, string[] types, string search, bool hideUnfriends, bool ascending)
    {
        string comparison = ascending ? ">" : "<";
        string direction = ascending ? "ASC" : "DESC";
        const string Timestamp = "coalesce(julianday(created_at), 0)";
        return Rows($"""
            SELECT * FROM {UserTable("friend_log_history")}
            WHERE {FriendHistoryFilter} AND (
                @beforeId IS NULL OR {Timestamp} {comparison} coalesce(julianday(@beforeDate), 0)
                OR ({Timestamp} = coalesce(julianday(@beforeDate), 0) AND id < @beforeId)
            )
            ORDER BY {Timestamp} {direction}, id DESC LIMIT @limit
            """, ("@types", System.Text.Json.JsonSerializer.Serialize(types)), ("@search", search), ("@hideUnfriends", hideUnfriends),
            ("@beforeId", beforeId), ("@beforeDate", beforeDate), ("@limit", Math.Clamp(limit, 0, 1000)));
    }

    public string GetFilteredFriendLogHistoryPageAtOffset(long limit, long offset, string[] types, string search, bool hideUnfriends, bool ascending)
    {
        string direction = ascending ? "ASC" : "DESC";
        return Rows($"""
            SELECT * FROM {UserTable("friend_log_history")} WHERE {FriendHistoryFilter}
            ORDER BY coalesce(julianday(created_at), 0) {direction}, id DESC LIMIT @limit OFFSET @offset
            """, ("@types", System.Text.Json.JsonSerializer.Serialize(types)), ("@search", search), ("@hideUnfriends", hideUnfriends),
            ("@limit", Math.Clamp(limit, 0, 1000)), ("@offset", Math.Max(offset, 0)));
    }

    public string GetFilteredFriendLogHistoryCount(string[] types, string search, bool hideUnfriends) =>
        Rows($"SELECT COUNT(*) FROM {UserTable("friend_log_history")} WHERE {FriendHistoryFilter}",
            ("@types", System.Text.Json.JsonSerializer.Serialize(types)), ("@search", search), ("@hideUnfriends", hideUnfriends));

    public void AddFriendLogHistory(string createdAt, string type, string userId, string? displayName, string? previousDisplayName, string? trustLevel, string? previousTrustLevel, long? friendNumber) => _ = Run($"INSERT OR IGNORE INTO {UserTable("friend_log_history")} (created_at, type, user_id, display_name, previous_display_name, trust_level, previous_trust_level, friend_number) VALUES (@created_at, @type, @user_id, @display_name, @previous_display_name, @trust_level, @previous_trust_level, @friend_number)", ("@created_at", createdAt), ("@type", type), ("@user_id", userId), ("@display_name", displayName), ("@previous_display_name", previousDisplayName), ("@trust_level", trustLevel), ("@previous_trust_level", previousTrustLevel), ("@friend_number", friendNumber));

    public void AddFriendLogHistoryArray(string?[] createdAt, string?[] type, string?[] userId, string?[] displayName, string?[] previousDisplayName, string?[] trustLevel, string?[] previousTrustLevel, string?[] friendNumber) => WriteRows($"INSERT OR IGNORE INTO {UserTable("friend_log_history")}", FriendLogHistoryColumns, [createdAt, type, userId, displayName, previousDisplayName, trustLevel, previousTrustLevel, friendNumber], FriendLogHistoryChunkRows);

    public string GetFriendLogHistoryForUserId(string userId, string[] types)
    {
        if (types.Length == 0)
        {
            return Rows($"SELECT * FROM {UserTable("friend_log_history")} WHERE user_id = @user_id", ("@user_id", userId));
        }

        return Rows($"SELECT * FROM {UserTable("friend_log_history")} WHERE user_id = @user_id AND type IN ({TypeListPlaceholders(types)})", AppendTypeArguments(("@user_id", userId), types));
    }

    public void DeleteFriendLogHistoryById(long rowId) => _ = Run($"DELETE FROM {UserTable("friend_log_history")} WHERE id = @row_id", ("@row_id", rowId));

    public void DeleteFriendLogHistoryByKey(string createdAt, string type, string userId) => _ = Run($"DELETE FROM {UserTable("friend_log_history")} WHERE created_at = @created_at AND type = @type AND user_id = @user_id", ("@created_at", createdAt), ("@type", type), ("@user_id", userId));

    public string GetFriendLogCurrent() => Rows($"SELECT * FROM {UserTable("friend_log_current")}");

    public void SetFriendLogCurrent(string userId, string? displayName, string? trustLevel, long? friendNumber) => _ = Run($"INSERT OR REPLACE INTO {UserTable("friend_log_current")} (user_id, display_name, trust_level, friend_number) VALUES (@user_id, @display_name, @trust_level, @friend_number)", ("@user_id", userId), ("@display_name", displayName), ("@trust_level", trustLevel), ("@friend_number", friendNumber));

    public void SetFriendLogCurrentArray(string[] userId, string[] displayName, string[] trustLevel, string[] friendNumber) => WriteRows($"INSERT OR REPLACE INTO {UserTable("friend_log_current")}", FriendLogCurrentColumns, [userId, displayName, trustLevel, friendNumber], FriendLogCurrentChunkRows);

    public void DeleteFriendLogCurrent(string userId) => _ = Run($"DELETE FROM {UserTable("friend_log_current")} WHERE user_id = @user_id", ("@user_id", userId));

    private void WriteRows(string statementStart, string[] columnNames, string?[][] columns, int chunkRows)
    {
        int rowCount = columns[0].Length;
        if (Array.Exists(columns, column => column.Length != rowCount))
        {
            throw new ArgumentException("Every column needs the same number of rows.", nameof(columns));
        }

        for (int start = 0; start < rowCount; start += chunkRows)
        {
            WriteRowChunk(statementStart, columnNames, columns, start, Math.Min(chunkRows, rowCount - start));
        }
    }

    private void WriteRowChunk(string statementStart, string[] columnNames, string?[][] columns, int start, int count)
    {
        var values = new StringBuilder();
        var arguments = new List<(string Name, object? Value)>();
        for (int row = 0; row < count; row++)
        {
            if (row > 0)
            {
                values.Append(", ");
            }

            values.Append('(');
            for (int column = 0; column < columns.Length; column++)
            {
                string parameterName = "@" + columnNames[column] + (start + row).ToString(CultureInfo.InvariantCulture);
                if (column > 0)
                {
                    values.Append(", ");
                }

                values.Append(parameterName);
                arguments.Add((parameterName, columns[column][start + row]));
            }

            values.Append(')');
        }

        _ = Run($"{statementStart} ({string.Join(", ", columnNames)}) VALUES {values}", [.. arguments]);
    }

    private static string TypeListPlaceholders(string[] types)
    {
        var placeholders = new StringBuilder();
        for (int index = 0; index < types.Length; index++)
        {
            if (index > 0)
            {
                placeholders.Append(", ");
            }

            placeholders.Append("@type").Append(index.ToString(CultureInfo.InvariantCulture));
        }

        return placeholders.ToString();
    }

    private static (string Name, object? Value)[] AppendTypeArguments((string Name, object? Value) first, string[] types)
    {
        var arguments = new List<(string Name, object? Value)> { first };
        for (int index = 0; index < types.Length; index++)
        {
            arguments.Add(("@type" + index.ToString(CultureInfo.InvariantCulture), types[index]));
        }

        return [.. arguments];
    }
}
