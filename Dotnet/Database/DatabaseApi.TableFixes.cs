using System.Text;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const string FriendLogHistoryTablesQuery = "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'";
    private const string GpsTablesQuery = "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_gps'";
    private const string NotificationTablesQuery = "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_notifications'";

    public void CleanLegendFromFriendLog()
    {
        foreach (string tableName in TableNames(FriendLogHistoryTablesQuery))
        {
            _ = Run($"DELETE FROM {tableName} WHERE type = 'TrustLevel' AND created_at > '2022-05-04T01:00:00.000Z' AND ((trust_level = 'Veteran User' AND previous_trust_level = 'Trusted User') OR (trust_level = 'Trusted User' AND previous_trust_level = 'Veteran User'))");
        }
    }

    public string GetTravelingLeaveRows() => Rows("SELECT * FROM gamelog_join_leave WHERE type = 'OnPlayerLeft' AND location = 'traveling'");

    public string GetLastOnPlayerJoinRows(string? displayName, string? createdAt) => Rows("SELECT * FROM gamelog_join_leave WHERE type = 'OnPlayerJoined' AND display_name = @displayName AND created_at <= @created_at ORDER BY created_at DESC LIMIT 1", ("@displayName", displayName), ("@created_at", createdAt));

    public void SetJoinLeaveLocation(long id, string? location) => _ = Run("UPDATE gamelog_join_leave SET location = @location WHERE id = @rowId", ("@rowId", id), ("@location", location));

    public void FixNegativeGpsTimes()
    {
        foreach (string tableName in TableNames(GpsTablesQuery))
        {
            _ = Run($"UPDATE {tableName} SET time = 0 WHERE time < 0");
        }
    }

    public string GetOnPlayerLeftRowsWithTime() => Rows("SELECT location, time, id FROM gamelog_join_leave WHERE type = 'OnPlayerLeft' AND time > 0");

    public void ResetLeaveTimes(string[] ids)
    {
        var placeholders = new StringBuilder();
        var args = new (string Name, object? Value)[ids.Length];
        for (int index = 0; index < ids.Length; index++)
        {
            string name = $"@id{index}";
            if (index > 0)
            {
                placeholders.Append(", ");
            }

            placeholders.Append(name);
            args[index] = (name, ids[index]);
        }

        _ = Run($"UPDATE gamelog_join_leave SET time = 0 WHERE id IN ({placeholders})", args);
    }

    public void DeleteGroupInviteNotifications()
    {
        foreach (string tableName in TableNames(NotificationTablesQuery))
        {
            _ = Run($"DELETE FROM {tableName} WHERE type LIKE '%.%'");
        }
    }

    public void DeleteBrokenNotifications()
    {
        foreach (string tableName in TableNames(NotificationTablesQuery))
        {
            _ = Run($"DELETE FROM {tableName} WHERE (created_at is null or created_at = '')");
        }
    }

    public void DeleteOldGroupChangeNotifications()
    {
        foreach (string tableName in TableNames(NotificationTablesQuery))
        {
            _ = Run($"DELETE FROM {tableName} WHERE type = 'groupChange' AND created_at < '2024-04-23T03:00:00.000Z'");
        }
    }

    public void FixCancelFriendRequestTypo()
    {
        foreach (string tableName in TableNames(FriendLogHistoryTablesQuery))
        {
            _ = Run($"UPDATE {tableName} SET type = 'CancelFriendRequest' WHERE type = 'CancelFriendRequst'");
        }
    }

    public string GetBrokenGameLogDisplayNames() => Rows("SELECT id, display_name, created_at, type FROM gamelog_join_leave WHERE display_name LIKE '% (%'");

    public string HasGameLogEntry(string? createdAt, string? type, string displayName) => Rows("SELECT 1 FROM gamelog_join_leave WHERE created_at = @created_at AND type = @type AND display_name = @display_name LIMIT 1", ("@created_at", createdAt), ("@type", type), ("@display_name", displayName));

    public void DeleteGameLogEntry(long id) => _ = Run("DELETE FROM gamelog_join_leave WHERE id = @id", ("@id", id));

    public void RenameGameLogEntry(long id, string displayName) => _ = Run("UPDATE gamelog_join_leave SET display_name = @new_display_name WHERE id = @id", ("@new_display_name", displayName), ("@id", id));
}
