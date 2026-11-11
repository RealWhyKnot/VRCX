namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetMaxFriendLogNumber() => Rows($"SELECT MAX(friend_number) FROM {UserTable("friend_log_current")}");

    public string GetGpsTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("feed_gps")}");

    public string GetStatusTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("feed_status")}");

    public string GetBioTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("feed_bio")}");

    public string GetAvatarTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("feed_avatar")}");

    public string GetOnlineOfflineTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("feed_online_offline")}");

    public string GetFriendLogHistoryTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("friend_log_history")}");

    public string GetNotificationTableSize() => Rows($"SELECT COUNT(*) FROM {UserTable("notifications")}");

    public string GetLocationTableSize() => Rows("SELECT COUNT(*) FROM gamelog_location");

    public string GetJoinLeaveTableSize() => Rows("SELECT COUNT(*) FROM gamelog_join_leave");

    public string GetPortalSpawnTableSize() => Rows("SELECT COUNT(*) FROM gamelog_portal_spawn");

    public string GetVideoPlayTableSize() => Rows("SELECT COUNT(*) FROM gamelog_video_play");

    public string GetResourceLoadTableSize() => Rows("SELECT COUNT(*) FROM gamelog_resource_load");

    public string GetEventTableSize() => Rows("SELECT COUNT(*) FROM gamelog_event");

    public string GetExternalTableSize() => Rows("SELECT COUNT(*) FROM gamelog_external");
}
