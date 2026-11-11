namespace VRCX;

internal interface IAssetBundleManager
{
    string GetVRChatCacheFullLocation(string id, int version, string variant = "", int variantVersion = 0);

    Tuple<long, bool, string> CheckVRChatCache(string id, int version, string variant, int variantVersion);

    void DeleteCache(string id, int version, string variant, int variantVersion);

    void DeleteAllCache();

    List<string> SweepCache();

    long GetCacheSize();
}
