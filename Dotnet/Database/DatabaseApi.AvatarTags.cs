namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    public string GetAvatarTags(string avatarId) => Rows("SELECT tag, color FROM avatar_tags WHERE avatar_id = @avatar_id", ("@avatar_id", avatarId));

    public string GetAllAvatarTags() => Rows("SELECT avatar_id, tag, color FROM avatar_tags");

    public string GetAllDistinctTags() => Rows("SELECT DISTINCT tag FROM avatar_tags ORDER BY tag");

    public void AddAvatarTag(string avatarId, string tag, string? color) => _ = Run("INSERT OR IGNORE INTO avatar_tags (avatar_id, tag, color) VALUES (@avatar_id, @tag, @color)", ("@avatar_id", avatarId), ("@tag", tag), ("@color", color));

    public void UpdateAvatarTagColor(string avatarId, string tag, string? color) => _ = Run("UPDATE avatar_tags SET color = @color WHERE avatar_id = @avatar_id AND tag = @tag", ("@avatar_id", avatarId), ("@tag", tag), ("@color", color));

    public void RemoveAvatarTag(string avatarId, string tag) => _ = Run("DELETE FROM avatar_tags WHERE avatar_id = @avatar_id AND tag = @tag", ("@avatar_id", avatarId), ("@tag", tag));

    public void RemoveAllAvatarTags(string avatarId) => _ = Run("DELETE FROM avatar_tags WHERE avatar_id = @avatar_id", ("@avatar_id", avatarId));
}
