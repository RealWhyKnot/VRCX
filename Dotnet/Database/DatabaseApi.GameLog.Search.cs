namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string LookupGameLog(string[] filters, string[] vipIds, long maxEntries)
    {
        var args = new List<(string Name, object? Value)> { ("@perTable", maxEntries) };
        string vipClause = VipClause(vipIds, args);
        string typeClause = JoinLeaveTypeClause(IsFilterSelected(filters, "OnPlayerJoined"), IsFilterSelected(filters, "OnPlayerLeft"));
        string resourceClause = ResourceTypeClause(IsFilterSelected(filters, "StringLoad"), IsFilterSelected(filters, "ImageLoad"));
        var selects = new List<string>();
        if (IsFilterSelected(filters, "Location"))
        {
            selects.Add(GameLogSelect(GameLogLocationProjection, "gamelog_location", string.Empty));
        }

        if (IsFilterSelected(filters, "OnPlayerJoined") || IsFilterSelected(filters, "OnPlayerLeft"))
        {
            selects.Add(GameLogSelect(GameLogJoinLeaveProjection, "gamelog_join_leave", $"WHERE 1=1 {vipClause} {typeClause}"));
        }

        if (IsFilterSelected(filters, "PortalSpawn"))
        {
            selects.Add(GameLogSelect(GameLogPortalSpawnProjection, "gamelog_portal_spawn", $"WHERE 1=1 {vipClause}"));
        }

        if (IsFilterSelected(filters, "Event"))
        {
            selects.Add(GameLogSelect(GameLogEventProjection, "gamelog_event", string.Empty));
        }

        if (IsFilterSelected(filters, "External"))
        {
            selects.Add(GameLogSelect(GameLogExternalProjection, "gamelog_external", $"WHERE 1=1 {vipClause}"));
        }

        if (IsFilterSelected(filters, "VideoPlay"))
        {
            selects.Add(GameLogSelect(GameLogVideoPlayProjection, "gamelog_video_play", $"WHERE 1=1 {vipClause}"));
        }

        if (IsFilterSelected(filters, "StringLoad") || IsFilterSelected(filters, "ImageLoad"))
        {
            selects.Add(GameLogSelect(GameLogResourceLoadProjection, "gamelog_resource_load", $"WHERE 1=1 {resourceClause}"));
        }

        return QueryUnion(selects, args, maxEntries);
    }

    public string SearchGameLog(string search, string[] filters, string[] vipIds, string userId, long maxEntries)
    {
        var args = new List<(string Name, object? Value)>
        {
            ("@searchLike", $"%{search}%"),
            ("@perTable", maxEntries),
            ("@userId", userId),
        };
        string vipClause = VipClause(vipIds, args);
        string typeClause = JoinLeaveTypeClause(IsFilterSelected(filters, "OnPlayerJoined"), IsFilterSelected(filters, "OnPlayerLeft"));
        string resourceClause = ResourceTypeClause(IsFilterSelected(filters, "StringLoad"), IsFilterSelected(filters, "ImageLoad"));
        var selects = new List<string>();
        if (IsFilterSelected(filters, "Location"))
        {
            selects.Add(GameLogSelect(GameLogLocationProjection, "gamelog_location", "WHERE (world_name LIKE @searchLike OR group_name LIKE @searchLike)"));
        }

        if (IsFilterSelected(filters, "OnPlayerJoined") || IsFilterSelected(filters, "OnPlayerLeft"))
        {
            selects.Add(GameLogSelect(GameLogJoinLeaveProjection, "gamelog_join_leave", $"WHERE (display_name LIKE @searchLike AND user_id != @userId) {vipClause} {typeClause}"));
        }

        if (IsFilterSelected(filters, "PortalSpawn"))
        {
            selects.Add(GameLogSelect(GameLogPortalSpawnProjection, "gamelog_portal_spawn", $"WHERE (display_name LIKE @searchLike OR world_name LIKE @searchLike) {vipClause}"));
        }

        if (IsFilterSelected(filters, "Event"))
        {
            selects.Add(GameLogSelect(GameLogEventProjection, "gamelog_event", "WHERE data LIKE @searchLike"));
        }

        if (IsFilterSelected(filters, "External"))
        {
            selects.Add(GameLogSelect(GameLogExternalProjection, "gamelog_external", $"WHERE (display_name LIKE @searchLike OR message LIKE @searchLike) {vipClause}"));
        }

        if (IsFilterSelected(filters, "VideoPlay"))
        {
            selects.Add(GameLogSelect(GameLogVideoPlayProjection, "gamelog_video_play", $"WHERE (video_url LIKE @searchLike OR video_name LIKE @searchLike OR display_name LIKE @searchLike) {vipClause}"));
        }

        if (IsFilterSelected(filters, "StringLoad") || IsFilterSelected(filters, "ImageLoad"))
        {
            selects.Add(GameLogSelect(GameLogResourceLoadProjection, "gamelog_resource_load", $"WHERE resource_url LIKE @searchLike {resourceClause}"));
        }

        return QueryUnion(selects, args, maxEntries);
    }
}
