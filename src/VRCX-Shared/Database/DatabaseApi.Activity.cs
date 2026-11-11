using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const int ValueRowChunkSize = 250;

    public string GetFriendPresenceSliceWindow(string userId, string fromDateIso, string toDateIso)
    {
        string toBound = toDateIso.Length > 0 ? "AND created_at < @toDateIso" : string.Empty;
        string sql = $"""
            SELECT created_at, type
            FROM (
                SELECT created_at, type, 0 AS sort_group
                FROM (
                    SELECT created_at, type
                    FROM {UserTable("feed_online_offline")}
                    WHERE user_id = @userId
                      AND (type = 'Online' OR type = 'Offline')
                      AND created_at < @fromDateIso
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                UNION ALL
                SELECT created_at, type, 1 AS sort_group
                FROM {UserTable("feed_online_offline")}
                WHERE user_id = @userId
                  AND (type = 'Online' OR type = 'Offline')
                  AND created_at >= @fromDateIso
                  {toBound}
            )
            ORDER BY created_at ASC, sort_group ASC
            """;
        return Rows(sql, ("@userId", userId), ("@fromDateIso", fromDateIso), ("@toDateIso", toDateIso));
    }

    public string GetFriendPresenceSliceEnd(string userId, string toDateIso) => Rows($"""
        SELECT created_at, type
        FROM {UserTable("feed_online_offline")}
        WHERE user_id = @userId
          AND (type = 'Online' OR type = 'Offline')
          AND created_at >= @toDateIso
        ORDER BY created_at ASC
        LIMIT 1
        """, ("@userId", userId), ("@toDateIso", toDateIso));

    public string GetFriendPresenceAfter(string userId, string afterCreatedAt) => Rows($"""
        SELECT created_at, type
        FROM {UserTable("feed_online_offline")}
        WHERE user_id = @userId
          AND (type = 'Online' OR type = 'Offline')
          AND created_at > @afterCreatedAt
        ORDER BY created_at
        """, ("@userId", userId), ("@afterCreatedAt", afterCreatedAt));

    public string GetCurrentUserLocationSlice(string fromDateIso, string toDateIso)
    {
        bool hasToDate = toDateIso.Length > 0;
        string toBound = hasToDate ? "AND created_at < @toDateIso" : string.Empty;
        string toTail = hasToDate ? "UNION ALL SELECT created_at, time, 2 AS sort_group FROM (SELECT created_at, time FROM gamelog_location WHERE created_at >= @toDateIso ORDER BY created_at LIMIT 1)" : string.Empty;
        string sql = $"""
            SELECT created_at, time
            FROM (
                SELECT created_at, time, 0 AS sort_group
                FROM (
                    SELECT created_at, time
                    FROM gamelog_location
                    WHERE created_at < @fromDateIso
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                UNION ALL
                SELECT created_at, time, 1 AS sort_group
                FROM gamelog_location
                WHERE created_at >= @fromDateIso
                  {toBound}
                {toTail}
            )
            ORDER BY created_at ASC, sort_group ASC
            """;
        return Rows(sql, ("@fromDateIso", fromDateIso), ("@toDateIso", toDateIso));
    }

    public string GetCurrentUserLocationAfter(string afterCreatedAt, bool isInclusive)
    {
        string operatorText = isInclusive ? ">=" : ">";
        return Rows($"""
            SELECT created_at, time
            FROM gamelog_location
            WHERE created_at {operatorText} @afterCreatedAt
            ORDER BY created_at
            """, ("@afterCreatedAt", afterCreatedAt));
    }

    public string GetActivitySyncState(string userId) => Rows($"""
        SELECT user_id, updated_at, is_self, source_last_created_at, pending_session_start_at, cached_range_days
        FROM {UserTable("activity_sync_state_v2")}
        WHERE user_id = @userId
        """, ("@userId", userId));

    public void UpsertActivitySyncState(string userId, string updatedAt, bool isSelf, string sourceLastCreatedAt, long? pendingSessionStartAt, long cachedRangeDays) =>
        _ = Run($"""
            INSERT OR REPLACE INTO {UserTable("activity_sync_state_v2")}
                 (user_id, updated_at, is_self, source_last_created_at, pending_session_start_at, cached_range_days)
                 VALUES (@userId, @updatedAt, @isSelf, @sourceLastCreatedAt, @pendingSessionStartAt, @cachedRangeDays)
            """,
            ("@userId", userId),
            ("@updatedAt", updatedAt),
            ("@isSelf", isSelf ? 1 : 0),
            ("@sourceLastCreatedAt", sourceLastCreatedAt),
            ("@pendingSessionStartAt", pendingSessionStartAt),
            ("@cachedRangeDays", cachedRangeDays));

    public string GetActivitySessions(string userId) => Rows($"""
        SELECT start_at, end_at, is_open_tail, source_revision
        FROM {UserTable("activity_sessions_v2")}
        WHERE user_id = @userId
        ORDER BY start_at
        """, ("@userId", userId));

    public void ReplaceActivitySessions(string userId, string[] startAt, string[] endAt, string[] isOpenTail, string[] sourceRevision) =>
        RunInWriteTransaction(() =>
        {
            _ = Run($"DELETE FROM {UserTable("activity_sessions_v2")} WHERE user_id = @userId", ("@userId", userId));
            InsertActivitySessionRows(userId, startAt, endAt, isOpenTail, sourceRevision);
        });

    public void AppendActivitySessions(string userId, string[] startAt, string[] endAt, string[] isOpenTail, string[] sourceRevision) =>
        RunInWriteTransaction(() => InsertActivitySessionRows(userId, startAt, endAt, isOpenTail, sourceRevision));

    public void AppendActivitySessionsFrom(string userId, long replaceFromStartAt, string[] startAt, string[] endAt, string[] isOpenTail, string[] sourceRevision) =>
        RunInWriteTransaction(() =>
        {
            _ = Run($"""
                DELETE FROM {UserTable("activity_sessions_v2")}
                WHERE user_id = @userId AND start_at >= @replaceFromStartAt
                """, ("@userId", userId), ("@replaceFromStartAt", replaceFromStartAt));
            InsertActivitySessionRows(userId, startAt, endAt, isOpenTail, sourceRevision);
        });

    public string GetActivityBucketCache(string ownerUserId, string targetUserId, long rangeDays, string viewKind, string excludeKey) => Rows($"""
        SELECT user_id, target_user_id, range_days, view_kind, exclude_key, bucket_version, built_from_cursor, raw_buckets_json, normalized_buckets_json, summary_json, built_at
        FROM {UserTable("activity_bucket_cache_v2")}
        WHERE user_id = @ownerUserId AND target_user_id = @targetUserId AND range_days = @rangeDays AND view_kind = @viewKind AND exclude_key = @excludeKey
        """,
        ("@ownerUserId", ownerUserId),
        ("@targetUserId", targetUserId),
        ("@rangeDays", rangeDays),
        ("@viewKind", viewKind),
        ("@excludeKey", excludeKey));

    public void UpsertActivityBucketCache(string ownerUserId, string targetUserId, long rangeDays, string viewKind, string excludeKey, long bucketVersion, string builtFromCursor, string rawBucketsJson, string normalizedBucketsJson, string summaryJson, string builtAt) =>
        _ = Run($"""
            INSERT OR REPLACE INTO {UserTable("activity_bucket_cache_v2")}
                 (user_id, target_user_id, range_days, view_kind, exclude_key, bucket_version, built_from_cursor, raw_buckets_json, normalized_buckets_json, summary_json, built_at)
                 VALUES (@ownerUserId, @targetUserId, @rangeDays, @viewKind, @excludeKey, @bucketVersion, @builtFromCursor, @rawBucketsJson, @normalizedBucketsJson, @summaryJson, @builtAt)
            """,
            ("@ownerUserId", ownerUserId),
            ("@targetUserId", targetUserId),
            ("@rangeDays", rangeDays),
            ("@viewKind", viewKind),
            ("@excludeKey", excludeKey),
            ("@bucketVersion", bucketVersion),
            ("@builtFromCursor", builtFromCursor),
            ("@rawBucketsJson", rawBucketsJson),
            ("@normalizedBucketsJson", normalizedBucketsJson),
            ("@summaryJson", summaryJson),
            ("@builtAt", builtAt));

    private void InsertActivitySessionRows(string userId, string[] startAt, string[] endAt, string[] isOpenTail, string[] sourceRevision)
    {
        if (startAt.Length != endAt.Length || startAt.Length != isOpenTail.Length || startAt.Length != sourceRevision.Length)
        {
            throw new ArgumentException("The activity session columns must have the same length.", nameof(startAt));
        }

        List<object?[]> rows = [];
        for (int index = 0; index < startAt.Length; index++)
        {
            rows.Add([
                userId,
                long.Parse(startAt[index], CultureInfo.InvariantCulture),
                long.Parse(endAt[index], CultureInfo.InvariantCulture),
                string.Equals(isOpenTail[index], "1", StringComparison.Ordinal) ? 1 : 0,
                sourceRevision[index],
            ]);
        }
        InsertValueRows($"INSERT OR REPLACE INTO {UserTable("activity_sessions_v2")} (user_id, start_at, end_at, is_open_tail, source_revision) VALUES", rows);
    }

    private void RunInWriteTransaction(Action work)
    {
        BeginTransaction();
        bool isCommitted = false;
        try
        {
            work();
            CommitTransaction();
            isCommitted = true;
        }
        finally
        {
            if (!isCommitted)
            {
                _ = Run("ROLLBACK");
            }
        }
    }

    private void InsertValueRows(string statementStart, List<object?[]> rows)
    {
        for (int chunkStart = 0; chunkStart < rows.Count; chunkStart += ValueRowChunkSize)
        {
            int chunkEnd = Math.Min(chunkStart + ValueRowChunkSize, rows.Count);
            List<string> groups = [];
            List<(string Name, object? Value)> args = [];
            for (int rowIndex = chunkStart; rowIndex < chunkEnd; rowIndex++)
            {
                object?[] row = rows[rowIndex];
                List<string> names = [];
                foreach (object? value in row)
                {
                    string name = $"@v{args.Count.ToString(CultureInfo.InvariantCulture)}";
                    names.Add(name);
                    args.Add((name, value));
                }
                groups.Add($"({string.Join(", ", names)})");
            }
            _ = Run($"{statementStart} {string.Join(", ", groups)}", [.. args]);
        }
    }

    private static string InPlaceholders(string prefix, int count) =>
        string.Join(", ", Enumerable.Range(0, count).Select(index => $"@{prefix}{index.ToString(CultureInfo.InvariantCulture)}"));
}
