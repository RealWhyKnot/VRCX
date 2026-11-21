using System.Globalization;
using System.Data.SQLite;
using VRCX.Database;

namespace VRCX;

internal static partial class DatabaseNative
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    public static async Task Main(string[] args)
    {
        if (args.Length != 1)
        {
            throw new ArgumentException("Pass the path to an existing database copy at an earlier schema version", nameof(args));
        }

        DirectoryInfo scratch = Directory.CreateTempSubdirectory("vrcx-database-test-");
        try
        {
            string fresh = Path.Join(scratch.FullName, "fresh.sqlite3");
            using (File.Create(DatabaseUpgrade.UpgradedPath(fresh))) { }
            using (var db = new SQLiteDatabase())
            {
                DatabaseApi api = Start(db, fresh, freshConfig: true);
                CheckSchema(db);
                CheckAccountMigration(db, api);
                CheckSightingPrune(db, api);
                CheckRetainedHistory(db, api);
                CheckFriendHistoryPages(db, api);
                Ensure(!File.Exists(DatabaseUpgrade.BackupPath(db.DataSource)), "Fresh startup created a backup");
                await CheckTransactionsAsync(db, api).ConfigureAwait(false);
            }
            Console.WriteLine("Passed fresh startup from an empty file and concurrent transaction rollback");

            CheckExistingStartup(args[0], Path.Join(scratch.FullName, "legacy.sqlite3"));
        }
        finally
        {
            scratch.Delete(recursive: true);
        }
    }

    private static void CheckExistingStartup(string sourcePath, string legacy)
    {
        File.Copy(sourcePath, legacy);
        long expected;
        long previousVersion;
        using (var source = SQLiteDatabase.OpenReadOnly(legacy))
        {
            previousVersion = Number(source, "PRAGMA user_version");
            Ensure(previousVersion is >= 1 and <= 4, "Unexpected database copy version");
            Ensure(Number(source, "PRAGMA cache_size") != -32768, "Read-only source opened with the writable cache settings");
            try
            {
                _ = source.ExecuteNonQuery("CREATE TABLE test_read_only (id)");
                throw new InvalidOperationException("The source database allowed a write");
            }
            catch (SQLiteException error) when (error.Message.Contains("read only", StringComparison.OrdinalIgnoreCase) ||
                                                error.Message.Contains("readonly", StringComparison.OrdinalIgnoreCase))
            {
            }
            expected = Number(source, "SELECT COUNT(*) FROM gamelog_join_leave");
        }

        string backup = DatabaseUpgrade.BackupPath(DatabaseUpgrade.UpgradedPath(legacy));
        using (var db = new SQLiteDatabase())
        {
            DatabaseApi api = Start(db, legacy, freshConfig: false);
            CheckSchema(db);
            CheckExistingPlatformUpgrade(db, api);
            Ensure(Number(db, "SELECT COUNT(*) FROM gamelog_join_leave") == expected, "Startup changed the existing game-log row count");
            if (previousVersion < 4)
            {
                Ensure(File.Exists(backup), "The upgrade did not create a backup");
                using var copy = SQLiteDatabase.OpenReadOnly(backup);
                Ensure(Number(copy, "PRAGMA user_version") == previousVersion, "Backup version differs from the previous schema");
                File.SetLastWriteTimeUtc(backup, DateTime.UnixEpoch);
            }
            else
            {
                Ensure(!File.Exists(backup), "Account migration created a global backup");
            }
        }

        using (var restarted = new SQLiteDatabase())
        {
            _ = Start(restarted, legacy, freshConfig: false);
            CheckSchema(restarted);
            Ensure(previousVersion < 4 ? File.GetLastWriteTimeUtc(backup) == DateTime.UnixEpoch : !File.Exists(backup),
                "Startup repeated the completed migration");
        }

        using (var source = SQLiteDatabase.OpenReadOnly(legacy))
        {
            Ensure(Number(source, "PRAGMA user_version") == previousVersion, "Import changed the read-only source's schema version");
            Ensure(Number(source, "SELECT COUNT(*) FROM gamelog_join_leave") == expected, "Import changed the read-only source's rows");
        }
        Console.WriteLine($"Passed startup from the existing database copy, read-only import, and restart ({expected.ToString(CultureInfo.InvariantCulture)} game-log rows)");
    }

    private static DatabaseApi Start(SQLiteDatabase db, string path, bool freshConfig)
    {
        Program.ConfigLocation = path;
        db.Init();
        if (freshConfig)
        {
            Ensure(Number(db, "SELECT COUNT(*) FROM sqlite_schema") == 0, "Expected an empty database file");
        }

        var api = new DatabaseApi();
        api.CreateConfigTable();
        const string VersionKey = "config:vrcx_databaseversion";
        string expectedConfig = freshConfig ? "[]" : """[["18"]]""";
        Ensure(string.Equals(api.GetConfigValue(VersionKey), expectedConfig, StringComparison.Ordinal), "Unexpected startup configuration");
        api.CreateGlobalTables();
        if (freshConfig)
        {
            api.CleanLegendFromFriendLog();
            Ensure(string.Equals(api.GetTravelingLeaveRows(), "[]", StringComparison.Ordinal), "Unexpected traveling rows on first start");
            api.FixNegativeGpsTimes();
            Ensure(string.Equals(api.GetGameLogInstancesTime(), "[]", StringComparison.Ordinal) && string.Equals(api.GetOnPlayerLeftRowsWithTime(), "[]", StringComparison.Ordinal), "Unexpected leave rows on first start");
            api.ResetLeaveTimes([]);
            api.DeleteGroupInviteNotifications();
            api.DeleteBrokenNotifications();
            api.DeleteOldGroupChangeNotifications();
            api.FixCancelFriendRequestTypo();
            Ensure(string.Equals(api.GetBrokenGameLogDisplayNames(), "[]", StringComparison.Ordinal), "Unexpected display-name repairs on first start");
            api.UpdateTableForGroupNames();
            api.AddFriendLogFriendNumberColumn();
            api.AddAvatarHistoryTimeColumn();
            api.AddFriendLogHistoryUserIdIndexes();
            api.AddFeedBioLinkColumns();
            api.VacuumDatabase();
            api.OptimizeDatabase();
            api.SetConfigValue(VersionKey, "18");
        }
        api.InitializeAccount("usr_review001");
        Ensure(Number(db, "SELECT count(*) FROM account_schema") >= 1, "Account schema completion was not recorded");
        return api;
    }

    private static void CheckAccountMigration(SQLiteDatabase db, DatabaseApi api)
    {
        _ = db.ExecuteNonQuery("""
            CREATE TRIGGER fail_account_migration BEFORE INSERT ON account_schema
            BEGIN SELECT RAISE(ABORT, 'account migration test'); END
            """);
        api.InitializeAccount("usr_review001");
        try
        {
            api.InitializeAccount("usr_review002");
            throw new InvalidOperationException("The account migration unexpectedly succeeded");
        }
        catch (SQLiteException error) when (error.Message.Contains("account migration test", StringComparison.Ordinal))
        {
        }
        Ensure(Number(db, "SELECT COUNT(*) FROM sqlite_schema WHERE name = 'usrreview002_friend_log_current'") == 0,
            "Failed account migration left tables behind");
        Ensure(Number(db, "SELECT COUNT(*) FROM account_schema") == 1, "Failed account migration recorded completion");
        _ = db.ExecuteNonQuery("DROP TRIGGER fail_account_migration");
        api.InitializeAccount("usr_review002");
        Ensure(Number(db, "SELECT COUNT(*) FROM account_schema") == 2, "Account migration did not retry");
        api.InitializeAccount("usr_review001");
    }

    private static void CheckSightingPrune(SQLiteDatabase db, DatabaseApi api)
    {
        _ = db.ExecuteNonQuery("""
            INSERT INTO usrreview001_instance_sightings (id, created_at, location) VALUES (2, '', ''), (7, '', ''), (20, '', '');
            INSERT INTO usrreview001_instance_sighting_people (sighting_id) VALUES (2), (7), (20);
            """);
        api.PruneInstanceSightings(2);
        api.PruneInstanceSightings(2);
        Ensure(Number(db, "SELECT MIN(id) FROM usrreview001_instance_sightings") == 7, "Sightings retained the wrong rows");
        Ensure(Number(db, "SELECT COUNT(*) FROM usrreview001_instance_sighting_people") == 2, "Sightings left stale people rows");
        api.PruneInstanceSightings(0);
        Ensure(Number(db, "SELECT COUNT(*) FROM usrreview001_instance_sightings") == 0, "Sightings could not clear all rows");
    }

    private static void CheckSchema(SQLiteDatabase db)
    {
        Ensure(Number(db, "PRAGMA user_version") == 4, "Startup did not migrate to version 4");
        Ensure(Number(db, "SELECT COUNT(*) FROM schema_migrations") == 4, "Migration history is incomplete");
        Ensure(Number(db, "SELECT COUNT(*) FROM sqlite_schema WHERE name IN ('idx_gamelog_jl_activity_start', 'idx_gamelog_jl_repeat_encounters')") == 2,
            "The game-log indexes were not created");
        Ensure(Number(db, "PRAGMA cache_size") == -32768 && Number(db, "PRAGMA synchronous") == 1 && Number(db, "PRAGMA temp_store") == 2,
            "The writable connection is missing its tuning settings");
        Ensure(db.Execute("PRAGMA quick_check")[0][0] is "ok", "SQLite quick_check failed");
    }

    private static async Task CheckTransactionsAsync(SQLiteDatabase db, DatabaseApi api)
    {
        using var active = new ManualResetEventSlim();
        using var release = new ManualResetEventSlim();
        using var ready = new CountdownEvent(4);
        Task first = WorkerAsync(() =>
        {
            try
            {
                db.ExecuteTransaction(() =>
                {
                    _ = db.ExecuteNonQuery("INSERT INTO configs VALUES ('rollback', 'marker')");
                    active.Set();
                    Ensure(release.Wait(Timeout), "Timed out waiting to roll back");
                    throw new InvalidOperationException("rollback test");
                });
            }
            catch (InvalidOperationException error) when (string.Equals(error.Message, "rollback test", StringComparison.Ordinal))
            {
            }
        });

        Ensure(active.Wait(Timeout), "The first transaction did not start");
        Task[] competitors =
        [
            CompeteAsync(() => _ = db.ExecuteNonQuery("INSERT INTO configs VALUES ('independent', 'marker')")),
            CompeteAsync(() => Ensure(api.AddGamelogJoinLeave("2026-11-20T00:00:00.000Z", "OnPlayerLeft", "single", location: null, userId: null, time: 0) > 0, "Single write was lost")),
            CompeteAsync(() => Ensure(!string.Equals(api.AddGamelogJoinLeaveBulk("""[["2026-11-20T00:00:00.000Z","OnPlayerLeft","bulk",null,null,0]]"""), "[]", StringComparison.Ordinal), "Bulk write was lost")),
            CompeteAsync(() =>
            {
                Ensure(Number(db, "SELECT COUNT(*) FROM configs WHERE key = 'rollback'") == 0, "Read saw an uncommitted row");
                db.ExecuteTransaction(() => _ = db.ExecuteNonQuery("INSERT INTO configs VALUES ('second', 'marker')"));
            }),
        ];
        try
        {
            Ensure(ready.Wait(Timeout), "Competing database calls did not start");
            var pause = Task.Delay(TimeSpan.FromMilliseconds(150));
            Ensure(await Task.WhenAny([pause, .. competitors]).ConfigureAwait(false) == pause, "A competing database call ran inside the first transaction");
        }
        finally
        {
            release.Set();
        }
        await Task.WhenAll([first, .. competitors]).WaitAsync(Timeout).ConfigureAwait(false);
        Ensure(Number(db, "SELECT COUNT(*) FROM configs WHERE key IN ('independent', 'second')") == 2, "Rollback lost a competing write");
        Ensure(Number(db, "SELECT COUNT(*) FROM gamelog_join_leave") == 2, "Rollback lost a game-log write");

        Task CompeteAsync(Action work) => WorkerAsync(() =>
        {
            ready.Signal();
            work();
        });
    }

    private static Task WorkerAsync(Action work) => Task.Factory.StartNew(work, CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);

    private static long Number(SQLiteDatabase db, string sql) => Convert.ToInt64(db.Execute(sql)[0][0], CultureInfo.InvariantCulture);

    private static void Ensure(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
