namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetModeration(string userId) => Rows($"SELECT * FROM {UserTable("moderation")} WHERE user_id = @userId", ("@userId", userId));

    public void SetModeration(string userId, string? updatedAt, string? displayName, bool block, bool mute) => _ = Run($"INSERT OR REPLACE INTO {UserTable("moderation")} (user_id, updated_at, display_name, block, mute) VALUES (@user_id, @updated_at, @display_name, @block, @mute)", ("@user_id", userId), ("@updated_at", updatedAt), ("@display_name", displayName), ("@block", block ? 1L : 0L), ("@mute", mute ? 1L : 0L));

    public void DeleteModeration(string userId) => _ = Run($"DELETE FROM {UserTable("moderation")} WHERE user_id = @user_id", ("@user_id", userId));
}
