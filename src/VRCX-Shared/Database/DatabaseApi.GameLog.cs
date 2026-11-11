using System.Globalization;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public long AddGamelogLocation(string? createdAt, string? location, string? worldId, string? worldName, double time, string? groupName) => Insert("INSERT OR IGNORE INTO gamelog_location (created_at, location, world_id, world_name, time, group_name) VALUES (@created_at, @location, @world_id, @world_name, @time, @group_name)", ("@created_at", createdAt), ("@location", location), ("@world_id", worldId), ("@world_name", worldName), ("@time", time), ("@group_name", groupName));

    public void UpdateGamelogLocationTime(string? createdAt, double time) => _ = Run("UPDATE gamelog_location SET time = @time WHERE created_at = @created_at", ("@created_at", createdAt), ("@time", time));

    public long AddGamelogJoinLeave(string? createdAt, string? type, string? displayName, string? location, string? userId, double? time) => Insert("INSERT OR IGNORE INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time) VALUES (@created_at, @type, @display_name, @location, @user_id, @time)", ("@created_at", createdAt), ("@type", type), ("@display_name", displayName), ("@location", location), ("@user_id", userId), ("@time", time));

    public long AddGamelogPortalSpawn(string? createdAt, string? displayName, string? location, string? userId, string? instanceId, string? worldName) => Insert("INSERT OR IGNORE INTO gamelog_portal_spawn (created_at, display_name, location, user_id, instance_id, world_name) VALUES (@created_at, @display_name, @location, @user_id, @instance_id, @world_name)", ("@created_at", createdAt), ("@display_name", displayName), ("@location", location), ("@user_id", userId), ("@instance_id", instanceId), ("@world_name", worldName));

    public long AddGamelogVideoPlay(string? createdAt, string? videoLink, string? videoName, string? videoId, string? location, string? displayName, string? userId) => Insert("INSERT OR IGNORE INTO gamelog_video_play (created_at, video_url, video_name, video_id, location, display_name, user_id) VALUES (@created_at, @video_url, @video_name, @video_id, @location, @display_name, @user_id)", ("@created_at", createdAt), ("@video_url", videoLink), ("@video_name", videoName), ("@video_id", videoId), ("@location", location), ("@display_name", displayName), ("@user_id", userId));

    public int UpdateGamelogVideoPlayName(long rowId, string? videoName) => Run("UPDATE gamelog_video_play SET video_name = @video_name WHERE id = @id", ("@video_name", videoName), ("@id", rowId));

    public long AddGamelogResourceLoad(string? createdAt, string? resourceLink, string? resourceType, string? location) => Insert("INSERT OR IGNORE INTO gamelog_resource_load (created_at, resource_url, resource_type, location) VALUES (@created_at, @resource_url, @resource_type, @location)", ("@created_at", createdAt), ("@resource_url", resourceLink), ("@resource_type", resourceType), ("@location", location));

    public long AddGamelogEvent(string? createdAt, string? data) => Insert("INSERT OR IGNORE INTO gamelog_event (created_at, data) VALUES (@created_at, @data)", ("@created_at", createdAt), ("@data", data));

    public long AddGamelogExternal(string? createdAt, string? message, string? displayName, string? userId, string? location) => Insert("INSERT OR IGNORE INTO gamelog_external (created_at, message, display_name, user_id, location) VALUES (@created_at, @message, @display_name, @user_id, @location)", ("@created_at", createdAt), ("@message", message), ("@display_name", displayName), ("@user_id", userId), ("@location", location));

    public void DeleteGameLogInstanceByLocation(string? location) => _ = Run("DELETE FROM gamelog_location WHERE location = @location", ("@location", location));

    public void DeleteGameLogInstance(string? userId, string? displayName, string? location, string[] eventIds)
    {
        var args = new List<(string Name, object? Value)>
        {
            ("@user_id", userId),
            ("@displayName", displayName),
            ("@location", location),
        };
        string idList = AddListParameters(eventIds, "@id", args);
        _ = Run($"DELETE FROM gamelog_join_leave WHERE (user_id = @user_id OR display_name = @displayName) AND (location = @location) AND (id in ({idList}))", [.. args]);
    }

    public void DeleteGameLogVideoPlay(string? createdAt, string? videoLink, string? location) => _ = Run("DELETE FROM gamelog_video_play WHERE created_at = @created_at AND video_url = @video_url AND location = @location", ("@created_at", createdAt), ("@video_url", videoLink), ("@location", location));

    public void DeleteGameLogEvent(string? createdAt, string? data) => _ = Run("DELETE FROM gamelog_event WHERE created_at = @created_at AND data = @data", ("@created_at", createdAt), ("@data", data));

    public void DeleteGameLogExternal(string? createdAt, string? message) => _ = Run("DELETE FROM gamelog_external WHERE created_at = @created_at AND message = @message", ("@created_at", createdAt), ("@message", message));

    public void DeleteGameLogResourceLoad(string? createdAt, string? resourceLink, string? location) => _ = Run("DELETE FROM gamelog_resource_load WHERE created_at = @created_at AND resource_url = @resource_url AND location = @location", ("@created_at", createdAt), ("@resource_url", resourceLink), ("@location", location));

    private static string AddListParameters(string[] values, string prefix, List<(string Name, object? Value)> args)
    {
        var names = new List<string>(values.Length);
        for (int i = 0; i < values.Length; i++)
        {
            string name = prefix + i.ToString(CultureInfo.InvariantCulture);
            args.Add((name, values[i]));
            names.Add(name);
        }

        return string.Join(", ", names);
    }
}
