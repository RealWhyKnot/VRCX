using System.Globalization;
using System.Net;
using NLog;

namespace VRCX;

internal static class ImageCache
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly string CacheLocation = Path.Join(Program.AppDataDirectory, "ImageCache");
    private static readonly HttpClient Client = CreateClient();
    private static readonly List<string> ImageHosts =
    [
        "api.vrchat.cloud",
        "files.vrchat.cloud",
        "d348imysud55la.cloudfront.net",
        "assets.vrchat.com",
    ];

    private static HttpClient CreateClient()
    {
        HttpClientHandler? handler = null;
        HttpClient? client = null;
        try
        {
            handler = new HttpClientHandler { CheckCertificateRevocationList = true };
            if (WebApi.ProxySet)
            {
                handler.Proxy = WebApi.Proxy;
            }
            client = new HttpClient(handler, disposeHandler: true);
            handler = null;
            client.DefaultRequestHeaders.Add("User-Agent", Program.Version);
            HttpClient result = client;
            client = null;
            return result;
        }
        finally
        {
            client?.Dispose();
            handler?.Dispose();
        }
    }

    public static void PopulateImageHosts(List<string> hosts)
    {
        ArgumentNullException.ThrowIfNull(hosts);
        foreach (string host in hosts)
        {
            if (!Uri.TryCreate(host, UriKind.Absolute, out Uri? uri) || string.IsNullOrEmpty(uri.Host))
            {
                continue;
            }
            if (!ImageHosts.Contains(uri.Host))
            {
                ImageHosts.Add(uri.Host);
            }
        }
    }

    private static HttpRequestMessage CreateRequest(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? uri) || !ImageHosts.Contains(uri.Host))
        {
            throw new ArgumentException("Invalid image host.", nameof(url));
        }
        var request = new HttpRequestMessage(HttpMethod.Get, uri);
        if (string.Equals(uri.Host, "api.vrchat.cloud", StringComparison.Ordinal))
        {
            CookieContainer cookies = WebApi.Instance.CookieContainer;
            string cookieHeader = cookies.GetCookieHeader(new Uri("https://api.vrchat.cloud"));
            if (!string.IsNullOrEmpty(cookieHeader))
            {
                request.Headers.Add("Cookie", cookieHeader);
            }
        }
        return request;
    }

    public static async Task<string> GetImageAsync(string url, string fileId, string version, CancellationToken cancellationToken = default)
    {
        string directoryLocation = Path.Join(CacheLocation, fileId);
        string fileLocation = Path.Join(directoryLocation, $"{version}.png");
        if (File.Exists(fileLocation) && new FileInfo(fileLocation).Length > 0)
        {
            Directory.SetLastWriteTimeUtc(directoryLocation, DateTime.UtcNow);
            return fileLocation;
        }
        if (Directory.Exists(directoryLocation))
        {
            Directory.Delete(directoryLocation, recursive: true);
        }
        Directory.CreateDirectory(directoryLocation);
        try
        {
            await SaveImageToFileAsync(url, fileLocation, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or UnauthorizedAccessException or ArgumentException)
        {
            Logger.Error(exception, CultureInfo.InvariantCulture, "Failed to fetch image");
            return string.Empty;
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            Logger.Error(exception, CultureInfo.InvariantCulture, "Image request timed out");
            return string.Empty;
        }
        if (Directory.GetDirectories(CacheLocation).Length > 1100)
        {
            CleanImageCache();
        }
        return fileLocation;
    }

    public static async Task SaveImageToFileAsync(string url, string path, CancellationToken cancellationToken = default)
    {
        using HttpRequestMessage request = CreateRequest(url);
        using HttpResponseMessage response = await Client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        await using (stream.ConfigureAwait(false))
        {
            var fileStream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None);
            await using (fileStream.ConfigureAwait(false))
            {
                await stream.CopyToAsync(fileStream, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private static void CleanImageCache()
    {
        var directory = new DirectoryInfo(CacheLocation);
        IEnumerable<DirectoryInfo> folders = directory.GetDirectories().OrderByDescending(folder => folder.LastWriteTime).Skip(1000);
        foreach (DirectoryInfo folder in folders)
        {
            folder.Delete(recursive: true);
        }
    }
}
