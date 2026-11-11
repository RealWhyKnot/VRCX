using System.Collections;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NLog;
using VRCX.Imaging;
using Cookie = System.Net.Cookie;
using Timer = System.Threading.Timer;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class WebApi : IDisposable
{
#if LINUX
    public Func<string, Task<string>> ExecuteJson => options => ExecuteJsonAsync(options);

    public Func<IDictionary<string, object>, Task<Tuple<int, string>>> Execute => options => ExecuteAsync(options);
#endif

    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static bool ProxySet { get; set; }

    public static string ProxyServer { get; set; } = "";

    public static IWebProxy? Proxy { get; set; } = WebRequest.DefaultWebProxy;

    public static WebApi Instance { get; private set; } = new WebApi();

    public CookieContainer CookieContainer { get; private set; }
    private bool _cookieDirty;
    private readonly Timer _timer;

    private HttpClient? _httpClient;
    private SocketsHttpHandler? _httpHandler;

    public WebApi()
    {
#if LINUX
        Instance ??= this;
#endif
        CookieContainer = new CookieContainer();
        _timer = new Timer(TimerCallback, state: null, -1, -1);
    }

    private void TimerCallback(object? state)
    {
        try
        {
            SaveCookies();
        }
        catch (Exception e) when (e is System.Data.Common.DbException or InvalidOperationException or IOException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to save cookies: {e.Message}");
        }
    }

    public void Init()
    {
        SetProxy();
        InitializeHttpClient();
        LoadCookies();
        _timer.Change(1000, 1000);
    }

    private void InitializeHttpClient()
    {
        _httpHandler = new SocketsHttpHandler
        {
            CookieContainer = CookieContainer,
            UseCookies = true,
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            MaxConnectionsPerServer = 10,
        };

        if (ProxySet)
        {
            _httpHandler.Proxy = Proxy;
            _httpHandler.UseProxy = true;
        }

        _httpClient = new HttpClient(_httpHandler);
        _httpClient.DefaultRequestHeaders.Add("User-Agent", Program.Version);
    }

    private static void SetProxy()
    {
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.ProxyUrl))
        {
            ProxyServer = StartupArgs.LaunchArguments.ProxyUrl;
        }

        if (string.IsNullOrEmpty(ProxyServer))
        {
            string proxyUrl = VRCXStorage.Instance.Get("VRCX_ProxyServer");
            if (!string.IsNullOrEmpty(proxyUrl))
            {
                ProxyServer = proxyUrl;
            }
        }

        if (string.IsNullOrEmpty(ProxyServer))
        {
            return;
        }

        try
        {
            ProxySet = true;
            Proxy = new WebProxy(ProxyServer);
        }
        catch (UriFormatException)
        {
            VRCXStorage.Instance.Set("VRCX_ProxyServer", string.Empty);
            VRCXStorage.Instance.Save();
            const string Message =
                "The proxy server URI you used is invalid.\nVRCX will close, please correct the proxy URI.";
#if !LINUX
            MessageBox.Show(Message, "Invalid Proxy URI", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, Message);
            Environment.Exit(0);
        }
    }

    public void Exit()
    {
        _timer.Change(-1, -1);
        SaveCookies();
    }

    public void ClearCookies()
    {
#if !LINUX
        CefSharp.Cef.GetGlobalCookieManager().DeleteCookies();
#endif
        CookieContainer = new CookieContainer();
        InitializeHttpClient();
        _cookieDirty = true;
        SaveCookies();
    }

    private void LoadCookies()
    {
        SQLiteDatabase.Instance.ExecuteNonQuery(
            "CREATE TABLE IF NOT EXISTS `cookies` (`key` TEXT PRIMARY KEY, `value` TEXT)");
        object[][] values = SQLiteDatabase.Instance.Execute("SELECT `value` FROM `cookies` WHERE `key` = @key",
            new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                { "@key", "default" },
            }
        );
        if (values.Length == 0)
        {
            return;
        }

        try
        {
            object[] item = values[0];
            using var stream = new MemoryStream(Convert.FromBase64String((string)item[0]));
            CookieCollection cookies = System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream) ?? [];
            var container = new CookieContainer();
            container.Add(cookies);
            CookieContainer = container;
            InitializeHttpClient();
        }
        catch (Exception e) when (e is ArgumentException or CookieException or FormatException or IndexOutOfRangeException or InvalidCastException or InvalidDataException or NotSupportedException or System.Text.Json.JsonException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to load cookies: {e.Message}");
        }
    }

    private List<Cookie> GetAllCookies()
    {
        var cookieTable = (Hashtable?)CookieContainer.GetType().InvokeMember("m_domainTable",
            BindingFlags.NonPublic |
            BindingFlags.GetField |
            BindingFlags.Instance,
            binder: null,
            CookieContainer,
            [], culture: System.Globalization.CultureInfo.InvariantCulture);
        if (cookieTable == null)
        {
            return [];
        }

        var uniqueCookies = new Dictionary<string, Cookie>(StringComparer.Ordinal);
        foreach (object? item in cookieTable.Keys)
        {
            if (item is not string domain || string.IsNullOrEmpty(domain))
            {
                continue;
            }

            if (domain.StartsWith('.'))
            {
                domain = domain[1..];
            }

            string address = $"http://{domain}/";
            if (!Uri.TryCreate(address, UriKind.Absolute, out Uri? uri))
            {
                continue;
            }

            foreach (Cookie cookie in CookieContainer.GetCookies(uri))
            {
                string key = $"{domain}.{cookie.Name}";
                if (!uniqueCookies.TryGetValue(key, out Cookie? value) ||
                    cookie.TimeStamp > value.TimeStamp)
                {
                    cookie.Expires = DateTime.MaxValue;
                    uniqueCookies[key] = cookie;
                }
            }
        }

        return [.. uniqueCookies.Values];
    }

    public void SaveCookies()
    {
        if (!_cookieDirty)
        {
            return;
        }

        try
        {
            List<Cookie> cookies = GetAllCookies();
            using var memoryStream = new MemoryStream();
            System.Text.Json.JsonSerializer.Serialize(memoryStream, cookies);
            SQLiteDatabase.Instance.ExecuteNonQuery(
                "INSERT OR REPLACE INTO `cookies` (`key`, `value`) VALUES (@key, @value)",
                new Dictionary<string, object?>(StringComparer.Ordinal)
                {
                    { "@key", "default" },
                    { "@value", Convert.ToBase64String(memoryStream.ToArray()) },
                }
            );

            _cookieDirty = false;
        }
        catch (Exception e) when (e is MemberAccessException or AmbiguousMatchException or InvalidCastException or ArgumentException or NotSupportedException or System.Text.Json.JsonException or System.Data.SQLite.SQLiteException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to save cookies: {e.Message}");
        }
    }

    public string GetCookies()
    {
        _cookieDirty = true;

        using var memoryStream = new MemoryStream();
        System.Text.Json.JsonSerializer.Serialize(memoryStream, GetAllCookies());
        return Convert.ToBase64String(memoryStream.ToArray());
    }

    public void SetCookies(string cookies)
    {
        try
        {
            using var stream = new MemoryStream(Convert.FromBase64String(cookies));
            CookieCollection data = System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream) ?? [];
            CookieContainer.Add(data);
        }
        catch (Exception e) when (e is ArgumentException or CookieException or FormatException or NotSupportedException or System.Text.Json.JsonException)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to set cookies: {e.Message}");
        }

        _cookieDirty = true;
    }

    private static string RequireString(object? value, string name) => (string?)value ?? throw new ArgumentNullException(name);

    private static AppApi RequireAppApi() => Program.AppApiInstance ?? throw new InvalidOperationException("The application API is not initialized.");

    private static void AddStringPart(MultipartFormDataContent content, string value, string name)
    {
        StringContent? part = new(value);
        try
        {
            content.Add(part, name);
            part = null;
        }
        finally
        {
            part?.Dispose();
        }
    }

    private static void AddPngPart(MultipartFormDataContent content, byte[] image, string name, string fileName, bool hasExplicitLength)
    {
        ByteArrayContent? part = new(image);
        try
        {
            part.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            if (hasExplicitLength)
            {
                part.Headers.ContentLength = image.Length;
            }

            content.Add(part, name, fileName);
            part = null;
        }
        finally
        {
            part?.Dispose();
        }
    }

    private static HttpRequestMessage BuildLegacyImageUploadRequest(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x", System.Globalization.CultureInfo.InvariantCulture);
        var content = new MultipartFormDataContent(boundary);

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            AddStringPart(content, RequireString(postDataObject, "postData"), "data");
        }

        byte[] fileToUpload = RequireAppApi().ResizeImageToFitLimits(Convert.FromBase64String(RequireString(options["imageData"], "imageData")), matchingDimensions: false);
        AddPngPart(content, fileToUpload, "image", "image.png", hasExplicitLength: false);

        request.Content = content;
        return request;
    }

    private static HttpRequestMessage BuildUploadFilePutRequest(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        string fileData = RequireString(options["fileData"], "fileData");
        byte[] sentData = Convert.FromBase64CharArray(fileData.ToCharArray(), 0, fileData.Length);
        var content = new ByteArrayContent(sentData);
        content.Headers.ContentType = new MediaTypeHeaderValue(RequireString(options["fileMIME"], "fileMIME"));
        if (options.TryGetValue("fileMD5", out object? fileMd5))
        {
            content.Headers.ContentMD5 = Convert.FromBase64String(RequireString(fileMd5, "fileMD5"));
        }

        request.Content = content;
        return request;
    }

    private static HttpRequestMessage BuildImageUploadRequest(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x", System.Globalization.CultureInfo.InvariantCulture);
        var content = new MultipartFormDataContent(boundary);

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            var jsonPostData = (JObject?)JsonConvert.DeserializeObject((string?)postDataObject ?? string.Empty);
            if (jsonPostData != null)
            {
                foreach (KeyValuePair<string, JToken?> data in jsonPostData)
                {
                    AddStringPart(content, data.Value?.ToString() ?? string.Empty, data.Key);
                }
            }
        }

        bool matchingDimensions = options["matchingDimensions"] as bool? ?? false;
        byte[] fileToUpload = RequireAppApi().ResizeImageToFitLimits(Convert.FromBase64String(RequireString(options["imageData"], "imageData")), matchingDimensions);

        AddPngPart(content, fileToUpload, "file", "blob", hasExplicitLength: false);

        request.Content = content;
        return request;
    }

    private static HttpRequestMessage BuildPrintImageUploadRequest(string url, IDictionary<string, object> options)
    {
        if (options.TryGetValue("cropWhiteBorder", out object? cropWhiteBorder) && (bool)cropWhiteBorder)
        {
            using var print = ImageRaster.Load(Convert.FromBase64String(RequireString(options["imageData"], "imageData")));
            if (AppApi.CropPrint(print))
            {
                options["imageData"] = Convert.ToBase64String(print.EncodePng());
            }
        }

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x", System.Globalization.CultureInfo.InvariantCulture);
        var content = new MultipartFormDataContent(boundary);

        byte[] fileToUpload = RequireAppApi().ResizePrintImage(Convert.FromBase64String(RequireString(options["imageData"], "imageData")));

        AddPngPart(content, fileToUpload, "image", "image", hasExplicitLength: true);

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            Dictionary<string, string>? jsonPostData = JsonConvert.DeserializeObject<Dictionary<string, string>>(postDataObject.ToString() ?? string.Empty);
            if (jsonPostData != null)
            {
                foreach (KeyValuePair<string, string> entry in jsonPostData)
                {
                    AddStringPart(content, entry.Value, entry.Key);
                }
            }
        }

        request.Content = content;
        return request;
    }

    private static HttpRequestMessage CreateRequest(string url, IDictionary<string, object> options) =>
        options.TryGetValue("uploadImageLegacy", out _) ? BuildLegacyImageUploadRequest(url, options)
        : options.TryGetValue("uploadFilePUT", out _) ? BuildUploadFilePutRequest(url, options)
        : options.TryGetValue("uploadImage", out _) ? BuildImageUploadRequest(url, options)
        : options.TryGetValue("uploadImagePrint", out _) ? BuildPrintImageUploadRequest(url, options)
        : BuildRequest(url, options);

    private static HttpRequestMessage BuildRequest(string url, IDictionary<string, object> options)
    {
        HttpMethod httpMethod = HttpMethod.Get;
        if (options.TryGetValue("method", out object? methodObj))
        {
            httpMethod = HttpMethod.Parse(methodObj.ToString());
        }

        var request = new HttpRequestMessage(httpMethod, url);

        if (httpMethod != HttpMethod.Get && options.TryGetValue("body", out object? body))
        {
            var bodyContent = new StringContent((string)body, Encoding.UTF8);

            if (options.TryGetValue("headers", out object? headersObj))
            {
                Dictionary<string, string> headersDict = ParseHeaders(headersObj);
                if (headersDict.TryGetValue("Content-Type", out string? contentType))
                {
                    bodyContent.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
                }
            }

            request.Content = bodyContent;
        }

        return request;
    }

    private static void ApplyHeaders(HttpRequestMessage request, IDictionary<string, object> options)
    {
        if (!options.TryGetValue("headers", out object? headers))
        {
            return;
        }

        Dictionary<string, string> headersDict = ParseHeaders(headers);
        foreach ((string? key, string? value) in headersDict)
        {
            if (string.Equals(key, "Content-Type", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (string.Equals(key, "Referer", StringComparison.OrdinalIgnoreCase))
            {
                request.Headers.Referrer = new Uri(value);
            }
            else
            {
                request.Headers.TryAddWithoutValidation(key, value);
            }
        }
    }

    private static async Task<Tuple<int, string>> ReadResponseAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        string contentTypeResponse = response.Content.Headers.ContentType?.MediaType ?? string.Empty;

        if (contentTypeResponse.Contains("image/", StringComparison.Ordinal) || contentTypeResponse.Contains("application/octet-stream", StringComparison.Ordinal))
        {
            byte[] imageBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
            return new Tuple<int, string>(
                (int)response.StatusCode,
                $"data:image/png;base64,{Convert.ToBase64String(imageBytes)}"
            );
        }

        string responseBody = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return new Tuple<int, string>(
            (int)response.StatusCode,
            responseBody
        );
    }

    public async Task<string> ExecuteJsonAsync(string options, CancellationToken cancellationToken = default)
    {
        Dictionary<string, object>? data = JsonConvert.DeserializeObject<Dictionary<string, object>>(options);
        Tuple<int, string> result = await ExecuteAsync(data ?? [], cancellationToken).ConfigureAwait(false);
        return System.Text.Json.JsonSerializer.Serialize(new
        {
            status = result.Item1,
            message = result.Item2,
        });
    }

    public async Task<Tuple<int, string>> ExecuteAsync(IDictionary<string, object> options, CancellationToken cancellationToken = default)
    {
        try
        {
            string url = (string)options["url"];
            using HttpRequestMessage request = CreateRequest(url, options);
            ApplyHeaders(request, options);

            HttpClient httpClient = _httpClient ?? throw new InvalidOperationException("The HTTP client is not initialized.");
            using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);

            if (response.Headers.Contains("Set-Cookie"))
            {
                _cookieDirty = true;
            }

            return await ReadResponseAsync(response, cancellationToken).ConfigureAwait(false);
        }
        catch (HttpRequestException httpException)
        {
            if (httpException.InnerException != null)
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"{httpException.Message} | {httpException.InnerException}");
            }

            int statusCode = httpException.StatusCode.HasValue ? (int)httpException.StatusCode.Value : -1;

            return new Tuple<int, string>(
                statusCode,
                httpException.Message
            );
        }
        catch (Exception e) when (e is KeyNotFoundException or InvalidCastException or ArgumentException or FormatException or InvalidDataException or InvalidOperationException or OperationCanceledException or IOException or JsonException)
        {
            if (e.InnerException != null)
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"{e.Message} | {e.InnerException}");
            }

            return new Tuple<int, string>(
                -1,
                e.Message
            );
        }
    }

    private static Dictionary<string, string> ParseHeaders(object headers)
    {
        Dictionary<string, string> headersDict;
        if (headers.GetType() == typeof(JObject))
        {
            headersDict = ((JObject)headers).ToObject<Dictionary<string, string>>() ?? throw new JsonException("The headers could not be read.");
        }
        else
        {
            var headersKvp = (IEnumerable<KeyValuePair<string, object>>)headers;
            headersDict = [];
            foreach ((string? key, object? value) in headersKvp)
            {
                headersDict.Add(key, value?.ToString() ?? string.Empty);
            }
        }
        return headersDict;
    }

#if LINUX
    public void Dispose()
#else
    void IDisposable.Dispose()
#endif
    {
        _timer.Dispose();
        _httpClient?.Dispose();
        _httpHandler?.Dispose();
    }
}
