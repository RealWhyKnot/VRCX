using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetNotifications(long maxEntries) => Rows($"SELECT * FROM {UserTable("notifications")} ORDER BY created_at DESC LIMIT @maxEntries", ("@maxEntries", maxEntries));

    public string LookupNotifications(string search, string[] filters, string[] vipList, long maxEntries)
    {
        List<(string Name, object? Value)> args = [("@search", $"%{search}%"), ("@maxEntries", maxEntries)];
        string vipQuery = string.Empty;
        if (vipList.Length > 0)
        {
            vipQuery = $"AND sender_user_id IN ({InPlaceholders("vip", vipList.Length)})";
            args.AddRange(vipList.Select((vipUserId, index) => ($"@vip{index.ToString(CultureInfo.InvariantCulture)}", (object?)vipUserId)));
        }

        string filterQuery = string.Empty;
        if (filters.Length > 0)
        {
            filterQuery = $"AND type IN ({InPlaceholders("filter", filters.Length)})";
            args.AddRange(filters.Select((filter, index) => ($"@filter{index.ToString(CultureInfo.InvariantCulture)}", (object?)filter)));
        }

        string sql = $"""
            SELECT * FROM {UserTable("notifications")}
            WHERE (sender_username LIKE @search OR message LIKE @search OR world_name LIKE @search) {vipQuery} {filterQuery}
            ORDER BY created_at DESC
            LIMIT @maxEntries
            """;
        return Rows(sql, [.. args]);
    }

    public void AddNotification(string id, string createdAt, string type, string senderUserId, string senderUsername, string receiverUserId, string message, string worldId, string worldName, string imageLocation, string inviteMessage, string requestMessage, string responseMessage, bool isExpired) =>
        _ = Run($"""
            INSERT OR IGNORE INTO {UserTable("notifications")} (id, created_at, type, sender_user_id, sender_username, receiver_user_id, message, world_id, world_name, image_url, invite_message, request_message, response_message, expired)
            VALUES (@id, @created_at, @type, @sender_user_id, @sender_username, @receiver_user_id, @message, @world_id, @world_name, @image_url, @invite_message, @request_message, @response_message, @expired)
            """,
            ("@id", id),
            ("@created_at", createdAt),
            ("@type", type),
            ("@sender_user_id", senderUserId),
            ("@sender_username", senderUsername),
            ("@receiver_user_id", receiverUserId),
            ("@message", message),
            ("@world_id", worldId),
            ("@world_name", worldName),
            ("@image_url", imageLocation),
            ("@invite_message", inviteMessage),
            ("@request_message", requestMessage),
            ("@response_message", responseMessage),
            ("@expired", isExpired ? 1 : 0));

    public void DeleteNotification(string rowId) => _ = Run($"DELETE FROM {UserTable("notifications")} WHERE id = @row_id", ("@row_id", rowId));

    public void UpdateNotificationExpired(string id, bool isExpired) =>
        _ = Run($"UPDATE {UserTable("notifications")} SET expired = @expired WHERE id = @id", ("@id", id), ("@expired", isExpired ? 1 : 0));

    public string GetNotificationsV2(long maxEntries) => Rows($"SELECT * FROM {UserTable("notifications_v2")} ORDER BY created_at DESC LIMIT @maxEntries", ("@maxEntries", maxEntries));

    public void AddNotificationV2(string id, string? createdAt, string? updatedAt, string? expiresAt, string? type, string? link, string? linkText, string? message, string? title, string? imageLocation, bool isSeen, string? senderUserId, string? senderUsername, string dataJson, string responsesJson, string detailsJson) =>
        _ = Run($"""
            INSERT OR REPLACE INTO {UserTable("notifications_v2")} (id, created_at, updated_at, expires_at, type, link, link_text, message, title, image_url, seen, sender_user_id, sender_username, data, responses, details)
            VALUES (@id, @created_at, @updated_at, @expires_at, @type, @link, @link_text, @message, @title, @image_url, @seen, @sender_user_id, @sender_username, @data, @responses, @details)
            """,
            ("@id", id),
            ("@created_at", createdAt),
            ("@updated_at", updatedAt),
            ("@expires_at", expiresAt),
            ("@type", type),
            ("@link", link),
            ("@link_text", linkText),
            ("@message", message),
            ("@title", title),
            ("@image_url", imageLocation),
            ("@seen", isSeen ? 1 : 0),
            ("@sender_user_id", senderUserId),
            ("@sender_username", senderUsername),
            ("@data", dataJson),
            ("@responses", responsesJson),
            ("@details", detailsJson));

    public void ExpireNotificationV2(string id, string expiresAt) =>
        _ = Run($"UPDATE {UserTable("notifications_v2")} SET expires_at = @expires_at, seen = 1 WHERE id = @id", ("@id", id), ("@expires_at", expiresAt));

    public void SeenNotificationV2(string id) => _ = Run($"UPDATE {UserTable("notifications_v2")} SET seen = 1 WHERE id = @id", ("@id", id));

    public void DeleteNotificationV2(string id) => _ = Run($"DELETE FROM {UserTable("notifications_v2")} WHERE id = @id", ("@id", id));
}
