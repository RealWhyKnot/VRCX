using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public long AddFeedGps(string createdAt, string userId, string displayName, string? location, string? worldName, string? previousLocation, long? time, string? groupName) =>
        Insert(
            $"INSERT OR IGNORE INTO {UserTable("feed_gps")} (created_at, user_id, display_name, location, world_name, previous_location, time, group_name) VALUES (@created_at, @user_id, @display_name, @location, @world_name, @previous_location, @time, @group_name)",
            ("@created_at", createdAt),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@location", location),
            ("@world_name", worldName),
            ("@previous_location", previousLocation),
            ("@time", time),
            ("@group_name", groupName));

    public long AddFeedStatus(string createdAt, string userId, string displayName, string? status, string? statusDescription, string? previousStatus, string? previousStatusDescription) =>
        Insert(
            $"INSERT OR IGNORE INTO {UserTable("feed_status")} (created_at, user_id, display_name, status, status_description, previous_status, previous_status_description) VALUES (@created_at, @user_id, @display_name, @status, @status_description, @previous_status, @previous_status_description)",
            ("@created_at", createdAt),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@status", status),
            ("@status_description", statusDescription),
            ("@previous_status", previousStatus),
            ("@previous_status_description", previousStatusDescription));

    public long AddFeedBio(string createdAt, string userId, string displayName, string? bio, string? previousBio, string bioLinks, string previousBioLinks) =>
        Insert(
            $"INSERT OR IGNORE INTO {UserTable("feed_bio")} (created_at, user_id, display_name, bio, previous_bio, bio_links, previous_bio_links) VALUES (@created_at, @user_id, @display_name, @bio, @previous_bio, @bio_links, @previous_bio_links)",
            ("@created_at", createdAt),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@bio", bio),
            ("@previous_bio", previousBio),
            ("@bio_links", bioLinks),
            ("@previous_bio_links", previousBioLinks));

    public long AddFeedAvatar(string createdAt, string userId, string displayName, string? ownerId, string? avatarName, string? currentAvatarImageLink, string? currentAvatarThumbnailImageLink, string? previousCurrentAvatarImageLink, string? previousCurrentAvatarThumbnailImageLink) =>
        Insert(
            $"INSERT OR IGNORE INTO {UserTable("feed_avatar")} (created_at, user_id, display_name, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url) VALUES (@created_at, @user_id, @display_name, @owner_id, @avatar_name, @current_avatar_image_url, @current_avatar_thumbnail_image_url, @previous_current_avatar_image_url, @previous_current_avatar_thumbnail_image_url)",
            ("@created_at", createdAt),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@owner_id", ownerId),
            ("@avatar_name", avatarName),
            ("@current_avatar_image_url", currentAvatarImageLink),
            ("@current_avatar_thumbnail_image_url", currentAvatarThumbnailImageLink),
            ("@previous_current_avatar_image_url", previousCurrentAvatarImageLink),
            ("@previous_current_avatar_thumbnail_image_url", previousCurrentAvatarThumbnailImageLink));

    public long AddFeedOnlineOffline(string createdAt, string userId, string displayName, string type, string? location, string? worldName, long? time, string? groupName) =>
        Insert(
            $"INSERT OR IGNORE INTO {UserTable("feed_online_offline")} (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES (@created_at, @user_id, @display_name, @type, @location, @world_name, @time, @group_name)",
            ("@created_at", createdAt),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@type", type),
            ("@location", location),
            ("@world_name", worldName),
            ("@time", time),
            ("@group_name", groupName));

    public void DeleteAvatarFeedOlderThan(string cutoff) => _ = Run($"DELETE FROM {UserTable("feed_avatar")} WHERE created_at < @cutoff", ("@cutoff", cutoff));

    public void DeleteAllAvatarFeed() => _ = Run($"DELETE FROM {UserTable("feed_avatar")}");

    public string GetHotWorlds(long days, long limit) =>
        Rows(
            $"""
            SELECT
                      SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                      world_name,
                      COUNT(*) AS visit_count,
                      COUNT(DISTINCT user_id) AS unique_friends,
                      MAX(created_at) AS last_visited
                  FROM {UserTable("feed_gps")}
                  WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', @daysOffset)
                      AND location LIKE 'wrld_%'
                      AND INSTR(location, ':') > 0
                      AND world_name IS NOT NULL AND world_name != ''
                  GROUP BY world_id
                  ORDER BY unique_friends DESC, visit_count DESC
                  LIMIT @limit
            """,
            ("@daysOffset", DaysOffset(days)),
            ("@limit", limit));

    public string GetHotWorldTrendBaseline(long days) =>
        Rows(
            $"""
            SELECT
                      SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                      COUNT(DISTINCT user_id) AS unique_friends
                  FROM {UserTable("feed_gps")}
                  WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', @daysOffset)
                      AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', @halfOffset)
                      AND location LIKE 'wrld_%'
                      AND INSTR(location, ':') > 0
                      AND world_name IS NOT NULL AND world_name != ''
                  GROUP BY world_id
            """,
            ("@daysOffset", DaysOffset(days)),
            ("@halfOffset", DaysOffset(HalfDays(days))));

    public string GetHotWorldTrendRecent(long days) =>
        Rows(
            $"""
            SELECT
                      SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                      COUNT(DISTINCT user_id) AS unique_friends
                  FROM {UserTable("feed_gps")}
                  WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', @halfOffset)
                      AND location LIKE 'wrld_%'
                      AND INSTR(location, ':') > 0
                      AND world_name IS NOT NULL AND world_name != ''
                  GROUP BY world_id
            """,
            ("@halfOffset", DaysOffset(HalfDays(days))));

    public string GetHotWorldFriendDetail(string worldId, long days) =>
        Rows(
            $"""
            SELECT
                      user_id,
                      display_name,
                      COUNT(*) AS visit_count,
                      MAX(created_at) AS last_visit
                  FROM {UserTable("feed_gps")}
                  WHERE SUBSTR(location, 1, INSTR(location, ':') - 1) = @worldId
                      AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', @daysOffset)
                  GROUP BY user_id
                  ORDER BY visit_count DESC
            """,
            ("@worldId", worldId),
            ("@daysOffset", DaysOffset(days)));

    private static string DaysOffset(long days) => $"-{days.ToString(CultureInfo.InvariantCulture)} days";

    private static long HalfDays(long days) => (long)Math.Floor(days / 2.0);
}
