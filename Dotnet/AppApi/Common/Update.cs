namespace VRCX;

public partial class AppApi
{
    public async Task DownloadUpdateAsync(string fileUrl, string hashString, int downloadSize) => await Update.DownloadUpdateAsync(fileUrl, hashString, downloadSize);

    public void CancelUpdate() => Update.CancelUpdateAsync();

    public int CheckUpdateProgress() => Update.UpdateProgress;

    public Task DownloadUpdateAsync(Uri fileUrl, string hashString, int downloadSize) => DownloadUpdateAsync(fileUrl.AbsoluteUri, hashString, downloadSize);
}
