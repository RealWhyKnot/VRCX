namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetGameLogByLocation(string instanceId, string[] filters, string[] vipIds, string userId, long searchTableSize)
    {
        var args = new List<(string Name, object? Value)>
        {
            ("@locationLike", $"%{instanceId}%"),
            ("@perTable", searchTableSize),
            ("@userId", userId),
        };
        string vipClause = VipClause(vipIds, args);
        string typeClause = JoinLeaveTypeClause(IsFilterSelected(filters, "OnPlayerJoined"), IsFilterSelected(filters, "OnPlayerLeft"));
        string resourceClause = ResourceTypeClause(IsFilterSelected(filters, "StringLoad"), IsFilterSelected(filters, "ImageLoad"));
        var selects = new List<string>();
        if (IsFilterSelected(filters, "Location"))
        {
            selects.Add(GameLogSelect(GameLogLocationProjection, "gamelog_location", "WHERE location LIKE @locationLike"));
        }

        if (IsFilterSelected(filters, "OnPlayerJoined") || IsFilterSelected(filters, "OnPlayerLeft"))
        {
            selects.Add(GameLogSelect(GameLogJoinLeaveProjection, "gamelog_join_leave", $"WHERE (location LIKE @locationLike AND user_id != @userId) {vipClause} {typeClause}"));
        }

        if (IsFilterSelected(filters, "PortalSpawn"))
        {
            selects.Add(GameLogSelect(GameLogPortalSpawnProjection, "gamelog_portal_spawn", $"WHERE location LIKE @locationLike {vipClause}"));
        }

        if (IsFilterSelected(filters, "VideoPlay"))
        {
            selects.Add(GameLogSelect(GameLogVideoPlayProjection, "gamelog_video_play", $"WHERE location LIKE @locationLike {vipClause}"));
        }

        if (IsFilterSelected(filters, "StringLoad") || IsFilterSelected(filters, "ImageLoad"))
        {
            selects.Add(GameLogSelect(GameLogResourceLoadProjection, "gamelog_resource_load", $"WHERE location LIKE @locationLike {resourceClause}"));
        }

        return QueryUnion(selects, args, searchTableSize);
    }
}
