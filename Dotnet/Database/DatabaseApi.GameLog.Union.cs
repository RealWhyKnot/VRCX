namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const string GameLogUnionColumns = "id, created_at, type, display_name, location, user_id, time, world_id, world_name, group_name, instance_id, video_url, video_name, video_id, resource_url, resource_type, data, message";

    private const string GameLogLocationProjection = "id, created_at, 'Location' AS type, NULL AS display_name, location, NULL AS user_id, time, world_id, world_name, group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message";

    private const string GameLogJoinLeaveProjection = "id, created_at, type, display_name, location, user_id, time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message";

    private const string GameLogPortalSpawnProjection = "id, created_at, 'PortalSpawn' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, world_name, NULL AS group_name, instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message";

    private const string GameLogEventProjection = "id, created_at, 'Event' AS type, NULL AS display_name, NULL AS location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, data, NULL AS message";

    private const string GameLogExternalProjection = "id, created_at, 'External' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, message";

    private const string GameLogVideoPlayProjection = "id, created_at, 'VideoPlay' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, video_url, video_name, video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message";

    private const string GameLogResourceLoadProjection = "id, created_at, resource_type AS type, NULL AS display_name, location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, resource_url, resource_type, NULL AS data, NULL AS message";

    private static bool IsFilterSelected(string[] filters, string name) => filters.Length == 0 || Array.Exists(filters, filter => string.Equals(filter, name, StringComparison.Ordinal));

    private static string GameLogSelect(string projection, string source, string where) => $"SELECT * FROM (SELECT {projection} FROM {source} {where} ORDER BY id DESC LIMIT @perTable)";

    private static string JoinLeaveTypeClause(bool joinedSelected, bool leftSelected) => joinedSelected && leftSelected ? string.Empty : joinedSelected ? "AND type = 'OnPlayerJoined'" : "AND type = 'OnPlayerLeft'";

    private static string ResourceTypeClause(bool stringSelected, bool imageSelected)
    {
        string stringClause = stringSelected ? string.Empty : "AND resource_type != 'StringLoad'";
        string imageClause = imageSelected ? string.Empty : "AND resource_type != 'ImageLoad'";
        return $"{stringClause} {imageClause}";
    }

    private static string VipClause(string[] vipIds, List<(string Name, object? Value)> args) => vipIds.Length == 0 ? string.Empty : $"AND user_id IN ({AddListParameters(vipIds, "@id", args)})";

    private string QueryUnion(List<string> selects, List<(string Name, object? Value)> args, long limit)
    {
        if (selects.Count == 0)
        {
            return "[]";
        }

        args.Add(("@limit", limit));
        string unionSql = string.Join(" UNION ALL ", selects);
        return Rows($"SELECT {GameLogUnionColumns} FROM ({unionSql}) ORDER BY created_at DESC, id DESC LIMIT @limit", [.. args]);
    }
}
