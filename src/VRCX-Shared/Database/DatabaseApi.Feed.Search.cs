using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const string FeedBaseColumns = "id, created_at, user_id, display_name, type, location, world_name, previous_location, time, group_name, status, status_description, previous_status, previous_status_description, bio, previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url, bio_links, previous_bio_links";

    private const string FeedGpsColumns = "id, created_at, user_id, display_name, 'GPS' AS type, location, world_name, previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url, NULL AS bio_links, NULL AS previous_bio_links";

    private const string FeedStatusColumns = "id, created_at, user_id, display_name, 'Status' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, status, status_description, previous_status, previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url, NULL AS bio_links, NULL AS previous_bio_links";

    private const string FeedBioColumns = "id, created_at, user_id, display_name, 'Bio' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, bio, previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url, bio_links, previous_bio_links";

    private const string FeedAvatarColumns = "id, created_at, user_id, display_name, 'Avatar' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url, NULL AS bio_links, NULL AS previous_bio_links";

    private const string FeedOnlineOfflineColumns = "id, created_at, user_id, display_name, type, location, world_name, NULL AS previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url, NULL AS bio_links, NULL AS previous_bio_links";

    public string SearchFeed(string search, string[] filters, string[] vipList, long limit, string dateFrom, string dateTo)
    {
        var parameters = new List<(string Name, object? Value)>
        {
            ("@searchLike", $"%{search}%"),
            ("@limit", limit),
            ("@perTable", limit),
        };
        string vipQuery = VipQuery(vipList, parameters);
        string dateQuery = DateQuery(dateFrom, dateTo, parameters);
        bool isAvatarPrivate = search.Contains("private", StringComparison.Ordinal);
        bool isAvatarPublic = search.Contains("public", StringComparison.Ordinal);
        bool isOnline = IsFeedFilterEnabled(filters, "Online");
        bool isOffline = IsFeedFilterEnabled(filters, "Offline");
        var selects = new List<string>();
        if (IsFeedFilterEnabled(filters, "GPS"))
        {
            selects.Add(FeedSelect(FeedGpsColumns, UserTable("feed_gps"), $"(display_name LIKE @searchLike OR world_name LIKE @searchLike OR group_name LIKE @searchLike) {dateQuery} {vipQuery}", "created_at DESC, id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Status"))
        {
            selects.Add(FeedSelect(FeedStatusColumns, UserTable("feed_status"), $"(display_name LIKE @searchLike OR status LIKE @searchLike OR status_description LIKE @searchLike) {dateQuery} {vipQuery}", "created_at DESC, id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Bio"))
        {
            selects.Add(FeedSelect(FeedBioColumns, UserTable("feed_bio"), $"(display_name LIKE @searchLike OR bio LIKE @searchLike OR bio_links LIKE @searchLike) {dateQuery} {vipQuery}", "created_at DESC, id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Avatar"))
        {
            string avatarQuery = isAvatarPrivate ? "OR user_id = owner_id" : isAvatarPublic ? "OR user_id != owner_id" : string.Empty;
            selects.Add(FeedSelect(FeedAvatarColumns, UserTable("feed_avatar"), $"(display_name LIKE @searchLike OR avatar_name LIKE @searchLike {avatarQuery}) {dateQuery} {vipQuery}", "created_at DESC, id DESC"));
        }

        if (isOnline || isOffline)
        {
            selects.Add(FeedSelect(FeedOnlineOfflineColumns, UserTable("feed_online_offline"), $"(display_name LIKE @searchLike OR world_name LIKE @searchLike OR group_name LIKE @searchLike) {OnlineOfflineClause(isOnline, isOffline)} {dateQuery} {vipQuery}", "created_at DESC, id DESC"));
        }

        return QueryFeed(selects, parameters);
    }

    public string LookupFeed(string[] filters, string[] vipList, long limit)
    {
        var parameters = new List<(string Name, object? Value)>
        {
            ("@limit", limit),
            ("@perTable", limit),
        };
        string vipQuery = VipQuery(vipList, parameters);
        bool isOnline = IsFeedFilterEnabled(filters, "Online");
        bool isOffline = IsFeedFilterEnabled(filters, "Offline");
        var selects = new List<string>();
        if (IsFeedFilterEnabled(filters, "GPS"))
        {
            selects.Add(FeedSelect(FeedGpsColumns, UserTable("feed_gps"), $"1=1 {vipQuery}", "id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Status"))
        {
            selects.Add(FeedSelect(FeedStatusColumns, UserTable("feed_status"), $"1=1 {vipQuery}", "id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Bio"))
        {
            selects.Add(FeedSelect(FeedBioColumns, UserTable("feed_bio"), $"1=1 {vipQuery}", "id DESC"));
        }

        if (IsFeedFilterEnabled(filters, "Avatar"))
        {
            selects.Add(FeedSelect(FeedAvatarColumns, UserTable("feed_avatar"), $"1=1 {vipQuery}", "id DESC"));
        }

        if (isOnline || isOffline)
        {
            selects.Add(FeedSelect(FeedOnlineOfflineColumns, UserTable("feed_online_offline"), $"1=1 {OnlineOfflineClause(isOnline, isOffline)} {vipQuery}", "id DESC"));
        }

        return QueryFeed(selects, parameters);
    }

    public string GetFeedByInstanceId(string instanceId, string[] filters, string[] vipList, long limit)
    {
        var parameters = new List<(string Name, object? Value)>
        {
            ("@instanceLike", $"%{instanceId}%"),
            ("@limit", limit),
            ("@perTable", limit),
        };
        string vipQuery = VipQuery(vipList, parameters);
        bool isOnline = IsFeedFilterEnabled(filters, "Online");
        bool isOffline = IsFeedFilterEnabled(filters, "Offline");
        var selects = new List<string>();
        if (IsFeedFilterEnabled(filters, "GPS"))
        {
            selects.Add(FeedSelect(FeedGpsColumns, UserTable("feed_gps"), $"location LIKE @instanceLike {vipQuery}", "created_at DESC, id DESC"));
        }

        if (isOnline || isOffline)
        {
            selects.Add(FeedSelect(FeedOnlineOfflineColumns, UserTable("feed_online_offline"), $"location LIKE @instanceLike {OnlineOfflineClause(isOnline, isOffline)} {vipQuery}", "created_at DESC, id DESC"));
        }

        return QueryFeed(selects, parameters);
    }

    private string QueryFeed(List<string> selects, List<(string Name, object? Value)> parameters)
    {
        return selects.Count == 0
            ? "[]"
            : Rows($"SELECT {FeedBaseColumns} FROM ({string.Join(" UNION ALL ", selects)}) ORDER BY created_at DESC, id DESC LIMIT @limit", [.. parameters]);
    }

    private static string FeedSelect(string columns, string table, string where, string order) =>
        $"SELECT * FROM (SELECT {columns} FROM {table} WHERE {where} ORDER BY {order} LIMIT @perTable)";

    private static bool IsFeedFilterEnabled(string[] filters, string name) => filters.Length == 0 || filters.Contains(name, StringComparer.Ordinal);

    private static string OnlineOfflineClause(bool isOnline, bool isOffline) => (isOnline, isOffline) switch
    {
        (true, false) => "AND type = 'Online'",
        (false, true) => "AND type = 'Offline'",
        _ => string.Empty,
    };

    private static string VipQuery(string[] vipList, List<(string Name, object? Value)> parameters)
    {
        if (vipList.Length == 0)
        {
            return string.Empty;
        }

        string[] placeholders = new string[vipList.Length];
        for (int i = 0; i < vipList.Length; i++)
        {
            placeholders[i] = $"@vip_{i.ToString(CultureInfo.InvariantCulture)}";
            parameters.Add((placeholders[i], vipList[i]));
        }

        return $"AND user_id IN ({string.Join(", ", placeholders)})";
    }

    private static string DateQuery(string dateFrom, string dateTo, List<(string Name, object? Value)> parameters)
    {
        var clauses = new List<string>();
        if (dateFrom.Length > 0)
        {
            clauses.Add("AND created_at >= @dateFrom");
            parameters.Add(("@dateFrom", dateFrom));
        }

        if (dateTo.Length > 0)
        {
            clauses.Add("AND created_at <= @dateTo");
            parameters.Add(("@dateTo", dateTo));
        }

        return string.Join(" ", clauses);
    }
}
