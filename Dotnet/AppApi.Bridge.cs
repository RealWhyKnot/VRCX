#if LINUX
namespace VRCX;

public abstract partial class AppApi
{
    public Func<Task<double>> GetZoom => () => GetZoomAsync();

    public FolderSelectorCallback OpenFolderSelectorDialog => path => OpenFolderSelectorDialogAsync(path);

    public FileSelectorCallback OpenFileSelectorDialog =>
        (path, extension, filter) => OpenFileSelectorDialogAsync(path, extension, filter);

    public Func<string, Task<bool>> TryOpenInstanceInVrc => url => TryOpenInstanceInVrcAsync(url);

    public Func<string, string, string, Task<string>> GetImage =>
        (url, fileId, version) => GetImageAsync(url, fileId, version);

    public Func<string, Task> CropAllPrints => path => CropAllPrintsAsync(path);

    public Func<string, Task<bool>> CropPrintImage => path => CropPrintImageAsync(path);

    public Func<string, string, string, string, Task<string?>> SavePrintToFile =>
        (url, folder, month, fileName) => SavePrintToFileAsync(url, folder, month, fileName);

    public Func<string, string, string, string, Task<string?>> SaveStickerToFile =>
        (url, folder, month, fileName) => SaveStickerToFileAsync(url, folder, month, fileName);

    public Func<string, string, string, string, Task<string?>> SaveEmojiToFile =>
        (url, folder, month, fileName) => SaveEmojiToFileAsync(url, folder, month, fileName);

    public Func<string, string, int, Task> DownloadUpdate =>
        (url, hash, size) => DownloadUpdateAsync(url, hash, size);
}
#endif
