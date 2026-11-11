using System.Diagnostics;
using System.Security.Cryptography;
using NLog;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
static class Update
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly string VrcxSetupExecutable = Path.Join(Program.AppDataDirectory, "VRCX_Setup.exe");
    private static readonly string UpdateExecutable = Path.Join(Program.AppDataDirectory, "update.exe");
    private static readonly string TempDownload = Path.Join(Program.AppDataDirectory, "tempDownload");
    private static readonly HttpClientHandler ClientHandler = CreateHttpClientHandler();
    private static readonly HttpClient Client = CreateClient();
    private static readonly Lock DownloadLock = new();
    private static CancellationTokenSource? DownloadCancellation;
    private static string AppImagePath = string.Empty;
    private static string AppImagePathOld = string.Empty;

    public static int UpdateProgress { get; private set; }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient(ClientHandler);
        client.DefaultRequestHeaders.Add("User-Agent", Program.Version);
        return client;
    }

    private static HttpClientHandler CreateHttpClientHandler()
    {
        var httpClientHandler = new HttpClientHandler { CheckCertificateRevocationList = true };
        if (WebApi.ProxySet)
        {
            httpClientHandler.Proxy = WebApi.Proxy;
        }

        return httpClientHandler;
    }

    public static void Init(string appImagePath = "")
    {
        if (string.IsNullOrEmpty(appImagePath))
        {
            return;
        }

        AppImagePath = appImagePath;
        AppImagePathOld = appImagePath + ".old";
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"AppImagePath: {AppImagePath}");
    }

    public static void Check()
    {
        if (Process.GetProcessesByName("VRCX_Setup").Length > 0)
        {
            Environment.Exit(0);
        }

        if (File.Exists(TempDownload))
        {
            File.Delete(TempDownload);
        }

        if (File.Exists(VrcxSetupExecutable))
        {
            File.Delete(VrcxSetupExecutable);
        }

        if (File.Exists(UpdateExecutable))
        {
            InstallUpdate();
        }
    }

    private static void InstallUpdate()
    {
        string setupArguments = string.Empty;

        try
        {
            if (File.Exists(VrcxSetupExecutable))
            {
                File.Delete(VrcxSetupExecutable);
            }

            File.Move(UpdateExecutable, VrcxSetupExecutable);
            using var vrcxProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = VrcxSetupExecutable,
                    Arguments = setupArguments,
                    UseShellExecute = true,
                    WorkingDirectory = Program.AppDataDirectory,
                },
            };
            vrcxProcess.Start();
            Environment.Exit(0);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or InvalidOperationException or NotSupportedException or ArgumentException)
        {
            string message = $"Failed to install the update: {e.Message}";
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, message);
#if !LINUX
            MessageBox.Show(message, "Update failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
        }
    }

    public static async Task DownloadInstallRedistAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            string filePath = await DownloadFileAsync("https://aka.ms/vs/17/release/vc_redist.x64.exe", cancellationToken).ConfigureAwait(false);
            using var installRedist = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = filePath,
                    Arguments = "/install /quiet /norestart",
                },
            };
            installRedist.Start();
            await installRedist.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception e) when (e is HttpRequestException or InvalidDataException or IOException or UnauthorizedAccessException or OperationCanceledException or System.ComponentModel.Win32Exception or InvalidOperationException or NotSupportedException or ArgumentException)
        {
            string message = $"Failed to download and install the Visual C++ Redistributable: {e.Message}";
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, message);
#if !LINUX
            MessageBox.Show(message, "Update failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
        }
    }

    private static async Task<string> DownloadFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await Client.GetAsync(new Uri(fileUrl), cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Failed to download the file. Status code: {response.StatusCode}");
        }

        string fileName = GetFileNameFromContentDisposition(response);
        string tempPath = Path.Join(Path.GetTempPath(), "VRCX");
        Directory.CreateDirectory(tempPath);
        string filePath = Path.Join(tempPath, fileName);
        using FileStream fileStream = File.Create(filePath);
        await response.Content.CopyToAsync(fileStream, cancellationToken).ConfigureAwait(false);
        return filePath;
    }

    private static string GetFileNameFromContentDisposition(HttpResponseMessage response)
    {
        string? contentDisposition = response.Content.Headers.ContentDisposition?.ToString();
        if (contentDisposition != null)
        {
            int startIndex = contentDisposition.IndexOf("filename=", StringComparison.OrdinalIgnoreCase);
            if (startIndex >= 0)
            {
                startIndex += "filename=".Length;
                int endIndex = contentDisposition.IndexOf(';', startIndex);
                if (endIndex == -1)
                {
                    endIndex = contentDisposition.Length;
                }

                string fileName = contentDisposition[startIndex..endIndex].Trim(' ', '"');
                return fileName;
            }
        }

        throw new InvalidDataException("Unable to extract file name from content-disposition header.");
    }

    public static async Task DownloadUpdateAsync(string fileLink, string hashString, int downloadSize, CancellationToken cancellationToken = default)
    {
        using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        lock (DownloadLock)
        {
            DownloadCancellation = cancellation;
        }

        try
        {
            await DownloadToTempFileAsync(fileLink, cancellation.Token).ConfigureAwait(false);
            await VerifyDownloadAsync(hashString, downloadSize, cancellation.Token).ConfigureAwait(false);
            await ReplaceInstalledFileAsync(cancellation.Token).ConfigureAwait(false);
            UpdateProgress = 0;
        }
        finally
        {
            lock (DownloadLock)
            {
                if (DownloadCancellation == cancellation)
                {
                    DownloadCancellation = null;
                }
            }
        }
    }

    private static void RequestDownloadCancel()
    {
        lock (DownloadLock)
        {
            DownloadCancellation?.Cancel();
        }
    }

    private static async Task DownloadToTempFileAsync(string fileUrl, CancellationToken cancellationToken)
    {
        const int ChunkSize = 8192;

        if (File.Exists(TempDownload))
        {
            File.Delete(TempDownload);
        }

        using FileStream destination = File.OpenWrite(TempDownload);
        using HttpResponseMessage response = await Client.GetAsync(new Uri(fileUrl), HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        using Stream download = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        long? contentLength = response.Content.Headers.ContentLength;
        byte[] buffer = new byte[ChunkSize];
        long totalBytesRead = 0;

        while (true)
        {
            if (contentLength.HasValue)
            {
                double percentage = Math.Round((double)totalBytesRead / contentLength.Value * 100, 2);
                UpdateProgress = (int)percentage;
            }
            int bytesRead = await download.ReadAsync(buffer.AsMemory(0, ChunkSize), cancellationToken).ConfigureAwait(false);
            if (bytesRead == 0)
            {
                break;
            }

            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException("Download was cancelled.");
            }

            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken).ConfigureAwait(false);
            totalBytesRead += bytesRead;
        }
    }

    private static async Task VerifyDownloadAsync(string hashString, int downloadSize, CancellationToken cancellationToken)
    {
        var data = new FileInfo(TempDownload);
        if (data.Length != downloadSize)
        {
            File.Delete(TempDownload);
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Downloaded file size does not match expected size");
            throw new InvalidDataException("Downloaded file size does not match expected size");
        }

        if (string.IsNullOrEmpty(hashString))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Hash string is empty, skipping hash check");
            return;
        }

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Checking hash");
        using FileStream stream = File.OpenRead(TempDownload);
        byte[] fileHashBytes = await SHA256.HashDataAsync(stream, cancellationToken).ConfigureAwait(false);
        string fileHashString = Convert.ToHexString(fileHashBytes);
        if (!hashString.Equals(fileHashString, StringComparison.OrdinalIgnoreCase))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Hash check failed file:{fileHashString} web:{hashString}");
            throw new InvalidDataException("Hash check failed");
        }

        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Hash check passed");
    }

    private static async Task ReplaceInstalledFileAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(AppImagePath))
        {
            if (File.Exists(UpdateExecutable))
            {
                File.Delete(UpdateExecutable);
            }

            File.Move(TempDownload, UpdateExecutable);
            return;
        }

        if (File.Exists(AppImagePathOld))
        {
            File.Delete(AppImagePathOld);
        }

        File.Move(AppImagePath, AppImagePathOld);
        File.Move(TempDownload, AppImagePath);
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "chmod",
                Arguments = $"+x {AppImagePath}",
            },
        };
        process.Start();
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
    }

    public static async Task CancelUpdateAsync(CancellationToken cancellationToken = default)
    {
        RequestDownloadCancel();
        UpdateProgress = 0;
        await Task.Delay(100, cancellationToken).ConfigureAwait(false);
        try
        {
            if (File.Exists(TempDownload))
            {
                File.Delete(TempDownload);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Could not delete the cancelled download: {0}", ex);
        }
    }
}
