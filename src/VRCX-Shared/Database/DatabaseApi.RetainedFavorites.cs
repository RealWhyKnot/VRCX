using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private void ChangeLocalFavorite(string kind, string table, string itemColumn, string item, string group, string? name, string? createdAt, bool add) =>
        Store.ExecuteTransaction(() => _ = WriteLocalFavorite(kind, table, itemColumn, item, group, name, createdAt, add));

    private string? WriteLocalFavorite(string kind, string table, string itemColumn, string item, string group, string? name, string? createdAt, bool add)
    {
        string now = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
        bool isPrint = string.Equals(kind, "print", StringComparison.Ordinal);
        string groupCondition = isPrint ? string.Empty : " AND group_name IS @group";
        (string Name, object? Value)[] itemArgs = isPrint ? [("@item", item)] : [("@item", item), ("@group", group)];
        object[][] existing = Store.Execute($"SELECT created_at FROM {table} WHERE {itemColumn} = @item{groupCondition}", ToArguments(itemArgs));
        if (add == (existing.Length != 0))
        {
            return name;
        }

        string? original = existing.Length == 0 ? createdAt : existing[0][0] is string existingAt ? existingAt : null;
        if (_userPrefix.Length != 0)
        {
            object[][] prior = Store.Execute("""
                SELECT created_at, name FROM retained_favorite_origin
                WHERE account = @account AND kind = @kind AND item_id = @item AND group_name = @group
                """, ToArguments([("@account", _userPrefix), ("@kind", kind), ("@item", item), ("@group", group)]));
            if (prior.Length > 0)
            {
                original = prior[0][0] is string savedAt ? savedAt : original;
                name ??= prior[0][1] is string savedName ? savedName : null;
            }
        }

        if (add)
        {
            string columns = isPrint ? itemColumn : $"{itemColumn}, group_name";
            string values = isPrint ? "@item" : "@item, @group";
            _ = Run($"INSERT OR IGNORE INTO {table} ({columns}, created_at) VALUES ({values}, @createdAt)",
                [.. itemArgs, ("@createdAt", original)]);
        }
        else
        {
            _ = Run($"DELETE FROM {table} WHERE {itemColumn} = @item{groupCondition}", itemArgs);
        }

        if (_userPrefix.Length == 0)
        {
            return name;
        }

        _ = Run("""
            INSERT INTO retained_favorite_origin (account, kind, item_id, group_name, created_at, name, active, touched_at)
            VALUES (@account, @kind, @item, @group, @createdAt, @name, 0, @now)
            ON CONFLICT(account, kind, item_id, group_name) DO UPDATE SET
                name = coalesce(excluded.name, name), active = excluded.active, touched_at = excluded.touched_at
            """, ("@account", _userPrefix), ("@kind", kind), ("@item", item), ("@group", group),
            ("@createdAt", original), ("@name", name), ("@now", now));
        _ = Run("""
            INSERT INTO retained_event (account, kind, subject, detail, created_at, data)
            VALUES (@account, 'favorite', @item, @kind, @now,
                json_object('action', @action, 'name', @name, 'group', @group, 'originalCreatedAt', @createdAt))
            """, ("@account", _userPrefix), ("@item", item), ("@kind", kind), ("@now", now),
            ("@action", add ? "add" : "remove"), ("@name", name), ("@group", group), ("@createdAt", original));
        return name;
    }

    private void ChangeLocalFavoriteGroup(string kind, string table, string itemColumn, string group, string? newGroup)
    {
        if (string.Equals(group, newGroup, StringComparison.Ordinal))
        {
            return;
        }

        Store.ExecuteTransaction(() =>
        {
            foreach (object[] row in Store.Execute($"SELECT {itemColumn}, created_at FROM {table} WHERE group_name = @group",
                ToArguments([("@group", group)])))
            {
                if (row[0] is not string item)
                {
                    continue;
                }

                string? name = WriteLocalFavorite(kind, table, itemColumn, item, group, name: null, createdAt: null, add: false);
                if (newGroup is not null)
                {
                    _ = WriteLocalFavorite(kind, table, itemColumn, item, newGroup, name, row[1] is string originalAt ? originalAt : null, add: true);
                }
            }
        });
    }

    private const string RemoteFavoriteInput = """
        SELECT 'remote-' || (value ->> 'type') AS kind, value ->> 'itemId' AS item_id,
            value ->> 'group' AS group_name, value ->> 'name' AS name, value ->> 'createdAt' AS created_at
        FROM json_each(@data)
        """;

    private void ReconcileRemoteFavorites(string account, string now, string data)
    {
        var args = new (string Name, object? Value)[] { ("@account", account), ("@now", now), ("@data", data) };
        _ = Run($"""
            WITH incoming AS MATERIALIZED ({RemoteFavoriteInput})
            INSERT INTO retained_event (account, kind, subject, detail, created_at, data)
            SELECT @account, 'favorite', old.item_id, old.kind, @now,
                json_object('action', 'remove', 'name', old.name, 'group', old.group_name, 'originalCreatedAt', old.created_at)
            FROM retained_favorite_origin old
            WHERE old.account = @account AND old.kind LIKE 'remote-%' AND old.active = 1
              AND NOT EXISTS (SELECT 1 FROM incoming i WHERE (i.kind, i.item_id, i.group_name) = (old.kind, old.item_id, old.group_name))
            UNION ALL
            SELECT @account, 'favorite', i.item_id, i.kind, @now,
                json_object('action', 'add', 'name', coalesce(i.name, old.name), 'group', i.group_name,
                    'originalCreatedAt', coalesce(old.created_at, i.created_at, @now))
            FROM incoming i
            LEFT JOIN retained_favorite_origin old ON
                (old.account, old.kind, old.item_id, old.group_name) = (@account, i.kind, i.item_id, i.group_name)
            WHERE coalesce(old.active, 0) = 0 AND EXISTS (SELECT 1 FROM retained_favorite_snapshot WHERE account = @account)
            """, args);
        _ = Run($"""
            WITH incoming AS MATERIALIZED ({RemoteFavoriteInput})
            UPDATE retained_favorite_origin AS old SET active = 0, touched_at = @now
            WHERE account = @account AND kind LIKE 'remote-%' AND active = 1
              AND NOT EXISTS (SELECT 1 FROM incoming i WHERE (i.kind, i.item_id, i.group_name) = (old.kind, old.item_id, old.group_name))
            """, args);
        _ = Run($"""
            INSERT INTO retained_favorite_origin (account, kind, item_id, group_name, created_at, name, active, touched_at)
            SELECT @account, kind, item_id, group_name, coalesce(created_at, @now), name, 1, @now
            FROM ({RemoteFavoriteInput}) WHERE true
            ON CONFLICT(account, kind, item_id, group_name) DO UPDATE SET
                active = 1, name = coalesce(excluded.name, name), touched_at = @now
            WHERE active = 0 OR (excluded.name IS NOT NULL AND excluded.name IS NOT name)
            """, args);
        _ = Run("""
            INSERT INTO retained_favorite_snapshot (account, touched_at) VALUES (@account, @now)
            ON CONFLICT(account) DO UPDATE SET touched_at = excluded.touched_at
            """, ("@account", account), ("@now", now));
    }

    private void PruneFavoriteSnapshots()
    {
        foreach (object[] row in Store.Execute("SELECT account FROM retained_favorite_snapshot ORDER BY touched_at DESC, account LIMIT -1 OFFSET 64"))
        {
            _ = Run("DELETE FROM retained_favorite_origin WHERE account = @account AND kind LIKE 'remote-%'", ("@account", row[0]));
            _ = Run("DELETE FROM retained_favorite_snapshot WHERE account = @account", ("@account", row[0]));
        }
    }
}
