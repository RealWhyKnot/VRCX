using VRCX.Imaging;
using System.Collections;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NLog;
using Cookie = System.Net.Cookie;
using Timer = System.Threading.Timer;

#if !LINUX
using CefSharp;
#endif

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class WebApi
{
#if LINUX
    public Func<string, Task<string>> ExecuteJson => ExecuteJsonAsync;

    public Func<IDictionary<string, object>, Task<Tuple<int, string>>> Execute => ExecuteAsync;
#endif

    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    public static WebApi Instance;

    public static bool ProxySet;
    public static string ProxyUrl = "";
    public static IWebProxy Proxy = WebRequest.DefaultWebProxy;

    public CookieContainer CookieContainer;
    private bool _cookieDirty;
    private readonly Timer _timer;

    private HttpClient _httpClient;
    private SocketsHttpHandler _httpHandler;

    static WebApi()
    {
        Instance = new WebApi();
    }


    public WebApi()
    {
#if LINUX
        Instance ??= this;
#endif
        CookieContainer = new CookieContainer();
        _timer = new Timer(TimerCallback, state: null, -1, -1);
    }

    private void TimerCallback(object state)
    {
        try
        {
            SaveCookies();
        }
        catch (Exception e)
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

    private void SetProxy()
    {
        if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.ProxyUrl))
        {
            ProxyUrl = StartupArgs.LaunchArguments.ProxyUrl;
        }

        if (string.IsNullOrEmpty(ProxyUrl))
        {
            string proxyUrl = VRCXStorage.Instance.Get("VRCX_ProxyServer");
            if (!string.IsNullOrEmpty(proxyUrl))
            {
                ProxyUrl = proxyUrl;
            }
        }

        if (string.IsNullOrEmpty(ProxyUrl))
        {
            return;
        }

        try
        {
            ProxySet = true;
            Proxy = new WebProxy(ProxyUrl);
        }
        catch (UriFormatException)
        {
            VRCXStorage.Instance.Set("VRCX_ProxyServer", string.Empty);
            VRCXStorage.Instance.Save();
            const string message =
                "The proxy server URI you used is invalid.\nVRCX will close, please correct the proxy URI.";
#if !LINUX
            MessageBox.Show(message, "Invalid Proxy URI", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, message);
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
        SQLite.Instance.ExecuteNonQuery(
            "CREATE TABLE IF NOT EXISTS `cookies` (`key` TEXT PRIMARY KEY, `value` TEXT)");
        object[][] values = SQLite.Instance.Execute("SELECT `value` FROM `cookies` WHERE `key` = @key",
            new Dictionary<string, object>(StringComparer.Ordinal)
            {
                { "@key", "default" },
            }
        );
        try
        {
            object[] item = values[0];
            using var stream = new MemoryStream(Convert.FromBase64String((string)item[0]));
            CookieContainer = new CookieContainer();
            CookieContainer.Add(System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream));
            InitializeHttpClient();
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to load cookies: {e.Message}");
        }
    }

    private List<Cookie> GetAllCookies()
    {
        var cookieTable = (Hashtable)CookieContainer.GetType().InvokeMember("m_domainTable",
            BindingFlags.NonPublic |
            BindingFlags.GetField |
            BindingFlags.Instance,
binder: null,
            CookieContainer,
            [], culture: System.Globalization.CultureInfo.InvariantCulture);

        var uniqueCookies = new Dictionary<string, Cookie>(StringComparer.Ordinal);
        foreach (object? item in cookieTable.Keys)
        {
            string domain = (string)item;
            if (string.IsNullOrEmpty(domain))
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
            SQLite.Instance.ExecuteNonQuery(
                "INSERT OR REPLACE INTO `cookies` (`key`, `value`) VALUES (@key, @value)",
                new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    { "@key", "default" },
                    { "@value", Convert.ToBase64String(memoryStream.ToArray()) },
                }
            );

            _cookieDirty = false;
        }
        catch (Exception e)
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
            CookieCollection? data = System.Text.Json.JsonSerializer.Deserialize<CookieCollection>(stream);
            CookieContainer.Add(data);
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to set cookies: {e.Message}");
        }

        _cookieDirty = true;
    }

    private Task<HttpRequestMessage> BuildLegacyImageUploadRequestAsync(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
        var content = new MultipartFormDataContent(boundary);

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            content.Add(new StringContent((string)postDataObject), "data");
        }

        string? imageData = options["imageData"] as string;
        byte[] fileToUpload = Program.AppApiInstance.ResizeImageToFitLimits(Convert.FromBase64String(imageData), matchingDimensions: false);
        var imageContent = new ByteArrayContent(fileToUpload);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(imageContent, "image", "image.png");

        request.Content = content;
        return Task.FromResult(request);
    }

    private Task<HttpRequestMessage> BuildUploadFilePutRequestAsync(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        string? fileData = options["fileData"] as string;
        byte[] sentData = Convert.FromBase64CharArray(fileData.ToCharArray(), 0, fileData.Length);
        var content = new ByteArrayContent(sentData);
        content.Headers.ContentType = new MediaTypeHeaderValue(options["fileMIME"] as string);
        if (options.TryGetValue("fileMD5", out object? fileMd5))
        {
            content.Headers.ContentMD5 = Convert.FromBase64String(fileMd5 as string);
        }

        request.Content = content;
        return Task.FromResult(request);
    }

    private Task<HttpRequestMessage> BuildImageUploadRequestAsync(string url, IDictionary<string, object> options)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
        var content = new MultipartFormDataContent(boundary);

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            var jsonPostData = (JObject)JsonConvert.DeserializeObject((string)postDataObject);
            if (jsonPostData != null)
            {
                foreach (KeyValuePair<string, JToken?> data in jsonPostData)
                {
                    content.Add(new StringContent(data.Value?.ToString() ?? string.Empty), data.Key);
                }
            }
        }

        string? imageData = options["imageData"] as string;
        bool matchingDimensions = options["matchingDimensions"] as bool? ?? false;
        byte[] fileToUpload = Program.AppApiInstance.ResizeImageToFitLimits(Convert.FromBase64String(imageData), matchingDimensions);

        var imageContent = new ByteArrayContent(fileToUpload);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(imageContent, "file", "blob");

        request.Content = content;
        return Task.FromResult(request);
    }

    private Task<HttpRequestMessage> BuildPrintImageUploadRequestAsync(string url, IDictionary<string, object> options)
    {
        if (options.TryGetValue("cropWhiteBorder", out object? cropWhiteBorder) && (bool)cropWhiteBorder)
        {
            string? oldImageData = options["imageData"] as string;
            using var print = ImageRaster.Load(Convert.FromBase64String(oldImageData));
            if (Program.AppApiInstance.CropPrint(print))
            {
                options["imageData"] = Convert.ToBase64String(print.EncodePng());
            }
        }

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        string boundary = "---------------------------" + DateTime.Now.Ticks.ToString("x");
        var content = new MultipartFormDataContent(boundary);

        string? imageData = options["imageData"] as string;
        byte[] fileToUpload = Program.AppApiInstance.ResizePrintImage(Convert.FromBase64String(imageData));

        var imageContent = new ByteArrayContent(fileToUpload);
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        imageContent.Headers.ContentLength = fileToUpload.Length;
        content.Add(imageContent, "image", "image");

        if (options.TryGetValue("postData", out object? postDataObject))
        {
            Dictionary<string, string>? jsonPostData = JsonConvert.DeserializeObject<Dictionary<string, string>>(postDataObject.ToString());
            if (jsonPostData != null)
            {
                foreach ((string? key, string? value) in jsonPostData)
                {
                    var stringContent = new StringContent(value, Encoding.UTF8, "text/plain");
                    content.Add(stringContent, key);
                }
            }
        }

        request.Content = content;
        return Task.FromResult(request);
    }

    public async Task<string> ExecuteJsonAsync(string options)
    {
        Dictionary<string, object>? data = JsonConvert.DeserializeObject<Dictionary<string, object>>(options);
        Tuple<int, string> result = await ExecuteAsync(data);
        return System.Text.Json.JsonSerializer.Serialize(new
        {
            status = result.Item1,
            message = result.Item2,
        });
    }

    public async Task<Tuple<int, string>> ExecuteAsync(IDictionary<string, object> options)
    {
        try
        {
            string url = (string)options["url"];
            HttpRequestMessage request;


            if (options.TryGetValue("uploadImageLegacy", out _))
            {
                request = await BuildLegacyImageUploadRequestAsync(url, options);
            }
            else if (options.TryGetValue("uploadFilePUT", out _))
            {
                request = await BuildUploadFilePutRequestAsync(url, options);
            }
            else if (options.TryGetValue("uploadImage", out _))
            {
                request = await BuildImageUploadRequestAsync(url, options);
            }
            else if (options.TryGetValue("uploadImagePrint", out _))
            {
                request = await BuildPrintImageUploadRequestAsync(url, options);
            }
            else
            {

                HttpMethod httpMethod = HttpMethod.Get;
                if (options.TryGetValue("method", out object? methodObj))
                {
                    httpMethod = HttpMethod.Parse(methodObj.ToString());
                }

                request = new HttpRequestMessage(httpMethod, url);


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
            }


            if (options.TryGetValue("headers", out object? headers))
            {
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

            using HttpResponseMessage response = await _httpClient.SendAsync(request);


            if (response.Headers.Contains("Set-Cookie"))
            {
                _cookieDirty = true;
            }

            string contentTypeResponse = response.Content.Headers.ContentType?.MediaType ?? string.Empty;

            if (contentTypeResponse.Contains("image/") || contentTypeResponse.Contains("application/octet-stream"))
            {

                byte[] imageBytes = await response.Content.ReadAsByteArrayAsync();
                return new Tuple<int, string>(
                    (int)response.StatusCode,
                    $"data:image/png;base64,{Convert.ToBase64String(imageBytes)}"
                );
            }

            string responseBody = await response.Content.ReadAsStringAsync();
            return new Tuple<int, string>(
                (int)response.StatusCode,
                responseBody
            );
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
        catch (Exception e)
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
            headersDict = ((JObject)headers).ToObject<Dictionary<string, string>>();
        }
        else
        {
            var headersKvp = (IEnumerable<KeyValuePair<string, object>>)headers;
            headersDict = [];
            foreach ((string? key, object? value) in headersKvp)
            {
                headersDict.Add(key, value.ToString());
            }
        }
        return headersDict;
    }
}
