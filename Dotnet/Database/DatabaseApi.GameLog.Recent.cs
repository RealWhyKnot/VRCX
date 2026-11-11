namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetRecentGameLogLocations(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_location WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogJoinLeave(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_join_leave WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogPortalSpawn(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_portal_spawn WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogVideoPlay(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_video_play WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogResourceLoad(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_resource_load WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogEvents(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_event WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetRecentGameLogExternal(string dateOffset, long limit) => Rows("SELECT * FROM gamelog_external WHERE created_at >= date(@dateOffset) ORDER BY id DESC LIMIT @limit", ("@dateOffset", dateOffset), ("@limit", limit));

    public string GetLatestGameLogLocationCreatedAt() => Rows("SELECT created_at FROM gamelog_location ORDER BY id DESC LIMIT 1");

    public string GetLatestGameLogJoinLeaveCreatedAt() => Rows("SELECT created_at FROM gamelog_join_leave ORDER BY id DESC LIMIT 1");

    public string GetLatestGameLogPortalSpawnCreatedAt() => Rows("SELECT created_at FROM gamelog_portal_spawn ORDER BY id DESC LIMIT 1");

    public string GetLatestGameLogEventCreatedAt() => Rows("SELECT created_at FROM gamelog_event ORDER BY id DESC LIMIT 1");

    public string GetLatestGameLogVideoPlayCreatedAt() => Rows("SELECT created_at FROM gamelog_video_play ORDER BY id DESC LIMIT 1");

    public string GetLatestGameLogResourceLoadCreatedAt() => Rows("SELECT created_at FROM gamelog_resource_load ORDER BY id DESC LIMIT 1");
}
