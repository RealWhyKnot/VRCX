namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetLastVisit(string worldId, long count) => Rows("SELECT created_at, world_id FROM gamelog_location WHERE world_id = @worldId ORDER BY id DESC LIMIT @count", ("@worldId", worldId), ("@count", count));

    public string GetVisitCount(string worldId) => Rows("SELECT COUNT(DISTINCT location) FROM gamelog_location WHERE world_id = @worldId", ("@worldId", worldId));

    public string GetTimeSpentInWorld(string worldId) => Rows("SELECT time FROM gamelog_location WHERE world_id = @worldId", ("@worldId", worldId));

    public string GetLastGroupVisit(string groupId) => Rows("SELECT created_at FROM gamelog_location WHERE location LIKE @groupId ORDER BY id DESC LIMIT 1", ("@groupId", $"%{groupId}%"));

    public string GetGroupJoinCount(string groupId) => Rows("SELECT COUNT(DISTINCT location) FROM gamelog_location WHERE location LIKE @groupId", ("@groupId", $"%{groupId}%"));

    public string GetPreviousInstancesByGroupId(string groupId) => Rows("SELECT created_at, location, time, world_name, group_name FROM gamelog_location WHERE location LIKE @groupId ORDER BY id DESC", ("@groupId", $"%{groupId}%"));

    public string GetPreviousInstancesByWorldId(string worldId) => Rows("SELECT created_at, location, time, world_name, group_name FROM gamelog_location WHERE world_id = @worldId ORDER BY id DESC", ("@worldId", worldId));

    public string GetGameLogWorldName(string worldId) => Rows("SELECT world_name FROM gamelog_location WHERE world_id = @worldId ORDER BY id DESC LIMIT 1", ("@worldId", worldId));

    public string GetGameLogInstancesTime() => Rows("SELECT location, time FROM gamelog_location");

    public string GetPlayersFromInstance(string location) => Rows("SELECT created_at, display_name, user_id, time, type FROM gamelog_join_leave WHERE location = @location", ("@location", location));

    public string GetPlayerDetailFromInstance(string location) => Rows("SELECT created_at, display_name, user_id, time FROM gamelog_join_leave WHERE location = @location AND type = 'OnPlayerLeft' ORDER BY created_at ASC", ("@location", location));
}
