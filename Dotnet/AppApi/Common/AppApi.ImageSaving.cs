using System.Security.Cryptography;
using System.Text.Json;
using librsync.net;
using SkiaSharp;
using VRCX.Imaging;
using VRCX.ScreenshotMetadata;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    public virtual void PopulateImageHosts(string json)
    {
        List<string>? hosts = JsonSerializer.Deserialize<List<string>>(json);
        ImageCache.PopulateImageHosts(hosts ?? []);
    }

    public virtual async Task<string> GetImageAsync(string imageLink, string fileId, string version, CancellationToken cancellationToken = default) => await ImageCache.GetImageAsync(imageLink, fileId, version, cancellationToken).ConfigureAwait(false);

    public string ResizeImageToFitLimits(string base64data) => Convert.ToBase64String(ResizeImageToFitLimits(Convert.FromBase64String(base64data), matchingDimensions: false));

    public virtual byte[] ResizeImageToFitLimits(byte[] imageData, bool matchingDimensions, int maxWidth = 2000,
        int maxHeight = 2000, long maxSize = 10_000_000)
    {
        using var image = ImageRaster.Load(imageData);

        if (image.Width > maxWidth)
        {
            double sizingFactor = image.Width / (double)maxWidth;
            int newHeight = (int)Math.Round(image.Height / sizingFactor);
            image.Resize(maxWidth, newHeight);
        }
        if (image.Height > maxHeight)
        {
            double sizingFactor = image.Height / (double)maxHeight;
            int newWidth = (int)Math.Round(image.Width / sizingFactor);
            image.Resize(newWidth, maxHeight);
        }
        if (matchingDimensions && image.Width != image.Height)
        {
            int targetSize = Math.Max(image.Width, image.Height);
            int xOffset = (targetSize - image.Width) / 2;
            int yOffset = (targetSize - image.Height) / 2;
            image.PlaceOnCanvas(targetSize, targetSize, SKColors.Transparent, xOffset, yOffset);
        }

        SaveToFileToUpload();
        for (int i = 0; i < 250 && imageData.Length > maxSize; i++)
        {
            SaveToFileToUpload();
            if (imageData.Length < maxSize)
            {
                break;
            }

            int newWidth;
            int newHeight;
            if (image.Width > image.Height)
            {
                newWidth = image.Width - 25;
                newHeight = (int)Math.Round(image.Height / (image.Width / (double)newWidth));
            }
            else
            {
                newHeight = image.Height - 25;
                newWidth = (int)Math.Round(image.Width / (image.Height / (double)newHeight));
            }

            image.Resize(newWidth, newHeight);
        }

        return imageData.Length > maxSize ? throw new InvalidOperationException("Failed to get image into target filesize.") : imageData;
        void SaveToFileToUpload() => imageData = image.EncodePng();
    }

    public virtual byte[] ResizePrintImage(byte[] imageData)
    {
        const int DesiredWidth = 1920;
        const int DesiredHeight = 1080;

        using var image = ImageRaster.Load(imageData);

        if (image.Height > image.Width)
        {
            image.Rotate270();
        }

        if (image.Width < DesiredWidth || image.Height < DesiredHeight)
        {
            const double ExpectedAspectRatio = 1920.0 / 1080.0;
            double aspectRatio = (double)image.Width / image.Height;
            int width, height, xOffset, yOffset;

            if (aspectRatio > ExpectedAspectRatio)
            {
                width = 1920;
                height = (int)(width / aspectRatio);
                xOffset = 0;
                yOffset = (1080 - height) / 2;
            }
            else
            {
                height = 1080;
                width = (int)(height * aspectRatio);
                xOffset = (1920 - width) / 2;
                yOffset = 0;
            }
            image.Resize(width, height);
            image.PlaceOnCanvas(1920, 1080, SKColors.White, xOffset, yOffset);
        }

        if (image.Width > DesiredWidth)
        {
            double sizingFactor = image.Width / (double)DesiredWidth;
            int newHeight = (int)Math.Round(image.Height / sizingFactor);
            image.Resize(DesiredWidth, newHeight);
        }
        if (image.Height > DesiredHeight)
        {
            double sizingFactor = image.Height / (double)DesiredHeight;
            int newWidth = (int)Math.Round(image.Width / sizingFactor);
            image.Resize(newWidth, DesiredHeight);
        }

        const int YBorderOffset = 69;
        int newX = (2048 - image.Width) / 2;
        image.PlaceOnCanvas(2048, 1440, SKColors.White, newX, YBorderOffset);
        return image.EncodePng();
    }

    public async Task CropAllPrintsAsync(string ugcFolderPath, CancellationToken cancellationToken = default)
    {
        string folder = Path.Join(GetUGCPhotoLocation(ugcFolderPath), "Prints");

        if (!Directory.Exists(folder))
        {
            return;
        }
        string[] files = Directory.GetFiles(folder, "*.png", SearchOption.AllDirectories);
        foreach (string file in files)
        {
            await CropPrintImageAsync(file, cancellationToken).ConfigureAwait(false);
        }
    }

    public virtual async Task<bool> CropPrintImageAsync(string path, CancellationToken cancellationToken = default)
    {
        string tempPath = path + ".temp";
        byte[] bytes = await File.ReadAllBytesAsync(path, cancellationToken).ConfigureAwait(false);
        using var print = ImageRaster.Load(bytes);

        if (!CropPrint(print))
        {
            return false;
        }

        await File.WriteAllBytesAsync(tempPath, print.EncodePng(), cancellationToken).ConfigureAwait(false);

        using (var oldPngFile = new PNGFile(path, writeAccess: false))
        using (var newPngFile = new PNGFile(tempPath, writeAccess: true))
        {
            List<PNGChunk> textChunks = oldPngFile.GetChunksOfType(PNGChunkTypeFilter.iTXt);

            for (int i = 0; i < textChunks.Count; i++)
            {
                newPngFile.WriteChunk(textChunks[i]);
            }
        }

        for (int i = 0; i < 10; i++)
        {
            try
            {
                using (File.Open(path, FileMode.Append, FileAccess.Write, FileShare.None))
                {
                    break;
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                await Task.Delay(1000, cancellationToken).ConfigureAwait(false);
            }
        }
        try
        {
            File.Move(tempPath, path, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to replace cropped print image");
            return false;
        }

        return true;
    }

    internal static bool CropPrint(ImageRaster image)
    {
        if (image.Width != 2048 || image.Height != 1440)
        {
            return false;
        }

        image.Crop(64, 69, 1920, 1080);
        return true;
    }

    public async Task<string?> SavePrintToFileAsync(string imageLink, string ugcFolderPath, string monthFolder, string fileName, CancellationToken cancellationToken = default)
    {
        string folder = Path.Join(GetUGCPhotoLocation(ugcFolderPath), "Prints", MakeValidFileName(monthFolder));
        Directory.CreateDirectory(folder);
        string filePath = Path.Join(folder, MakeValidFileName(fileName));
        if (File.Exists(filePath))
        {
            return null;
        }

        try
        {
            await ImageCache.SaveImageToFileAsync(imageLink, filePath, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or UnauthorizedAccessException or ArgumentException || (ex is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to save print to file");
            return null;
        }

        return filePath;
    }

    public async Task<string?> SaveStickerToFileAsync(string imageLink, string ugcFolderPath, string monthFolder, string fileName, CancellationToken cancellationToken = default)
    {
        string folder = Path.Join(GetUGCPhotoLocation(ugcFolderPath), "Stickers", MakeValidFileName(monthFolder));
        Directory.CreateDirectory(folder);
        string filePath = Path.Join(folder, MakeValidFileName(fileName));
        if (File.Exists(filePath))
        {
            return null;
        }

        try
        {
            await ImageCache.SaveImageToFileAsync(imageLink, filePath, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or UnauthorizedAccessException or ArgumentException || (ex is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to save print to file");
            return null;
        }

        return filePath;
    }

    public async Task<string?> SaveEmojiToFileAsync(string imageLink, string ugcFolderPath, string monthFolder, string fileName, CancellationToken cancellationToken = default)
    {
        string folder = Path.Join(GetUGCPhotoLocation(ugcFolderPath), "Emoji", MakeValidFileName(monthFolder));
        Directory.CreateDirectory(folder);
        string filePath = Path.Join(folder, MakeValidFileName(fileName));
        if (File.Exists(filePath))
        {
            return null;
        }

        try
        {
            await ImageCache.SaveImageToFileAsync(imageLink, filePath, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or UnauthorizedAccessException or ArgumentException || (ex is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to save print to file");
            return null;
        }

        return filePath;
    }

    public virtual string MD5File(string blob)
    {
        byte[] fileData = Convert.FromBase64CharArray(blob.ToCharArray(), 0, blob.Length);
        byte[] md5Hash = CryptographicOperations.HashData(HashAlgorithmName.MD5, fileData);
        return Convert.ToBase64String(md5Hash);
    }

    public virtual string SignFile(string blob)
    {
        byte[] fileData = Convert.FromBase64String(blob);
        using var input = new MemoryStream(fileData);
        using Stream sig = Librsync.ComputeSignature(input);
        using var memoryStream = new MemoryStream();
        sig.CopyTo(memoryStream);
        byte[] sigBytes = memoryStream.ToArray();
        return Convert.ToBase64String(sigBytes);
    }

    public virtual string FileLength(string blob)
    {
        byte[] fileData = Convert.FromBase64String(blob);
        return fileData.Length.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }
}
