namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetLastSeen(string? userId, string? displayName, long count) => Rows("SELECT created_at, user_id FROM gamelog_join_leave WHERE user_id = @userId OR display_name = @displayName ORDER BY id DESC LIMIT @count", ("@userId", userId), ("@displayName", displayName), ("@count", count));

    public string GetJoinCount(string? userId, string? displayName) => Rows("SELECT COUNT(DISTINCT location) FROM gamelog_join_leave WHERE (type = 'OnPlayerJoined') AND (user_id = @userId OR display_name = @displayName)", ("@userId", userId), ("@displayName", displayName));

    public string GetTimeSpent(string? userId, string? displayName) => Rows("SELECT time FROM gamelog_join_leave WHERE (type = 'OnPlayerLeft') AND (user_id = @userId OR display_name = @displayName)", ("@userId", userId), ("@displayName", displayName));

    public string GetUserStats(string? userId, string? displayName) => Rows("SELECT created_at, user_id, time, location, display_name FROM gamelog_join_leave WHERE user_id = @userId OR display_name = @displayName ORDER BY id DESC", ("@userId", userId), ("@displayName", displayName));

    public string GetAllUserStats(string[] userIds, string[] displayNames)
    {
        var args = new List<(string Name, object? Value)>();
        var whereClauses = new List<string>();
        if (userIds.Length > 0)
        {
            whereClauses.Add($"g.user_id IN ({AddListParameters(userIds, "@id", args)})");
        }

        if (displayNames.Length > 0)
        {
            whereClauses.Add($"g.display_name IN ({AddListParameters(displayNames, "@name", args)})");
        }

        if (whereClauses.Count == 0)
        {
            return "[]";
        }

        string whereSql = string.Join("\n                OR ", whereClauses);
        return Rows($"""
            SELECT
                g.created_at,
                g.user_id,
                SUM(g.time) AS timeSpent,
                COUNT(DISTINCT g.location) AS joinCount,
                g.display_name,
                MAX(g.id) AS max_id
            FROM
                gamelog_join_leave g
            WHERE
                {whereSql}
            GROUP BY
                g.user_id,
                g.display_name
            ORDER BY
                g.user_id DESC
            """, [.. args]);
    }

    public string GetUserIdFromDisplayName(string displayName) => Rows("SELECT user_id FROM gamelog_join_leave WHERE display_name = @displayName AND user_id != '' ORDER BY id DESC LIMIT 1", ("@displayName", displayName));

    public string GetPreviousDisplayNamesByUserId(string userId) => Rows("SELECT created_at, display_name FROM gamelog_join_leave WHERE user_id = @userId ORDER BY id DESC", ("@userId", userId));

    public string GetPreviousInstancesByUserId(string? userId, string? displayName) => Rows("""
        WITH grouped_locations AS (
            SELECT DISTINCT location, world_name, group_name
            FROM gamelog_location
        )
        SELECT gamelog_join_leave.created_at, strftime('%s', gamelog_join_leave.created_at) * 1000 created_at_ts, gamelog_join_leave.location, gamelog_join_leave.time, grouped_locations.world_name, grouped_locations.group_name, gamelog_join_leave.id, gamelog_join_leave.type
        FROM gamelog_join_leave
        INNER JOIN grouped_locations ON gamelog_join_leave.location = grouped_locations.location
        WHERE user_id = @userId OR display_name = @displayName
        ORDER BY gamelog_join_leave.id ASC
        """, ("@userId", userId), ("@displayName", displayName));

    public string GetJoinLeaveDatesByUserId(string userId) => Rows("SELECT created_at FROM gamelog_join_leave WHERE user_id = @userId", ("@userId", userId));

    public string GetRecentInstanceJoinsByUserId(string userId, string since) => Rows("SELECT created_at, location FROM gamelog_join_leave WHERE user_id = @userId AND created_at > @created_at ORDER BY created_at DESC", ("@userId", userId), ("@created_at", since));

    public string GetInstanceActivityRows(string startDate, string endDate) => Rows("""
        SELECT
            *
        FROM
            gamelog_join_leave
        WHERE type = 'OnPlayerLeft'
            AND (
                strftime('%Y-%m-%dT%H:%M:%SZ', created_at, '-' || (time * 1.0 / 1000) || ' seconds') BETWEEN @utc_start_date AND @utc_end_date
                OR created_at BETWEEN @utc_start_date AND @utc_end_date
            );
        """, ("@utc_start_date", startDate), ("@utc_end_date", endDate));

    public string GetRepeatEncounters(string selfId, long minPlaces, long limit) => Rows($"""
        SELECT user_id, display_name, COUNT(DISTINCT location) AS places, MAX(created_at), SUM(time)
        FROM gamelog_join_leave
        WHERE type = 'OnPlayerLeft'
          AND user_id != ''
          AND user_id != @selfId
          AND user_id NOT IN (SELECT user_id FROM {UserTable("friend_log_current")})
        GROUP BY user_id
        HAVING places >= @minPlaces
        ORDER BY places DESC
        LIMIT @limit
        """, ("@selfId", selfId), ("@minPlaces", minPlaces), ("@limit", limit));

    public string GetVoteKickEvents(long limit) => Rows("""
        SELECT created_at, data, (SELECT world_name FROM gamelog_location WHERE gamelog_location.created_at <= gamelog_event.created_at ORDER BY gamelog_location.created_at DESC LIMIT 1)
        FROM gamelog_event
        WHERE data LIKE 'A vote kick has been initiated against %' OR data LIKE 'Vote to kick %' OR data LIKE '%You have been kicked%'
        ORDER BY created_at DESC
        LIMIT @limit
        """, ("@limit", limit));

    public string GetFirstMetByUserId(string userId) => Rows("SELECT MIN(created_at) FROM gamelog_join_leave WHERE user_id = @userId", ("@userId", userId));
}
