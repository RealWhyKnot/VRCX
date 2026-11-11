using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
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
    ];

    private void ApplyMigrations()
    {
        _ = Run("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
        long version = Convert.ToInt64(Store.Execute("PRAGMA user_version")[0][0], CultureInfo.InvariantCulture);
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
