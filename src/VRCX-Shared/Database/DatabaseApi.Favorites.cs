namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public void AddAvatarToCache(string id, string addedAt, string? authorId, string? authorName, string? createdAt, string? description, string? imageLink, string? name, string? releaseStatus, string? thumbnailImageLink, string? updatedAt, long? version) => _ = Run("INSERT OR REPLACE INTO cache_avatar (id, added_at, author_id, author_name, created_at, description, image_url, name, release_status, thumbnail_image_url, updated_at, version) VALUES (@id, @added_at, @author_id, @author_name, @created_at, @description, @image_url, @name, @release_status, @thumbnail_image_url, @updated_at, @version)", ("@id", id), ("@added_at", addedAt), ("@author_id", authorId), ("@author_name", authorName), ("@created_at", createdAt), ("@description", description), ("@image_url", imageLink), ("@name", name), ("@release_status", releaseStatus), ("@thumbnail_image_url", thumbnailImageLink), ("@updated_at", updatedAt), ("@version", version));

    public void AddAvatarToHistory(string avatarId, string createdAt) => _ = Run($"INSERT INTO {UserTable("avatar_history")} (avatar_id, created_at, time) VALUES (@avatar_id, @created_at, 0) ON CONFLICT(avatar_id) DO UPDATE SET created_at = @created_at", ("@avatar_id", avatarId), ("@created_at", createdAt));

    public string GetAvatarTimeSpent(string avatarId) => Rows($"SELECT time FROM {UserTable("avatar_history")} WHERE avatar_id = @avatarId", ("@avatarId", avatarId));

    public string GetAllAvatarTimeSpent() => Rows($"SELECT avatar_id, time FROM {UserTable("avatar_history")}");

    public void AddAvatarTimeSpent(string avatarId, long timeSpent) => _ = Run($"UPDATE {UserTable("avatar_history")} SET time = time + @timeSpent WHERE avatar_id = @avatarId", ("@avatarId", avatarId), ("@timeSpent", timeSpent));

    public string GetAvatarHistory(string currentUserId, long limit) => Rows($"SELECT * FROM {UserTable("avatar_history")} INNER JOIN cache_avatar ON cache_avatar.id = {UserTable("avatar_history")}.avatar_id WHERE author_id != @current_user_id ORDER BY {UserTable("avatar_history")}.created_at DESC LIMIT @limit", ("@current_user_id", currentUserId), ("@limit", limit));

    public string GetCachedAvatarById(string id) => Rows("SELECT * FROM cache_avatar WHERE id = @id", ("@id", id));

    public void ClearAvatarHistory() => _ = Run($"DELETE FROM {UserTable("avatar_history")}");

    public void AddAvatarToFavorites(string avatarId, string groupName, string createdAt, string? name) => ChangeLocalFavorite("avatar", "favorite_avatar", "avatar_id", avatarId, groupName, name, createdAt, add: true);

    public void RenameAvatarFavoriteGroup(string newGroupName, string groupName) => ChangeLocalFavoriteGroup("avatar", "favorite_avatar", "avatar_id", groupName, newGroupName);

    public void DeleteAvatarFavoriteGroup(string groupName) => ChangeLocalFavoriteGroup("avatar", "favorite_avatar", "avatar_id", groupName, newGroup: null);

    public void RemoveAvatarFromFavorites(string avatarId, string groupName, string? name) => ChangeLocalFavorite("avatar", "favorite_avatar", "avatar_id", avatarId, groupName, name, createdAt: null, add: false);

    public string GetAvatarFavorites() => Rows("SELECT * FROM favorite_avatar");

    public void RemoveAvatarFromCache(string avatarId) => _ = Run("DELETE FROM cache_avatar WHERE id = @avatar_id", ("@avatar_id", avatarId));

    public string GetAvatarCache() => Rows("SELECT * FROM cache_avatar");

    public string GetAvatarCacheForIds(string ids) => Rows("""
        SELECT cache.* FROM json_each(@ids) items
        JOIN cache_avatar cache ON cache.id = items.value
        """, ("@ids", ids));

    public void AddWorldToCache(string id, string addedAt, string? authorId, string? authorName, string? createdAt, string? description, string? imageLink, string? name, string? releaseStatus, string? thumbnailImageLink, string? updatedAt, long? version) => _ = Run("INSERT OR REPLACE INTO cache_world (id, added_at, author_id, author_name, created_at, description, image_url, name, release_status, thumbnail_image_url, updated_at, version) VALUES (@id, @added_at, @author_id, @author_name, @created_at, @description, @image_url, @name, @release_status, @thumbnail_image_url, @updated_at, @version)", ("@id", id), ("@added_at", addedAt), ("@author_id", authorId), ("@author_name", authorName), ("@created_at", createdAt), ("@description", description), ("@image_url", imageLink), ("@name", name), ("@release_status", releaseStatus), ("@thumbnail_image_url", thumbnailImageLink), ("@updated_at", updatedAt), ("@version", version));

    public void AddWorldToFavorites(string worldId, string groupName, string createdAt, string? name) => ChangeLocalFavorite("world", "favorite_world", "world_id", worldId, groupName, name, createdAt, add: true);

    public void RenameWorldFavoriteGroup(string newGroupName, string groupName) => ChangeLocalFavoriteGroup("world", "favorite_world", "world_id", groupName, newGroupName);

    public void DeleteWorldFavoriteGroup(string groupName) => ChangeLocalFavoriteGroup("world", "favorite_world", "world_id", groupName, newGroup: null);

    public void RemoveWorldFromFavorites(string worldId, string groupName, string? name) => ChangeLocalFavorite("world", "favorite_world", "world_id", worldId, groupName, name, createdAt: null, add: false);

    public string GetWorldFavorites() => Rows("SELECT * FROM favorite_world");

    public void RemoveWorldFromCache(string worldId) => _ = Run("DELETE FROM cache_world WHERE id = @world_id", ("@world_id", worldId));

    public string GetWorldCache() => Rows("SELECT * FROM cache_world");

    public string GetWorldCacheForIds(string ids) => Rows("""
        SELECT cache.* FROM json_each(@ids) items
        JOIN cache_world cache ON cache.id = items.value
        """, ("@ids", ids));

    public string GetCachedWorldById(string id) => Rows("SELECT * FROM cache_world WHERE id = @id", ("@id", id));

    public void AddFriendToLocalFavorites(string userId, string groupName, string createdAt, string? name) => ChangeLocalFavorite("friend", "favorite_friend", "user_id", userId, groupName, name, createdAt, add: true);

    public void RemoveFriendFromLocalFavorites(string userId, string groupName, string? name) => ChangeLocalFavorite("friend", "favorite_friend", "user_id", userId, groupName, name, createdAt: null, add: false);

    public void RenameFriendFavoriteGroup(string newGroupName, string groupName) => ChangeLocalFavoriteGroup("friend", "favorite_friend", "user_id", groupName, newGroupName);

    public void DeleteFriendFavoriteGroup(string groupName) => ChangeLocalFavoriteGroup("friend", "favorite_friend", "user_id", groupName, newGroup: null);

    public string GetFriendFavorites() => Rows("SELECT * FROM favorite_friend");

    public void AddPrintToFavorites(string printId, string createdAt) => ChangeLocalFavorite("print", "favorite_print", "print_id", printId, "", name: null, createdAt, add: true);

    public void RemovePrintFromFavorites(string printId) => ChangeLocalFavorite("print", "favorite_print", "print_id", printId, "", name: null, createdAt: null, add: false);

    public string GetPrintFavorites() => Rows("SELECT * FROM favorite_print");
}
