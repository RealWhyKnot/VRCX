using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetLastOnlineSessionBefore(string fromDate) => Rows("SELECT created_at, time FROM gamelog_location WHERE created_at < @fromDate ORDER BY created_at DESC LIMIT 1", ("@fromDate", fromDate));

    public string GetOnlineSessions(string? fromDate, string? toDate)
    {
        var args = new List<(string Name, object? Value)>();
        var where = new List<string>();
        if (fromDate is not null)
        {
            where.Add("created_at >= @fromDate");
            args.Add(("@fromDate", fromDate));
        }

        if (toDate is not null)
        {
            where.Add("created_at < @toDate");
            args.Add(("@toDate", toDate));
        }

        string whereSql = where.Count > 0 ? $"WHERE {string.Join(" AND ", where)}" : string.Empty;
        return Rows($"SELECT created_at, time FROM gamelog_location {whereSql} ORDER BY created_at", [.. args]);
    }

    public string GetOnlineSessionsAfter(string afterCreatedAt, bool inclusive)
    {
        string op = inclusive ? ">=" : ">";
        return Rows($"SELECT created_at, time FROM gamelog_location WHERE created_at {op} @after ORDER BY created_at", ("@after", afterCreatedAt));
    }

    public string GetMyTopWorlds(long days, long limit, string sortBy, string excludeWorldId)
    {
        var args = new List<(string Name, object? Value)> { ("@limit", limit) };
        string whereClause = string.Empty;
        if (days > 0)
        {
            whereClause = "AND created_at >= datetime('now', @daysOffset)";
            args.Add(("@daysOffset", $"-{days.ToString(CultureInfo.InvariantCulture)} days"));
        }

        string excludeClause = string.Empty;
        if (excludeWorldId.Length > 0)
        {
            excludeClause = "AND world_id != @excludeWorldId";
            args.Add(("@excludeWorldId", excludeWorldId));
        }

        string orderBy = string.Equals(sortBy, "count", StringComparison.Ordinal) ? "visit_count DESC" : "total_time DESC";
        return Rows($"""
            SELECT
                world_id,
                world_name,
                COUNT(*) AS visit_count,
                SUM(time) AS total_time
            FROM gamelog_location
            WHERE world_id IS NOT NULL
                AND world_id != ''
                AND world_id LIKE 'wrld_%'
                {whereClause}
                {excludeClause}
            GROUP BY world_id
            ORDER BY {orderBy}
            LIMIT @limit
            """, [.. args]);
    }

    public string GetSessionsLocationSegments(long limit) => Rows("SELECT id, created_at, location, world_id, world_name, time, group_name FROM gamelog_location WHERE 1=1 ORDER BY id DESC LIMIT @limit", ("@limit", limit));

    public string GetSessionsLocationSegmentsBefore(long beforeId, long limit) => Rows("SELECT id, created_at, location, world_id, world_name, time, group_name FROM gamelog_location WHERE 1=1 AND id < @beforeId ORDER BY id DESC LIMIT @limit", ("@beforeId", beforeId), ("@limit", limit));

    public string GetSessionsLocationSegmentsSince(string sinceDate, long limit) => Rows("SELECT id, created_at, location, world_id, world_name, time, group_name FROM gamelog_location WHERE created_at >= @sinceDate ORDER BY id DESC LIMIT @limit", ("@sinceDate", sinceDate), ("@limit", limit));

    public string GetSessionsJoinLeaveForLocations(string[] locations, string afterDate, string beforeDate, string selfId)
    {
        var args = new List<(string Name, object? Value)>
        {
            ("@afterDate", afterDate),
            ("@beforeDate", beforeDate),
            ("@selfId", selfId),
        };
        string locationIn = AddListParameters(locations, "@loc", args);
        return Rows($"SELECT type, created_at, display_name, user_id, location FROM gamelog_join_leave WHERE location IN ({locationIn}) AND user_id != @selfId AND created_at >= @afterDate AND created_at <= @beforeDate ORDER BY created_at ASC", [.. args]);
    }

    public string GetSessionsVideoPlaysForLocations(string[] locations, string afterDate, string beforeDate)
    {
        var args = new List<(string Name, object? Value)>
        {
            ("@afterDate", afterDate),
            ("@beforeDate", beforeDate),
        };
        string locationIn = AddListParameters(locations, "@loc", args);
        return Rows($"SELECT created_at, video_url, video_name, video_id, display_name, user_id, location FROM gamelog_video_play WHERE location IN ({locationIn}) AND created_at >= @afterDate AND created_at <= @beforeDate ORDER BY created_at ASC", [.. args]);
    }
}
