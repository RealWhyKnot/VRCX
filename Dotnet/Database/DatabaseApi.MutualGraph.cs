using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const int MutualGraphDeleteChunkSize = 500;

    public string GetMutualGraphFriends() => _userPrefix.Length == 0 ? "[]" : Rows($"SELECT friend_id FROM {UserTable("mutual_graph_friends")}");

    public string GetMutualGraphLinks() => _userPrefix.Length == 0 ? "[]" : Rows($"SELECT friend_id, mutual_id FROM {UserTable("mutual_graph_links")}");

    public string GetMutualCounts() => _userPrefix.Length == 0 ? "[]" : Rows($"SELECT mutual_id, COUNT(*) FROM {UserTable("mutual_graph_links")} GROUP BY mutual_id");

    public string GetMutualGraphMeta() => _userPrefix.Length == 0 ? "[]" : Rows($"SELECT friend_id, last_fetched_at, opted_out FROM {UserTable("mutual_graph_meta")}");

    public void SaveMutualGraph(string[] friendIds, string[] edgeFriendIds, string[] edgeMutualIds)
    {
        if (_userPrefix.Length == 0)
        {
            return;
        }

        if (edgeFriendIds.Length != edgeMutualIds.Length)
        {
            throw new ArgumentException("The mutual graph edge columns must have the same length.", nameof(edgeMutualIds));
        }

        RunInWriteTransaction(() =>
        {
            string metaTable = UserTable("mutual_graph_meta");
            _ = Run($"DELETE FROM {UserTable("mutual_graph_links")} WHERE friend_id NOT IN (SELECT friend_id FROM {metaTable} WHERE opted_out = 1)");
            _ = Run($"DELETE FROM {UserTable("mutual_graph_friends")} WHERE friend_id NOT IN (SELECT friend_id FROM {metaTable} WHERE opted_out = 1)");
            DeleteMutualLinksOf(friendIds);
            InsertValueRows($"INSERT OR REPLACE INTO {UserTable("mutual_graph_friends")} (friend_id) VALUES", FriendRows(friendIds));
            InsertValueRows($"INSERT OR REPLACE INTO {UserTable("mutual_graph_links")} (friend_id, mutual_id) VALUES", EdgeRows(edgeFriendIds, edgeMutualIds));
        });
    }

    public void UpdateMutualsForFriend(string friendId, string[] mutualIds)
    {
        if (_userPrefix.Length == 0)
        {
            return;
        }

        _ = Run($"INSERT OR REPLACE INTO {UserTable("mutual_graph_friends")} (friend_id) VALUES (@friendId)", ("@friendId", friendId));
        _ = Run($"DELETE FROM {UserTable("mutual_graph_links")} WHERE friend_id = @friendId", ("@friendId", friendId));
        List<object?[]> rows = [];
        foreach (string mutualId in mutualIds)
        {
            rows.Add([friendId, mutualId]);
        }
        InsertValueRows($"INSERT OR REPLACE INTO {UserTable("mutual_graph_links")} (friend_id, mutual_id) VALUES", rows);
    }

    public void UpsertMutualGraphMeta(string friendId, string lastFetchedAt, bool isOptedOut)
    {
        if (_userPrefix.Length == 0)
        {
            return;
        }

        _ = Run($"""
            INSERT OR REPLACE INTO {UserTable("mutual_graph_meta")} (friend_id, last_fetched_at, opted_out)
            VALUES (@friendId, @lastFetchedAt, @optedOut)
            """,
            ("@friendId", friendId),
            ("@lastFetchedAt", lastFetchedAt),
            ("@optedOut", isOptedOut ? 1 : 0));
    }

    public void BulkUpsertMutualGraphMeta(string lastFetchedAt, string[] optedInIds, string[] optedOutIds)
    {
        if (_userPrefix.Length == 0)
        {
            return;
        }

        List<object?[]> rows = [];
        foreach (string friendId in optedInIds)
        {
            rows.Add([friendId, lastFetchedAt, 0]);
        }
        foreach (string friendId in optedOutIds)
        {
            rows.Add([friendId, lastFetchedAt, 1]);
        }
        InsertValueRows($"INSERT OR REPLACE INTO {UserTable("mutual_graph_meta")} (friend_id, last_fetched_at, opted_out) VALUES", rows);
    }

    private void DeleteMutualLinksOf(string[] friendIds)
    {
        string linkTable = UserTable("mutual_graph_links");
        foreach (string[] chunk in friendIds.Chunk(MutualGraphDeleteChunkSize))
        {
            List<(string Name, object? Value)> args = [];
            for (int index = 0; index < chunk.Length; index++)
            {
                args.Add(($"@id{index.ToString(CultureInfo.InvariantCulture)}", chunk[index]));
            }
            _ = Run($"DELETE FROM {linkTable} WHERE friend_id IN ({InPlaceholders("id", chunk.Length)})", [.. args]);
        }
    }

    private static List<object?[]> FriendRows(string[] friendIds)
    {
        List<object?[]> rows = [];
        foreach (string friendId in friendIds)
        {
            rows.Add([friendId]);
        }
        return rows;
    }

    private static List<object?[]> EdgeRows(string[] friendIds, string[] mutualIds)
    {
        List<object?[]> rows = [];
        for (int index = 0; index < friendIds.Length; index++)
        {
            rows.Add([friendIds[index], mutualIds[index]]);
        }
        return rows;
    }
}
