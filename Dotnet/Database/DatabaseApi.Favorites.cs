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

    public void ClearAvatarHistory()
    {
        _ = Run($"DELETE FROM {UserTable("avatar_history")}");
        _ = Run("DELETE FROM cache_avatar");
    }

    public void AddAvatarToFavorites(string avatarId, string groupName, string createdAt) => _ = Run("INSERT OR REPLACE INTO favorite_avatar (avatar_id, group_name, created_at) VALUES (@avatar_id, @group_name, @created_at)", ("@avatar_id", avatarId), ("@group_name", groupName), ("@created_at", createdAt));

    public void RenameAvatarFavoriteGroup(string newGroupName, string groupName) => _ = Run("UPDATE favorite_avatar SET group_name = @new_group_name WHERE group_name = @group_name", ("@new_group_name", newGroupName), ("@group_name", groupName));

    public void DeleteAvatarFavoriteGroup(string groupName) => _ = Run("DELETE FROM favorite_avatar WHERE group_name = @group_name", ("@group_name", groupName));

    public void RemoveAvatarFromFavorites(string avatarId, string groupName) => _ = Run("DELETE FROM favorite_avatar WHERE avatar_id = @avatar_id AND group_name = @group_name", ("@avatar_id", avatarId), ("@group_name", groupName));

    public string GetAvatarFavorites() => Rows("SELECT * FROM favorite_avatar");

    public void RemoveAvatarFromCache(string avatarId) => _ = Run("DELETE FROM cache_avatar WHERE id = @avatar_id", ("@avatar_id", avatarId));

    public string GetAvatarCache() => Rows("SELECT * FROM cache_avatar");

    public void AddWorldToCache(string id, string addedAt, string? authorId, string? authorName, string? createdAt, string? description, string? imageLink, string? name, string? releaseStatus, string? thumbnailImageLink, string? updatedAt, long? version) => _ = Run("INSERT OR REPLACE INTO cache_world (id, added_at, author_id, author_name, created_at, description, image_url, name, release_status, thumbnail_image_url, updated_at, version) VALUES (@id, @added_at, @author_id, @author_name, @created_at, @description, @image_url, @name, @release_status, @thumbnail_image_url, @updated_at, @version)", ("@id", id), ("@added_at", addedAt), ("@author_id", authorId), ("@author_name", authorName), ("@created_at", createdAt), ("@description", description), ("@image_url", imageLink), ("@name", name), ("@release_status", releaseStatus), ("@thumbnail_image_url", thumbnailImageLink), ("@updated_at", updatedAt), ("@version", version));

    public void AddWorldToFavorites(string worldId, string groupName, string createdAt) => _ = Run("INSERT OR REPLACE INTO favorite_world (world_id, group_name, created_at) VALUES (@world_id, @group_name, @created_at)", ("@world_id", worldId), ("@group_name", groupName), ("@created_at", createdAt));

    public void RenameWorldFavoriteGroup(string newGroupName, string groupName) => _ = Run("UPDATE favorite_world SET group_name = @new_group_name WHERE group_name = @group_name", ("@new_group_name", newGroupName), ("@group_name", groupName));

    public void DeleteWorldFavoriteGroup(string groupName) => _ = Run("DELETE FROM favorite_world WHERE group_name = @group_name", ("@group_name", groupName));

    public void RemoveWorldFromFavorites(string worldId, string groupName) => _ = Run("DELETE FROM favorite_world WHERE world_id = @world_id AND group_name = @group_name", ("@world_id", worldId), ("@group_name", groupName));

    public string GetWorldFavorites() => Rows("SELECT * FROM favorite_world");

    public void RemoveWorldFromCache(string worldId) => _ = Run("DELETE FROM cache_world WHERE id = @world_id", ("@world_id", worldId));

    public string GetWorldCache() => Rows("SELECT * FROM cache_world");

    public string GetCachedWorldById(string id) => Rows("SELECT * FROM cache_world WHERE id = @id", ("@id", id));

    public void AddFriendToLocalFavorites(string userId, string groupName, string createdAt) => _ = Run("INSERT OR REPLACE INTO favorite_friend (user_id, group_name, created_at) VALUES (@user_id, @group_name, @created_at)", ("@user_id", userId), ("@group_name", groupName), ("@created_at", createdAt));

    public void RemoveFriendFromLocalFavorites(string userId, string groupName) => _ = Run("DELETE FROM favorite_friend WHERE user_id = @user_id AND group_name = @group_name", ("@user_id", userId), ("@group_name", groupName));

    public void RenameFriendFavoriteGroup(string newGroupName, string groupName) => _ = Run("UPDATE favorite_friend SET group_name = @new_group_name WHERE group_name = @group_name", ("@new_group_name", newGroupName), ("@group_name", groupName));

    public void DeleteFriendFavoriteGroup(string groupName) => _ = Run("DELETE FROM favorite_friend WHERE group_name = @group_name", ("@group_name", groupName));

    public string GetFriendFavorites() => Rows("SELECT * FROM favorite_friend");

    public void AddPrintToFavorites(string printId, string createdAt) => _ = Run("INSERT OR REPLACE INTO favorite_print (print_id, created_at) VALUES (@print_id, @created_at)", ("@print_id", printId), ("@created_at", createdAt));

    public void RemovePrintFromFavorites(string printId) => _ = Run("DELETE FROM favorite_print WHERE print_id = @print_id", ("@print_id", printId));

    public string GetPrintFavorites() => Rows("SELECT * FROM favorite_print");
}
