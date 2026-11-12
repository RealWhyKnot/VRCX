namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public void AddInstanceSighting(string createdAt, string location, string worldId, string worldName, string creatorId, string creatorName, long userCount, long capacity, string[] userIds, string[] fileIds, string[] displayNames, string[] isFriend)
    {
        if (userIds.Length != fileIds.Length || userIds.Length != displayNames.Length || userIds.Length != isFriend.Length)
        {
            throw new ArgumentException("The sighting people columns must have the same length.", nameof(userIds));
        }

        RunInWriteTransaction(() =>
        {
            long sightingId = Insert(
                $"INSERT INTO {UserTable("instance_sightings")} (created_at, location, world_id, world_name, creator_id, creator_name, user_count, capacity) VALUES (@created_at, @location, @world_id, @world_name, @creator_id, @creator_name, @user_count, @capacity)",
                ("@created_at", createdAt),
                ("@location", location),
                ("@world_id", worldId),
                ("@world_name", worldName),
                ("@creator_id", creatorId),
                ("@creator_name", creatorName),
                ("@user_count", userCount),
                ("@capacity", capacity));
            if (userIds.Length == 0)
            {
                return;
            }

            List<object?[]> rows = [];
            for (int index = 0; index < userIds.Length; index++)
            {
                rows.Add([
                    sightingId,
                    userIds[index],
                    fileIds[index],
                    displayNames[index],
                    string.Equals(isFriend[index], "1", StringComparison.Ordinal) ? 1 : 0,
                ]);
            }
            InsertValueRows($"INSERT OR IGNORE INTO {UserTable("instance_sighting_people")} (sighting_id, user_id, file_id, display_name, is_friend) VALUES", rows);
        });
    }

    public string GetInstanceSightings(long limit) => Rows($"""
        SELECT s.id, s.created_at, s.location,
            COALESCE(NULLIF(s.world_name, ''), (SELECT w.name FROM cache_world w WHERE w.id = s.world_id), ''),
            s.creator_id,
            COALESCE(
                NULLIF(s.creator_name, ''),
                (SELECT o.display_name FROM picture_owners o WHERE o.user_id = s.creator_id AND o.display_name != '' LIMIT 1),
                (SELECT g.display_name FROM gamelog_join_leave g WHERE g.user_id = s.creator_id ORDER BY g.created_at DESC LIMIT 1),
                ''),
            s.user_count, s.capacity,
            (SELECT group_concat(person, char(31)) FROM (
                SELECT COALESCE(NULLIF(p.display_name, ''), NULLIF(o.display_name, '')) AS person
                FROM {UserTable("instance_sighting_people")} p
                LEFT JOIN picture_owners o ON p.file_id != '' AND o.file_id = p.file_id
                WHERE p.sighting_id = s.id
                ORDER BY p.is_friend DESC, person
            ) WHERE person IS NOT NULL),
            (SELECT COUNT(*) FROM {UserTable("instance_sighting_people")} p WHERE p.sighting_id = s.id)
        FROM {UserTable("instance_sightings")} s
        ORDER BY s.id DESC
        LIMIT @limit
        """,
        ("@limit", limit));

    public string GetUnresolvedSightingPictures(string retryFailedBefore, long limit) => Rows($"""
        SELECT p.file_id
        FROM {UserTable("instance_sighting_people")} p
        WHERE p.file_id != '' AND p.user_id = ''
            AND NOT EXISTS (
                SELECT 1 FROM picture_owners o
                WHERE o.file_id = p.file_id AND (o.kind != 'failed' OR o.resolved_at >= @retry_failed_before))
        GROUP BY p.file_id
        ORDER BY MAX(p.sighting_id) DESC
        LIMIT @limit
        """,
        ("@retry_failed_before", retryFailedBefore),
        ("@limit", limit));

    public string GetPictureOwners(long limit) => Rows(
        "SELECT file_id, kind, user_id, display_name FROM picture_owners WHERE kind IN ('user', 'avatar') ORDER BY resolved_at DESC LIMIT @limit",
        ("@limit", limit));

    public void SavePictureOwner(string fileId, string kind, string userId, string displayName, string resolvedAt) =>
        _ = Run(
            "INSERT OR REPLACE INTO picture_owners (file_id, kind, user_id, display_name, resolved_at) VALUES (@file_id, @kind, @user_id, @display_name, @resolved_at)",
            ("@file_id", fileId),
            ("@kind", kind),
            ("@user_id", userId),
            ("@display_name", displayName),
            ("@resolved_at", resolvedAt));

    private void CreateSightingTables()
    {
        string sightings = UserTable("instance_sightings");
        string people = UserTable("instance_sighting_people");
        _ = Run($"CREATE TABLE IF NOT EXISTS {sightings} (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, location TEXT NOT NULL, world_id TEXT NOT NULL DEFAULT '', world_name TEXT NOT NULL DEFAULT '', creator_id TEXT NOT NULL DEFAULT '', creator_name TEXT NOT NULL DEFAULT '', user_count INTEGER NOT NULL DEFAULT 0, capacity INTEGER NOT NULL DEFAULT 0)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {sightings}_location_idx ON {sightings} (location, created_at)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {sightings}_creator_idx ON {sightings} (creator_id)");
        _ = Run($"CREATE TABLE IF NOT EXISTS {people} (sighting_id INTEGER NOT NULL, user_id TEXT NOT NULL DEFAULT '', file_id TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', is_friend INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (sighting_id, user_id, file_id)) WITHOUT ROWID");
        _ = Run($"CREATE INDEX IF NOT EXISTS {people}_user_idx ON {people} (user_id)");
        _ = Run($"CREATE INDEX IF NOT EXISTS {people}_file_idx ON {people} (file_id)");
    }

    private void CreatePictureOwnerTable()
    {
        _ = Run("CREATE TABLE IF NOT EXISTS picture_owners (file_id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', resolved_at TEXT NOT NULL) WITHOUT ROWID");
        _ = Run("CREATE INDEX IF NOT EXISTS picture_owners_user_idx ON picture_owners (user_id)");
    }
}
