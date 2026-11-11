namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    public virtual async Task DownloadUpdateAsync(string fileUrl, string hashString, int downloadSize) => await Update.DownloadUpdateAsync(new Uri(fileUrl), hashString, downloadSize).ConfigureAwait(false);

    public virtual void CancelUpdate() => _ = Update.CancelUpdateAsync();

    public virtual int CheckUpdateProgress() => Update.UpdateProgress;

    internal Task DownloadUpdateAsync(Uri fileUrl, string hashString, int downloadSize) => DownloadUpdateAsync(fileUrl.AbsoluteUri, hashString, downloadSize);
}
