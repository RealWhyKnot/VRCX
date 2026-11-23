using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const string RetainedBadgeDetailIndex = "CREATE INDEX IF NOT EXISTS retained_event_badge_detail_idx ON retained_event (account, kind, detail, id DESC) WHERE kind = 'badge'";
    private const string RetainedBadgeTimeIndex = "CREATE INDEX IF NOT EXISTS retained_event_badge_time_idx ON retained_event (account, kind, created_at, id DESC) WHERE kind = 'badge'";
    private static readonly string[][] MigrationSteps =
    [
        [
            "DELETE FROM favorite_world WHERE id NOT IN (SELECT MIN(id) FROM favorite_world GROUP BY world_id, group_name)",
            "CREATE UNIQUE INDEX IF NOT EXISTS favorite_world_item_group_idx ON favorite_world (world_id, group_name)",
            "DELETE FROM favorite_avatar WHERE id NOT IN (SELECT MIN(id) FROM favorite_avatar GROUP BY avatar_id, group_name)",
            "CREATE UNIQUE INDEX IF NOT EXISTS favorite_avatar_item_group_idx ON favorite_avatar (avatar_id, group_name)",
            "DELETE FROM favorite_friend WHERE id NOT IN (SELECT MIN(id) FROM favorite_friend GROUP BY user_id, group_name)",
            "CREATE UNIQUE INDEX IF NOT EXISTS favorite_friend_item_group_idx ON favorite_friend (user_id, group_name)",
        ],
        [
            $"CREATE INDEX IF NOT EXISTS idx_gamelog_jl_activity_start ON gamelog_join_leave (({InstanceActivityStartKey})) WHERE type = 'OnPlayerLeft'",
            "CREATE INDEX IF NOT EXISTS idx_gamelog_jl_repeat_encounters ON gamelog_join_leave (user_id, created_at, id, location, time, display_name) WHERE type = 'OnPlayerLeft' AND user_id != ''",
        ],
        [
            "CREATE TABLE IF NOT EXISTS account_schema (account TEXT PRIMARY KEY, version INTEGER NOT NULL) WITHOUT ROWID",
        ],
        [
            "CREATE TABLE IF NOT EXISTS retained_event (id INTEGER PRIMARY KEY, account TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)",
            "CREATE INDEX IF NOT EXISTS retained_event_subject_idx ON retained_event (account, kind, subject, id DESC)",
            "CREATE INDEX IF NOT EXISTS retained_event_stream_idx ON retained_event (account, kind, id DESC)",
            "CREATE INDEX IF NOT EXISTS retained_event_retention_idx ON retained_event (kind, id DESC)",
            RetainedBadgeDetailIndex,
            RetainedBadgeTimeIndex,
            "CREATE TABLE IF NOT EXISTS retained_favorite_origin (account TEXT NOT NULL, kind TEXT NOT NULL, item_id TEXT NOT NULL, group_name TEXT NOT NULL, created_at TEXT, name TEXT, active INTEGER NOT NULL, touched_at TEXT NOT NULL, PRIMARY KEY (account, kind, item_id, group_name)) WITHOUT ROWID",
            "CREATE INDEX IF NOT EXISTS retained_favorite_inactive_idx ON retained_favorite_origin (touched_at) WHERE active = 0",
            "CREATE TABLE IF NOT EXISTS retained_favorite_snapshot (account TEXT PRIMARY KEY, touched_at TEXT NOT NULL) WITHOUT ROWID",
        ],
    ];

    private long ReadSchemaVersion() => Convert.ToInt64(Store.Execute("PRAGMA user_version")[0][0], CultureInfo.InvariantCulture);

    private void ApplyMigrations()
    {
        _ = Run("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
        long version = ReadSchemaVersion();
        if (version >= MigrationSteps.Length)
        {
            return;
        }

        if (version > 0)
        {
            Store.BackupTo(DatabaseUpgrade.BackupPath(Store.DataSource));
        }

        for (long step = Math.Max(version, 0); step < MigrationSteps.Length; step++)
        {
            ApplyMigrationStep(step);
        }
    }

    private void ApplyMigrationStep(long index)
    {
        long version = index + 1;
        Store.ExecuteTransaction(
        [
            .. MigrationSteps[index],
            string.Create(CultureInfo.InvariantCulture, $"INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES ({version}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"),
            string.Create(CultureInfo.InvariantCulture, $"PRAGMA user_version = {version}"),
        ]);
    }
}
