using System.Text.Json;
using VRCX.Database;

namespace VRCX;

internal static partial class DatabaseNative
{
    private const string Account = "usr_review001";
    private const string FirstTime = "2026-11-20T01:00:00.000Z";
    private const string SecondTime = "2026-11-20T02:00:00.000Z";

    private static void CheckExistingPlatformUpgrade(SQLiteDatabase db, DatabaseApi api)
    {
        object[][] tables = db.Execute("""
            SELECT name FROM sqlite_schema WHERE type = 'table' AND name GLOB 'usr*_feed_online_offline'
                AND name != 'usrreview001_feed_online_offline'
            LIMIT 1
            """);
        Ensure(tables.Length == 1 && tables[0][0] is string, "Existing feed table was missing");
        string table = (string)tables[0][0];
        api.InitializeAccount(table[..^"_feed_online_offline".Length]);
        Ensure(Number(db, """
            SELECT COUNT(*) FROM pragma_table_info(
                (SELECT name FROM sqlite_schema WHERE type = 'table' AND name GLOB 'usr*_feed_online_offline'
                    AND name != 'usrreview001_feed_online_offline' LIMIT 1)
            ) WHERE name = 'platform'
            """) == 1, "Existing feed was missing the platform column");
        Ensure(db.Execute("SELECT 1 FROM sqlite_schema WHERE name = @name", new Dictionary<string, object?>(StringComparer.Ordinal) { ["@name"] = $"{table}_platform_idx" }).Length == 1,
            "Existing feed was missing the platform history index");
    }

    private static void CheckRetainedHistory(SQLiteDatabase db, DatabaseApi api)
    {
        CheckAvatarObservations(api);
        CheckProfileAndPlatform(api);
        CheckFavoriteHistory(api);
        CheckBadgeRetention(db, api);
        Console.WriteLine("Passed retained history, feed platform, pagination, and pruning checks");
    }

    private static void CheckAvatarObservations(DatabaseApi api)
    {
        api.AppendRetainedEvents(Account, """
            [
              {"kind":"avatar","subject":"display:Observer","createdAt":"2026-11-20T01:00:00.000Z","data":{"displayName":"Observer","avatarName":"First","location":"instance","source":"game-log"}},
              {"kind":"avatar","subject":"usr_other","createdAt":"2026-11-20T01:00:01.000Z","data":{"displayName":"Observer","avatarName":"First","location":"instance","source":"photon","avatarId":"avtr_first","authorId":"usr_author"}},
              {"kind":"avatar","subject":"usr_other","createdAt":"2026-11-20T01:00:02.000Z","data":{"displayName":"Observer","avatarName":"First","location":"instance","source":"game-log"}},
              {"kind":"avatar","subject":"usr_other","createdAt":"2026-11-20T01:01:00.000Z","data":{"displayName":"Observer","avatarName":"First","location":"instance","source":"photon","avatarId":"avtr_second"}}
            ]
            """);
        using var history = JsonDocument.Parse(api.GetPlayerAvatarHistory("usr_other", beforeId: null, limit: 1));
        long id = history.RootElement[0][0].GetInt64();
        using var older = JsonDocument.Parse(api.GetPlayerAvatarHistory("usr_other", id, limit: 50));
        Ensure(older.RootElement.GetArrayLength() == 1, "Avatar observations did not merge and page correctly");
        string? olderData = older.RootElement[0][4].GetString();
        Ensure(olderData is not null && olderData.Contains("avtr_first", StringComparison.Ordinal) &&
            olderData.Contains("usr_author", StringComparison.Ordinal), "Merged avatar data is incomplete");

        api.AppendRetainedEvents(Account, """
            [
              {"kind":"avatar","subject":"usr_switcher","createdAt":"2026-11-20T01:00:00.000Z","data":{"displayName":"Switcher","avatarName":"First","location":"instance","source":"game-log"}},
              {"kind":"avatar","subject":"usr_switcher","createdAt":"2026-11-20T01:00:01.000Z","data":{"displayName":"Switcher","avatarName":"Second","location":"instance","source":"game-log"}},
              {"kind":"avatar","subject":"usr_switcher","createdAt":"2026-11-20T01:00:02.000Z","data":{"displayName":"Switcher","avatarName":"First","location":"instance","source":"photon","avatarId":"avtr_first"}}
            ]
            """);
        using var switches = JsonDocument.Parse(api.GetPlayerAvatarHistory("usr_switcher", beforeId: null, limit: 50));
        Ensure(switches.RootElement.GetArrayLength() == 3, "A real avatar change was merged past an intervening change");
    }

    private static void CheckProfileAndPlatform(DatabaseApi api)
    {
        api.AppendRetainedEvents(Account, """
            [
              {"kind":"profile","subject":"usr_other","createdAt":"2026-11-20T01:00:00.000Z","data":{"bio":"First","pronouns":"they/them","tags":["one"]}},
              {"kind":"profile","subject":"usr_other","createdAt":"2026-11-20T02:00:00.000Z","data":{"bio":"First"}},
              {"kind":"profile","subject":"usr_other","createdAt":"2026-11-20T03:00:00.000Z","data":{"bio":""}}
            ]
            """);
        using var profile = JsonDocument.Parse(api.GetProfileHistory("usr_other", beforeId: null, limit: 50));
        Ensure(profile.RootElement.GetArrayLength() == 4, "Profile changes were missed or duplicated");
        using var baselines = JsonDocument.Parse(api.GetRetainedProfileBaselines(Account, """["usr_other","usr_unseen"]"""));
        Ensure(baselines.RootElement.GetArrayLength() == 2, "Profile baseline lookup missed subjects");
        JsonElement fields = baselines.RootElement.EnumerateArray().Single(row => row[0].GetString() is "usr_other");
        Ensure(fields[1].GetString() is "\"\"" && fields[2].GetString() is "\"they/them\"" && fields[3].GetString() is "[\"one\"]",
            "Profile baselines did not return each latest field");
        JsonElement unseen = baselines.RootElement.EnumerateArray().Single(row => row[0].GetString() is "usr_unseen");
        Ensure(unseen.EnumerateArray().Skip(1).All(value => value.ValueKind == JsonValueKind.Null), "Unseen profiles unexpectedly had stored fields");
        using var otherAccount = JsonDocument.Parse(api.GetRetainedProfileBaselines("usr_review002", """["usr_other"]"""));
        Ensure(otherAccount.RootElement[0].EnumerateArray().Skip(1).All(value => value.ValueKind == JsonValueKind.Null), "Profile baseline lookup crossed accounts");

        long onlineId = api.AddFeedOnlineOffline(FirstTime, "usr_other", "Platform Test", "Online", "room", "name", time: null, groupName: null, platform: "android");
        _ = api.AddFeedOnlineOffline(SecondTime, "usr_other", "Platform Test", "Offline", "room", "name", time: null, groupName: null, platform: "standalonewindows");
        _ = api.AddFeedOnlineOffline(SecondTime, "usr_other", "Platform Test", "Online", "room", "name", time: null, groupName: null, platform: null);

        using var feed = JsonDocument.Parse(api.LookupFeed([], [], 10));
        using var search = JsonDocument.Parse(api.SearchFeed("Platform Test", ["Online"], [], 10, "", ""));
        Ensure(feed.RootElement[0][24].ValueKind == JsonValueKind.Null && search.RootElement[1][24].GetString() is "android", "Feed readers dropped the platform");

        using var platforms = JsonDocument.Parse(api.GetFriendPlatformHistory("usr_other", beforeId: null, limit: 1));
        JsonElement current = platforms.RootElement[0];
        using var data = JsonDocument.Parse(current[4].GetString() ?? "");
        Ensure(data.RootElement.GetProperty("platform").GetString() is "standalonewindows" &&
            data.RootElement.GetProperty("state").GetString() is "offline", "Platform history did not read the latest known feed platform");
        using var previous = JsonDocument.Parse(api.GetFriendPlatformHistory("usr_other", current[0].GetInt64(), limit: 2));
        Ensure(previous.RootElement.GetArrayLength() == 1 && previous.RootElement[0][0].GetInt64() == onlineId, "Platform history cursor did not skip unknown platforms");
    }

    private static void CheckFavoriteHistory(DatabaseApi api)
    {
        api.AddWorldToFavorites("wrld_test", "group", FirstTime, "My World");
        api.AddWorldToFavorites("wrld_test", "group", SecondTime, "My World");
        api.RemoveWorldFromFavorites("wrld_test", "group", "My World");
        api.AddWorldToFavorites("wrld_test", "group", SecondTime, "My World");
        using var favorites = JsonDocument.Parse(api.GetWorldFavorites());
        Ensure(favorites.RootElement[0][1].GetString() is FirstTime, "Favorite re-add replaced its original timestamp");

        api.AppendRetainedEvents(Account, """
            [
              {"kind":"remote-favorites","subject":"usr_review001","createdAt":"2026-11-20T01:00:00.000Z","data":[{"type":"world","itemId":"wrld_old","group":"group"}]},
              {"kind":"remote-favorites","subject":"usr_review001","createdAt":"2026-11-20T02:00:00.000Z","data":[{"type":"world","itemId":"wrld_new","group":"group"}]},
              {"kind":"remote-favorites","subject":"usr_review001","createdAt":"2026-11-20T03:00:00.000Z","data":[{"type":"world","itemId":"wrld_new","group":"group"}]}
            ]
            """);
        using var history = JsonDocument.Parse(api.GetFavoriteHistory(beforeId: null, limit: 50));
        Ensure(history.RootElement.GetArrayLength() == 5, "Favorite sync logged duplicate or baseline events");
        api.InitializeAccount("usr_review002");
        using var other = JsonDocument.Parse(api.GetFavoriteHistory(beforeId: null, limit: 50));
        Ensure(other.RootElement.GetArrayLength() == 0, "Favorite history crossed account boundaries");
        api.InitializeAccount(Account);
    }

    private static void CheckBadgeRetention(SQLiteDatabase db, DatabaseApi api)
    {
        api.AppendRetainedEvents(Account, """
            [{"kind":"badge","subject":"usr_review001","createdAt":"2026-11-20T01:00:00.000Z",
              "data":{"badgeId":"bdg_test","action":"add","name":"Test","description":"Award","imageUrl":"https://example.test/badge"}}]
            """);
        using var badges = JsonDocument.Parse(api.GetBadgeHistory(beforeId: null, limit: 50));
        string? badgeData = badges.RootElement[0][4].GetString();
        Ensure(badgeData is not null && badgeData.Contains("example.test/badge", StringComparison.Ordinal), "Badge metadata was lost");
        _ = db.ExecuteNonQuery("""
            WITH RECURSIVE ids(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM ids WHERE n < 5002)
            INSERT INTO retained_event(account, kind, subject, detail, created_at, data)
            SELECT 'usrreview001', 'badge', 'usrreview001', 'test', '', '{}' FROM ids
            """);
        api.PruneRetainedEvents();
        Ensure(Number(db, "SELECT COUNT(*) FROM retained_event WHERE kind = 'badge'") == 5000, "History pruning exceeded its retention limit");
    }
}
