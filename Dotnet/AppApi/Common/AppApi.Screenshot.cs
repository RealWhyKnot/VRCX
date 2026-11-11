using System.Diagnostics;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using VRCX.ScreenshotMetadata;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    [GeneratedRegex(@"\\Prints\\|\\Stickers\\|\\Emoji\\", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, 2000)]
    private static partial Regex ScreenshotRegex();

    public virtual string? GetExtraScreenshotData(string path, bool carouselCache)
    {
        string fileName = Path.GetFileNameWithoutExtension(path);
        var metadata = new JObject();

        if (!File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal))
        {
            return null;
        }

        string directory = Path.GetDirectoryName(path) ?? throw new ArgumentException("Screenshot path has no directory.", nameof(path));
        string[] files = Directory.GetFiles(directory, "*.png");

        if (carouselCache)
        {
            int index = Array.IndexOf(files, path);
            if (index > 0)
            {
                metadata.Add("previousFilePath", files[index - 1]);
            }
            if (index < files.Length - 1)
            {
                metadata.Add("nextFilePath", files[index + 1]);
            }
        }

        using var png = new PNGFile(path, writeAccess: false);
        metadata.Add("fileResolution", PNGHelper.ReadResolution(png));

        DateTime creationDate = File.GetCreationTime(path);
        metadata.Add("creationDate", creationDate.ToString("yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture));

        long fileSizeBytes = new FileInfo(path).Length;
        metadata.Add("fileSizeBytes", fileSizeBytes.ToString(System.Globalization.CultureInfo.InvariantCulture));
        metadata.Add("fileName", fileName);
        metadata.Add("filePath", path);
        metadata.Add("fileSize", $"{fileSizeBytes / 1024f / 1024f:0.00} MB");

        return metadata.ToString(Formatting.Indented);
    }

    public virtual string? GetScreenshotMetadata(string path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return null;
        }

        ScreenshotInfo? metadata = ScreenshotHelper.GetScreenshotMetadata(path);

        if (metadata == null)
        {
            var obj = new JObject
            {
                { "sourceFile", path },
                { "error", "Screenshot contains no metadata." },
            };

            return obj.ToString(Formatting.Indented);
        }

        if (metadata.Error != null)
        {
            var obj = new JObject
            {
                { "sourceFile", path },
                { "error", metadata.Error },
            };

            return obj.ToString(Formatting.Indented);
        }

        return JsonConvert.SerializeObject(metadata, Formatting.Indented, new JsonSerializerSettings
        {
            ContractResolver = new DefaultContractResolver
            {
                NamingStrategy = new CamelCaseNamingStrategy(),
            },
        });
    }

    public string FindScreenshotsBySearch(string searchQuery, int searchType = 0)
    {
        var stopwatch = new Stopwatch();
        stopwatch.Start();

        string searchPath = GetVRChatPhotosLocation();
        List<ScreenshotInfo> screenshots = ScreenshotHelper.FindScreenshots(searchQuery, searchPath, (ScreenshotHelper.ScreenshotSearchType)searchType);

        JArray json = [];

        foreach (ScreenshotInfo screenshot in screenshots)
        {
            json.Add(screenshot.SourceFile);
        }

        stopwatch.Stop();

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"FindScreenshotsBySearch took {stopwatch.ElapsedMilliseconds}ms to complete.");

        return json.ToString();
    }

    public string? GetLastScreenshot()
    {
        string path = GetVRChatPhotosLocation();
        if (!Directory.Exists(path))
        {
            return null;
        }

        IEnumerable<string> imageFiles = Directory.GetFiles(path, "*.png", SearchOption.AllDirectories)
            .Where(x => !ScreenshotRegex().IsMatch(x));
        string? lastScreenshot = imageFiles.OrderByDescending(Directory.GetCreationTime).FirstOrDefault();

        return lastScreenshot;
    }

    public virtual bool DeleteScreenshotMetadata(string path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            ScreenshotHelper.DeleteTextMetadata(path, deleteVRChatMetadata: true);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or FormatException or InvalidOperationException)
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to delete screenshot metadata for {0}", path);
            return false;
        }
    }

    public void DeleteAllScreenshotMetadata()
    {
        string path = GetVRChatPhotosLocation();
        if (!Directory.Exists(path))
        {
            return;
        }

        string[] imageFiles = Directory.GetFiles(path, "*.png", SearchOption.AllDirectories);
        foreach (string file in imageFiles)
        {
            try
            {
                ScreenshotHelper.DeleteTextMetadata(file, deleteVRChatMetadata: true);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or FormatException or InvalidOperationException)
            {
                Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Failed to delete screenshot metadata for {0}", file);
            }
        }
    }
}
