namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public void CreateUserTables()
    {
        CreateFeedTables();
        CreateActivityTables();
        CreateFriendLogTables();
        CreateNotificationAndProfileTables();
    }

    public void CreateGlobalTables()
    {
        CreateGameLogTables();
        CreateCacheAndFavoriteTables();
    }

    public void VacuumDatabase() => _ = Run("VACUUM");

    public void OptimizeDatabase() => _ = Run("PRAGMA optimize");

    private void CreateFeedTables()
    {
        string feedGps = UserTable("feed_gps");
        string feedStatus = UserTable("feed_status");
        string feedBio = UserTable("feed_bio");
        string feedAvatar = UserTable("feed_avatar");
        string feedOnlineOffline = UserTable("feed_online_offline");
        _ = Run($"CREATE TABLE IF NOT EXISTS {feedGps} (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, location TEXT, world_name TEXT, previous_location TEXT, time INTEGER, group_name TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {feedStatus} (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, status TEXT, status_description TEXT, previous_status TEXT, previous_status_description TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {feedBio} (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, bio TEXT, previous_bio TEXT, bio_links TEXT, previous_bio_links TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {feedAvatar} (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, owner_id TEXT, avatar_name TEXT, current_avatar_image_url TEXT, current_avatar_thumbnail_image_url TEXT, previous_current_avatar_image_url TEXT, previous_current_avatar_thumbnail_image_url TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {feedOnlineOffline} (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, type TEXT, location TEXT, world_name TEXT, time INTEGER, group_name TEXT)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {feedOnlineOffline}_user_created_idx ON {feedOnlineOffline} (user_id, created_at)");
    }

    private void CreateActivityTables()
    {
        string syncState = UserTable("activity_sync_state_v2");
        string sessions = UserTable("activity_sessions_v2");
        string bucketCache = UserTable("activity_bucket_cache_v2");
        _ = Run($"CREATE TABLE IF NOT EXISTS {syncState} (user_id TEXT PRIMARY KEY, updated_at TEXT NOT NULL DEFAULT '', is_self INTEGER NOT NULL DEFAULT 0, source_last_created_at TEXT NOT NULL DEFAULT '', pending_session_start_at INTEGER, cached_range_days INTEGER NOT NULL DEFAULT 0)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {sessions} (session_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, start_at INTEGER NOT NULL, end_at INTEGER NOT NULL, is_open_tail INTEGER NOT NULL DEFAULT 0, source_revision TEXT NOT NULL DEFAULT '')");
        _ = Run($"CREATE INDEX IF NOT EXISTS {sessions}_user_start_idx ON {sessions} (user_id, start_at)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {sessions}_user_end_idx ON {sessions} (user_id, end_at)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {bucketCache} (user_id TEXT NOT NULL, target_user_id TEXT NOT NULL DEFAULT '', range_days INTEGER NOT NULL, view_kind TEXT NOT NULL, exclude_key TEXT NOT NULL DEFAULT '', bucket_version INTEGER NOT NULL DEFAULT 1, raw_buckets_json TEXT NOT NULL DEFAULT '[]', normalized_buckets_json TEXT NOT NULL DEFAULT '[]', built_from_cursor TEXT NOT NULL DEFAULT '', summary_json TEXT NOT NULL DEFAULT '{{}}', built_at TEXT NOT NULL DEFAULT '', PRIMARY KEY (user_id, target_user_id, range_days, view_kind, exclude_key))");
    }

    private void CreateFriendLogTables()
    {
        string friendLogCurrent = UserTable("friend_log_current");
        string friendLogHistory = UserTable("friend_log_history");
        _ = Run($"CREATE TABLE IF NOT EXISTS {friendLogCurrent} (user_id TEXT PRIMARY KEY, display_name TEXT, trust_level TEXT, friend_number INTEGER)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {friendLogHistory} (id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, user_id TEXT, display_name TEXT, previous_display_name TEXT, trust_level TEXT, previous_trust_level TEXT, friend_number INTEGER)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {friendLogHistory}_user_id_idx ON {friendLogHistory} (user_id)");
    }

    private void CreateNotificationAndProfileTables()
    {
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("notifications")} (id TEXT PRIMARY KEY, created_at TEXT, type TEXT, sender_user_id TEXT, sender_username TEXT, receiver_user_id TEXT, message TEXT, world_id TEXT, world_name TEXT, image_url TEXT, invite_message TEXT, request_message TEXT, response_message TEXT, expired INTEGER)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("notifications_v2")} (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, expires_at TEXT, type TEXT, link TEXT, link_text TEXT, message TEXT, title TEXT, image_url TEXT, seen INTEGER, sender_user_id TEXT, sender_username TEXT, data TEXT, responses TEXT, details TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("moderation")} (user_id TEXT PRIMARY KEY, updated_at TEXT, display_name TEXT, block INTEGER, mute INTEGER)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("avatar_history")} (avatar_id TEXT PRIMARY KEY, created_at TEXT, time INTEGER)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("notes")} (user_id TEXT PRIMARY KEY, display_name TEXT, note TEXT, created_at TEXT)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("mutual_graph_friends")} (friend_id TEXT PRIMARY KEY)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("mutual_graph_links")} (friend_id TEXT NOT NULL, mutual_id TEXT NOT NULL, PRIMARY KEY(friend_id, mutual_id))");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("mutual_graph_meta")} (friend_id TEXT PRIMARY KEY, last_fetched_at TEXT, opted_out INTEGER DEFAULT 0)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {UserTable("user_profile")} (user_id TEXT PRIMARY KEY, bio TEXT, bio_links TEXT, updated_at TEXT)");
    }

    private void CreateGameLogTables()
    {
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_location (id INTEGER PRIMARY KEY, created_at TEXT, location TEXT, world_id TEXT, world_name TEXT, time INTEGER, group_name TEXT, UNIQUE(created_at, location))");
        _ = Run("CREATE INDEX IF NOT EXISTS gamelog_location_created_at_idx ON gamelog_location (created_at)");
        _ = Run("CREATE INDEX IF NOT EXISTS idx_gamelog_location_world_created ON gamelog_location (world_id, created_at)");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_join_leave (id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, display_name TEXT, location TEXT, user_id TEXT, time INTEGER, UNIQUE(created_at, type, display_name))");
        _ = Run("CREATE INDEX IF NOT EXISTS idx_gamelog_jl_location ON gamelog_join_leave (location)");
        _ = Run("CREATE INDEX IF NOT EXISTS idx_gamelog_jl_user_created ON gamelog_join_leave (user_id, created_at)");
        _ = Run("CREATE INDEX IF NOT EXISTS idx_gamelog_jl_display_created ON gamelog_join_leave (display_name, created_at)");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_portal_spawn (id INTEGER PRIMARY KEY, created_at TEXT, display_name TEXT, location TEXT, user_id TEXT, instance_id TEXT, world_name TEXT, UNIQUE(created_at, display_name))");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_video_play (id INTEGER PRIMARY KEY, created_at TEXT, video_url TEXT, video_name TEXT, video_id TEXT, location TEXT, display_name TEXT, user_id TEXT, UNIQUE(created_at, video_url))");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_resource_load (id INTEGER PRIMARY KEY, created_at TEXT, resource_url TEXT, resource_type TEXT, location TEXT, UNIQUE(created_at, resource_url))");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_event (id INTEGER PRIMARY KEY, created_at TEXT, data TEXT, UNIQUE(created_at, data))");
        _ = Run("CREATE TABLE IF NOT EXISTS gamelog_external (id INTEGER PRIMARY KEY, created_at TEXT, message TEXT, display_name TEXT, user_id TEXT, location TEXT, UNIQUE(created_at, message))");
    }

    private void CreateCacheAndFavoriteTables()
    {
        _ = Run("CREATE TABLE IF NOT EXISTS cache_avatar (id TEXT PRIMARY KEY, added_at TEXT, author_id TEXT, author_name TEXT, created_at TEXT, description TEXT, image_url TEXT, name TEXT, release_status TEXT, thumbnail_image_url TEXT, updated_at TEXT, version INTEGER)");
        _ = Run("CREATE TABLE IF NOT EXISTS cache_world (id TEXT PRIMARY KEY, added_at TEXT, author_id TEXT, author_name TEXT, created_at TEXT, description TEXT, image_url TEXT, name TEXT, release_status TEXT, thumbnail_image_url TEXT, updated_at TEXT, version INTEGER)");
        _ = Run("CREATE TABLE IF NOT EXISTS favorite_world (id INTEGER PRIMARY KEY, created_at TEXT, world_id TEXT, group_name TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS favorite_print (id INTEGER PRIMARY KEY, print_id TEXT UNIQUE, created_at TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS favorite_avatar (id INTEGER PRIMARY KEY, created_at TEXT, avatar_id TEXT, group_name TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS favorite_friend (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, group_name TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS memos (user_id TEXT PRIMARY KEY, edited_at TEXT, memo TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS world_memos (world_id TEXT PRIMARY KEY, edited_at TEXT, memo TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS avatar_memos (avatar_id TEXT PRIMARY KEY, edited_at TEXT, memo TEXT)");
        _ = Run("CREATE TABLE IF NOT EXISTS avatar_tags (avatar_id TEXT NOT NULL, tag TEXT NOT NULL, color TEXT, PRIMARY KEY (avatar_id, tag))");
    }
}
