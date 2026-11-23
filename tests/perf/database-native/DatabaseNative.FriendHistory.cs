using System.Text.Json;
using VRCX.Database;

namespace VRCX;

internal static partial class DatabaseNative
{
    private static void CheckFriendHistoryPages(SQLiteDatabase db, DatabaseApi api)
    {
        _ = db.ExecuteNonQuery("""
            INSERT INTO usrreview001_friend_log_history(id,created_at,type,user_id,display_name) VALUES
            (1, '2026-11-20T01:00:00Z', 'Friend', 'usr_1', 'ÉLODIE'),
            (4, '2026-11-20T01:00:00Z', 'Unfriend', 'usr_2', 'Someone'),
            (7, '2026-11-19T01:00:00Z', 'DisplayName', 'usr_3', 'X%_Y'),
            (8, '2026-11-21T01:00:00Z', 'Friend', 'usr_4', 'élodie'),
            (12, '2026-11-18T01:00:00Z', 'TrustLevel', 'usr_5', 'Élodie');
            """);
        CheckFriendHistoryFilter(api, [], "", hide: false, [8, 4, 1, 7, 12]);
        CheckFriendHistoryFilter(api, ["friend"], "", hide: false, [8, 1]);
        CheckFriendHistoryFilter(api, [], "éLoDiE", hide: false, [8, 1, 12]);
        CheckFriendHistoryFilter(api, [], "%_", hide: false, [7]);
        CheckFriendHistoryFilter(api, [], "", hide: true, [8, 1, 7, 12]);
        CheckFriendHistoryFilter(api, ["Unfriend"], "", hide: true, []);
        CheckFriendHistoryFilter(api, [], "no match", hide: false, []);
        using var ascending = JsonDocument.Parse(api.GetFilteredFriendLogHistoryPage(2, beforeId: null, beforeDate: null, [], "", hideUnfriends: false, ascending: true));
        Ensure(ascending.RootElement[0][0].GetInt64() == 12 && ascending.RootElement[1][0].GetInt64() == 7, "Ascending friend dates changed");
        using var next = JsonDocument.Parse(api.GetFilteredFriendLogHistoryPage(5, 7, "2026-11-19T01:00:00Z", [], "", hideUnfriends: false, ascending: true));
        Ensure(next.RootElement.EnumerateArray().Select(row => row[0].GetInt64()).SequenceEqual([4L, 1L, 8L]), "Ascending friend cursor changed tie order");
        using var jump = JsonDocument.Parse(api.GetFilteredFriendLogHistoryPageAtOffset(2, 2, [], "", hideUnfriends: false, ascending: false));
        Ensure(jump.RootElement.EnumerateArray().Select(row => row[0].GetInt64()).SequenceEqual([1L, 7L]), "Direct friend page jump differs from cursor order");
        foreach (string direction in new[] { "ASC", "DESC" })
        {
            string suffix = string.Equals(direction, "ASC", StringComparison.Ordinal) ? "_date_asc_idx" : "_date_desc_idx";
            object[][] plan = db.Execute($"EXPLAIN QUERY PLAN SELECT * FROM usrreview001_friend_log_history ORDER BY coalesce(julianday(created_at), 0) {direction}, id DESC LIMIT 2");
            Ensure(plan.Any(row => row[^1] is string detail && detail.Contains(suffix, StringComparison.Ordinal)), "Friend history date index was not used");
            Ensure(plan.All(row => row[^1] is not string detail || !detail.Contains("TEMP B-TREE", StringComparison.Ordinal)), "Friend history still sorted in memory");
        }
        _ = db.ExecuteNonQuery("DELETE FROM usrreview001_friend_log_history");
        CheckNotificationState(db, api);
        Console.WriteLine("Passed friend history filters, Unicode search, date ordering, counts, cursor pages, and notification state");
    }

    private static void CheckNotificationState(SQLiteDatabase db, DatabaseApi api)
    {
        _ = db.ExecuteNonQuery("""
            INSERT INTO usrreview001_notifications(id,created_at,type,response_message) VALUES
                ('request_old', '2020-01-01', 'ignoredFriendRequest', 'autoDeclined'),
                ('invite_recent', '2026-11-20', 'invite', '');
            INSERT INTO usrreview001_notifications_v2(id,created_at,type) VALUES ('group_recent', '2026-11-20', 'group.announcement');
            """);
        using var state = JsonDocument.Parse(api.GetNotificationHistoryState("""["request_old","invite_recent","group_recent","missing"]"""));
        Ensure(state.RootElement.GetArrayLength() == 3, "Notification state missed an active or saved request ID");
        JsonElement request = state.RootElement.EnumerateArray().Single(row => row[0].GetString() is "request_old");
        Ensure(request[1].GetString() is "autoDeclined", "Notification state dropped a saved outcome");
        _ = db.ExecuteNonQuery("DELETE FROM usrreview001_notifications");
        _ = db.ExecuteNonQuery("DELETE FROM usrreview001_notifications_v2");
    }

    private static void CheckFriendHistoryFilter(DatabaseApi api, string[] types, string search, bool hide, long[] expected)
    {
        var found = new List<long>();
        long? before = null;
        string? beforeDate = null;
        while (true)
        {
            using var page = JsonDocument.Parse(api.GetFilteredFriendLogHistoryPage(2, before, beforeDate, types, search, hide, ascending: false));
            if (page.RootElement.GetArrayLength() == 0)
            {
                break;
            }
            foreach (JsonElement row in page.RootElement.EnumerateArray())
            {
                found.Add(row[0].GetInt64());
                before = row[0].GetInt64();
                beforeDate = row[1].GetString();
            }
        }
        Ensure(found.SequenceEqual(expected), "Filtered friend history page results differ");
        using var count = JsonDocument.Parse(api.GetFilteredFriendLogHistoryCount(types, search, hide));
        Ensure(count.RootElement[0][0].GetInt64() == expected.Length, "Filtered friend count differs");
    }
}
