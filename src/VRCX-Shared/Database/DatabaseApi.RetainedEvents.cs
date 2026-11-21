using System.Globalization;
using System.Text.Json;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private const int RetainedBatchLimit = 256;

    public void AppendRetainedEvents(string userId, string payload)
    {
        string account = AccountPrefix(userId);
        using var batch = JsonDocument.Parse(payload);
        if (batch.RootElement.GetArrayLength() > RetainedBatchLimit)
        {
            throw new ArgumentOutOfRangeException(nameof(payload));
        }

        Store.ExecuteTransaction(() =>
        {
            foreach (JsonElement entry in batch.RootElement.EnumerateArray())
            {
                string kind = RequiredText(entry, "kind");
                string subject = RequiredText(entry, "subject");
                string createdAt = RequiredText(entry, "createdAt");
                JsonElement data = entry.GetProperty("data");
                if (subject.Length == 0 || createdAt.Length == 0)
                {
                    continue;
                }

                switch (kind)
                {
                    case "avatar":
                        AppendAvatarObservation(account, subject, createdAt, data);
                        break;
                    case "profile":
                        AppendProfileObservation(account, subject, createdAt, data);
                        break;
                    case "badge":
                        InsertRetained(account, kind, subject, RequiredText(data, "badgeId"), createdAt, data.GetRawText());
                        break;
                    case "remote-favorites":
                        if (data.GetArrayLength() <= 10_000)
                        {
                            ReconcileRemoteFavorites(account, createdAt, data.GetRawText());
                        }
                        break;
                    default:
                        throw new ArgumentException("Unknown history event kind.", nameof(payload));
                }
            }
        });
    }

    private static string RequiredText(JsonElement data, string name) => data.GetProperty(name).GetString() ?? string.Empty;

    private static string? OptionalText(JsonElement data, string name) =>
        data.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private void AppendAvatarObservation(string account, string subject, string createdAt, JsonElement data)
    {
        string name = RequiredText(data, "avatarName");
        string location = RequiredText(data, "location");
        string? avatarId = OptionalText(data, "avatarId");
        string source = RequiredText(data, "source");
        string fallback = $"display:{RequiredText(data, "displayName")}";
        string? matchSubject = avatarId is null || location.Length == 0 || string.Equals(subject, fallback, StringComparison.Ordinal) ? null : fallback;
        const string RecentSubject = """
            SELECT id, subject, created_at, data FROM retained_event
            WHERE account = @account AND kind = 'avatar' AND subject = @subject
                AND json_extract(data, '$.location') = @location
            ORDER BY id DESC LIMIT 1
            """;
        (string Name, object? Value)[] args = [("@account", account), ("@subject", subject), ("@location", location)];
        object[][] previous = matchSubject is null
            ? Store.Execute(RecentSubject, ToArguments(args))
            : Store.Execute($"""
                SELECT * FROM ({RecentSubject})
                UNION ALL
                SELECT * FROM (
                    SELECT id, subject, created_at, data FROM retained_event
                    WHERE account = @account AND kind = 'avatar' AND subject = @fallback
                        AND json_extract(data, '$.location') = @location
                    ORDER BY id DESC LIMIT 1
                )
                ORDER BY id DESC
                """, ToArguments([.. args, ("@fallback", matchSubject)]));
        foreach (object[] row in previous)
        {
            using var stored = JsonDocument.Parse(Convert.ToString(row[3], CultureInfo.InvariantCulture) ?? "{}");
            JsonElement old = stored.RootElement;
            string oldSource = RequiredText(old, "source");
            string? oldId = OptionalText(old, "avatarId");
            string? oldName = OptionalText(old, "avatarName");
            bool sameAvatar = avatarId is not null && oldId is not null
                ? string.Equals(avatarId, oldId, StringComparison.Ordinal)
                : name.Length > 0 && string.Equals(name, oldName, StringComparison.Ordinal);
            bool nearby = NearbyAvatarReport(createdAt, row[2], source, oldSource);
            bool sameSubject = row[1] is string existingSubject && string.Equals(existingSubject, subject, StringComparison.Ordinal);
            if (sameAvatar && (sameSubject || nearby))
            {
                if (avatarId is not null && (oldId is null || nearby))
                {
                    _ = Run("""
                        UPDATE retained_event
                        SET subject = @subject, data = json_patch(data, @data)
                        WHERE id = @id
                        """, ("@subject", subject), ("@data", data.GetRawText()), ("@id", row[0]));
                }
                return;
            }

            if (sameSubject)
            {
                break;
            }
        }

        InsertRetained(account, "avatar", subject, name, createdAt, data.GetRawText());
    }

    private static bool NearbyAvatarReport(string createdAt, object previousAt, string source, string oldSource) =>
        !string.Equals(oldSource, source, StringComparison.Ordinal) &&
        previousAt is string previousDate &&
        DateTimeOffset.TryParse(createdAt, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out DateTimeOffset observed) &&
        DateTimeOffset.TryParse(previousDate, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out DateTimeOffset prior) &&
        Math.Abs((observed - prior).TotalSeconds) <= 15;

    private void AppendProfileObservation(string account, string subject, string createdAt, JsonElement data)
    {
        foreach (JsonProperty field in data.EnumerateObject())
        {
            if (field.Name is "bio" or "pronouns" or "tags")
            {
                AppendRetainedChange(account, "profile", subject, field.Name, createdAt, field.Value.GetRawText());
            }
        }
    }

    private void AppendRetainedChange(string account, string kind, string subject, string detail, string createdAt, string data) => _ = Run("""
        INSERT INTO retained_event (account, kind, subject, detail, created_at, data)
        SELECT @account, @kind, @subject, @detail, @createdAt, @data
        WHERE @data IS NOT (
            SELECT data FROM retained_event
            WHERE account = @account AND kind = @kind AND subject = @subject AND detail = @detail
            ORDER BY id DESC LIMIT 1
        )
        """, ("@account", account), ("@kind", kind), ("@subject", subject), ("@detail", detail), ("@createdAt", createdAt), ("@data", data));

    private void InsertRetained(string account, string kind, string subject, string detail, string createdAt, string data) => _ = Run("""
        INSERT INTO retained_event (account, kind, subject, detail, created_at, data)
        VALUES (@account, @kind, @subject, @detail, @createdAt, @data)
        """, ("@account", account), ("@kind", kind), ("@subject", subject), ("@detail", detail), ("@createdAt", createdAt), ("@data", data));

    public void PruneRetainedEvents()
    {
        Store.ExecuteTransaction(() =>
        {
            PruneRetainedStream("avatar", 90_000);
            PruneRetainedStream("profile", 60_000);
            PruneRetainedStream("favorite", 20_000);
            PruneRetainedStream("badge", 5_000);
            PruneFavoriteSnapshots();
            _ = Run("""
                DELETE FROM retained_favorite_origin
                WHERE (account, kind, item_id, group_name) IN (
                    SELECT account, kind, item_id, group_name FROM retained_favorite_origin
                    WHERE active = 0 ORDER BY touched_at DESC LIMIT -1 OFFSET 20000
                )
                """);
        });
    }

    private void PruneRetainedStream(string kind, long keep) => _ = Run("""
        DELETE FROM retained_event WHERE kind = @kind AND id <= (
            SELECT id FROM retained_event WHERE kind = @kind ORDER BY id DESC LIMIT 1 OFFSET @keep
        )
        """, ("@kind", kind), ("@keep", keep));

    public string GetPlayerAvatarHistory(string userId, long? beforeId, long limit) => ReadRetained("avatar", userId, beforeId, limit);

    public string GetFriendPlatformHistory(string userId, long? beforeId, long limit) => Rows($"""
        SELECT id, user_id, type, created_at, json_object('platform', platform, 'state', lower(type))
        FROM {UserTable("feed_online_offline")}
        WHERE user_id = @userId AND platform IS NOT NULL AND id < @beforeId
        ORDER BY id DESC LIMIT @limit
        """, ("@userId", userId), ("@beforeId", beforeId ?? long.MaxValue), ("@limit", Math.Clamp(limit, 0, 500)));

    public string GetRetainedProfileBaselines(string userId, string subjects)
    {
        const string ProfileField = """
            SELECT event.data
            FROM retained_event event
            WHERE event.account = @account AND event.kind = 'profile' AND event.subject = requested.value
            """;
        const string Latest = "ORDER BY event.id DESC LIMIT 1";
        return Rows($"""
            SELECT requested.value,
                ({ProfileField} AND event.detail = 'bio' {Latest}),
                ({ProfileField} AND event.detail = 'pronouns' {Latest}),
                ({ProfileField} AND event.detail = 'tags' {Latest})
            FROM json_each(@subjects) requested
            """, ("@account", AccountPrefix(userId)), ("@subjects", subjects));
    }

    public string GetProfileHistory(string userId, long? beforeId, long limit) => ReadRetained("profile", userId, beforeId, limit);

    public string GetFavoriteHistory(long? beforeId, long limit) => ReadRetained("favorite", subject: null, beforeId, limit);

    public string GetBadgeHistory(long? beforeId, long limit) => ReadRetained("badge", subject: null, beforeId, limit);

    private string ReadRetained(string kind, string? subject, long? beforeId, long limit)
    {
        const string Projection = "SELECT id, subject, detail, created_at, data FROM retained_event";
        const string Stream = "WHERE account = @account AND kind = @kind AND id < @beforeId";
        long boundedLimit = Math.Clamp(limit, 0, 500);
        return subject is null
            ? Rows($"{Projection} {Stream} ORDER BY id DESC LIMIT @limit", ("@account", _userPrefix), ("@kind", kind), ("@beforeId", beforeId ?? long.MaxValue), ("@limit", boundedLimit))
            : Rows($"{Projection} {Stream} AND subject = @subject ORDER BY id DESC LIMIT @limit", ("@account", _userPrefix), ("@kind", kind), ("@subject", subject), ("@beforeId", beforeId ?? long.MaxValue), ("@limit", boundedLimit));
    }
}
