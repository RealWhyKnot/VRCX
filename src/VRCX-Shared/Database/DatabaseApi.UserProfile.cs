namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetUserProfile(string userId) => Rows($"SELECT user_id, bio, bio_links, updated_at FROM {UserTable("user_profile")} WHERE user_id = @user_id", ("@user_id", userId));

    public string GetAllUserProfiles() => Rows($"SELECT user_id, bio, bio_links, updated_at FROM {UserTable("user_profile")}");

    public void SetUserProfile(string userId, string? bio, string bioLinks, string updatedAt) => _ = Run($"INSERT OR REPLACE INTO {UserTable("user_profile")} (user_id, bio, bio_links, updated_at) VALUES (@user_id, @bio, @bio_links, @updated_at)", ("@user_id", userId), ("@bio", bio), ("@bio_links", bioLinks), ("@updated_at", updatedAt));

    public void DeleteUserProfile(string userId) => _ = Run($"DELETE FROM {UserTable("user_profile")} WHERE user_id = @user_id", ("@user_id", userId));
}
