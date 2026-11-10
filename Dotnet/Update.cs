using System.Diagnostics;
using System.Security.Cryptography;
using NLog;

#if !LINUX
#endif

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed class Update
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly string VrcxSetupExecutable = Path.Join(Program.AppDataDirectory, "VRCX_Setup.exe");
    private static readonly string UpdateExecutable = Path.Join(Program.AppDataDirectory, "update.exe");
    private static readonly string TempDownload = Path.Join(Program.AppDataDirectory, "tempDownload");
    private static readonly HttpClient Client;
    private static CancellationToken DownloadToken;
    public static int UpdateProgress;
    private static string AppImagePath = string.Empty;
    private static string AppImagePathOld = string.Empty;

    static Update()
    {
        var httpClientHandler = new HttpClientHandler { CheckCertificateRevocationList = true };
        if (WebApi.ProxySet)
        {
            httpClientHandler.Proxy = WebApi.Proxy;
        }

        Client = new HttpClient(httpClientHandler);
        Client.DefaultRequestHeaders.Add("User-Agent", Program.Version);
    }

    public void Init(string appImagePath = "")
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
            var vrcxProcess = new Process
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
        catch (Exception e)
        {
            string message = $"Failed to install the update: {e.Message}";
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, message);
#if !LINUX
            MessageBox.Show(message, "Update failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
#endif
        }
    }

    public static async Task DownloadInstallRedistAsync()
    {
        try
        {
            string filePath = await DownloadFileAsync("https://aka.ms/vs/17/release/vc_redist.x64.exe", DownloadToken);
            var installRedist = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = filePath,
                    Arguments = "/install /quiet /norestart",
                },
            };
            installRedist.Start();
            await installRedist.WaitForExitAsync(DownloadToken);
        }
        catch (Exception e)
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
        HttpResponseMessage response = await Client.GetAsync(fileUrl, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Failed to download the file. Status code: {response.StatusCode}");
        }

        string fileName = GetFileNameFromContentDisposition(response);
        string tempPath = Path.Join(Path.GetTempPath(), "VRCX");
        Directory.CreateDirectory(tempPath);
        string filePath = Path.Join(tempPath, fileName);
        await using FileStream fileStream = File.Create(filePath);
        await response.Content.CopyToAsync(fileStream, cancellationToken);
        return filePath;
    }

    private static string GetFileNameFromContentDisposition(HttpResponseMessage response)
    {
        string contentDisposition = response.Content.Headers.ContentDisposition?.ToString();
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

        throw new Exception("Unable to extract file name from content-disposition header.");
    }

    public static async Task DownloadUpdateAsync(string fileUrl, string hashString, int downloadSize)
    {
        DownloadToken = CancellationToken.None;
        const int chunkSize = 8192;

        if (File.Exists(TempDownload))
        {
            File.Delete(TempDownload);
        }

        await using FileStream destination = File.OpenWrite(TempDownload);
        using HttpResponseMessage response = await Client.GetAsync(fileUrl, HttpCompletionOption.ResponseHeadersRead, DownloadToken);
        await using Stream download = await response.Content.ReadAsStreamAsync(DownloadToken);
        long? contentLength = response.Content.Headers.ContentLength;
        byte[] buffer = new byte[chunkSize];
        long totalBytesRead = 0;

        while (true)
        {
            if (contentLength.HasValue)
            {
                double percentage = Math.Round((double)totalBytesRead / contentLength.Value * 100, 2);
                UpdateProgress = (int)percentage;
            }
            int bytesRead = await download.ReadAsync(buffer.AsMemory(0, chunkSize), DownloadToken);
            if (bytesRead == 0)
            {
                break;
            }

            if (DownloadToken.IsCancellationRequested)
            {
                throw new OperationCanceledException("Download was cancelled.");
            }

            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), DownloadToken);
            totalBytesRead += bytesRead;
        }

        destination.Close();

        var data = new FileInfo(TempDownload);
        if (data.Length != downloadSize)
        {
            File.Delete(TempDownload);
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Downloaded file size does not match expected size");
            throw new Exception("Downloaded file size does not match expected size");
        }

        if (string.IsNullOrEmpty(hashString))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Hash string is empty, skipping hash check");
        }
        else
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Checking hash");
            using (var sha256 = SHA256.Create())
            await using (FileStream stream = File.OpenRead(TempDownload))
            {
                byte[] fileHashBytes = await sha256.ComputeHashAsync(stream, DownloadToken);
                string fileHashString = Convert.ToHexString(fileHashBytes);
                if (!hashString.Equals(fileHashString, StringComparison.OrdinalIgnoreCase))
                {
                    Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Hash check failed file:{fileHashString} web:{hashString}");
                    throw new Exception("Hash check failed");

                }
            }

            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Hash check passed");
        }

        if (string.IsNullOrEmpty(AppImagePath))
        {

            if (File.Exists(UpdateExecutable))
            {
                File.Delete(UpdateExecutable);
            }

            File.Move(TempDownload, UpdateExecutable);
        }
        else
        {

            if (File.Exists(AppImagePathOld))
            {
                File.Delete(AppImagePathOld);
            }

            File.Move(AppImagePath, AppImagePathOld);
            File.Move(TempDownload, AppImagePath);
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "chmod",
                    Arguments = $"+x {AppImagePath}",
                },
            };
            process.Start();
            await process.WaitForExitAsync(DownloadToken);
        }

        UpdateProgress = 0;
        DownloadToken = CancellationToken.None;
    }

    public static async Task CancelUpdateAsync()
    {
        DownloadToken = new CancellationToken(canceled: true);
        UpdateProgress = 0;
        await Task.Delay(100, DownloadToken);
        try
        {
            if (File.Exists(TempDownload))
            {
                File.Delete(TempDownload);
            }
        }
        catch
        {

        }
    }

    public static Task DownloadUpdateAsync(Uri fileUrl, string hashString, int downloadSize) => DownloadUpdateAsync(fileUrl.AbsoluteUri, hashString, downloadSize);
}
