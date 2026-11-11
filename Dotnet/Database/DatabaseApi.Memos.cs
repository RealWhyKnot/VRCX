namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetUserMemo(string userId) => Rows("SELECT * FROM memos WHERE user_id = @user_id", ("@user_id", userId));

    public string GetAllUserMemos() => Rows("SELECT user_id, memo FROM memos");

    public void SetUserMemo(string userId, string editedAt, string? memo) => _ = Run("INSERT OR REPLACE INTO memos (user_id, edited_at, memo) VALUES (@user_id, @edited_at, @memo)", ("@user_id", userId), ("@edited_at", editedAt), ("@memo", memo));

    public void DeleteUserMemo(string userId) => _ = Run("DELETE FROM memos WHERE user_id = @user_id", ("@user_id", userId));

    public string GetWorldMemo(string worldId) => Rows("SELECT * FROM world_memos WHERE world_id = @world_id", ("@world_id", worldId));

    public void SetWorldMemo(string worldId, string editedAt, string? memo) => _ = Run("INSERT OR REPLACE INTO world_memos (world_id, edited_at, memo) VALUES (@world_id, @edited_at, @memo)", ("@world_id", worldId), ("@edited_at", editedAt), ("@memo", memo));

    public void DeleteWorldMemo(string worldId) => _ = Run("DELETE FROM world_memos WHERE world_id = @world_id", ("@world_id", worldId));

    public string GetAvatarMemo(string avatarId) => Rows("SELECT * FROM avatar_memos WHERE avatar_id = @avatar_id", ("@avatar_id", avatarId));

    public void SetAvatarMemo(string avatarId, string editedAt, string? memo) => _ = Run("INSERT OR REPLACE INTO avatar_memos (avatar_id, edited_at, memo) VALUES (@avatar_id, @edited_at, @memo)", ("@avatar_id", avatarId), ("@edited_at", editedAt), ("@memo", memo));

    public void DeleteAvatarMemo(string avatarId) => _ = Run("DELETE FROM avatar_memos WHERE avatar_id = @avatar_id", ("@avatar_id", avatarId));

    public void AddUserNote(string userId, string? displayName, string? note, string createdAt) => _ = Run($"INSERT OR REPLACE INTO {UserTable("notes")} (user_id, display_name, note, created_at) VALUES (@user_id, @display_name, @note, @created_at)", ("@user_id", userId), ("@display_name", displayName), ("@note", note), ("@created_at", createdAt));

    public string GetAllUserNotes() => Rows($"SELECT user_id, display_name, note, created_at FROM {UserTable("notes")}");

    public void DeleteUserNote(string userId) => _ = Run($"DELETE FROM {UserTable("notes")} WHERE user_id = @userId", ("@userId", userId));
}
