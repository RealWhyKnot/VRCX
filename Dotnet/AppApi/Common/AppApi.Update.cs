namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    public virtual async Task DownloadUpdateAsync(string fileLink, string hashString, int downloadSize, CancellationToken cancellationToken = default) => await Update.DownloadUpdateAsync(fileLink, hashString, downloadSize, cancellationToken).ConfigureAwait(false);

    public virtual void CancelUpdate() => _ = Update.CancelUpdateAsync();

    public virtual int CheckUpdateProgress() => Update.UpdateProgress;
}
