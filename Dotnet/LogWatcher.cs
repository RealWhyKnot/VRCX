using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NLog;

#if !LINUX
using CefSharp;
#endif

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed partial class LogWatcher
{
    public static readonly LogWatcher Instance = new();
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private Dictionary<string, LogContext> _logContextMap = [];
    private DirectoryInfo? _logDirectoryInfo;
    private List<string?[]> _logList = [];
    private ReaderWriterLockSlim _logListLock = new();
    private bool _firstRun = true;
    private bool _resetLog;
    private bool _threadActive;
    private Thread? _thread;
    private DateTime _tillDate;
    public bool VrcClosedGracefully { get; set; }
    private readonly ConcurrentQueue<string> _logQueue = new();
    private static readonly Regex CleanId = MyRegex();
    private static readonly Regex CleanLocation = MyRegex1();

    public void Init()
    {
        AppApi appApi = Program.AppApiInstance ?? throw new InvalidOperationException("Application API is not initialized.");
        string logPath = appApi.GetVRChatAppDataLocation();
        _logDirectoryInfo = new DirectoryInfo(logPath);
        _logContextMap = [];
        _logListLock.Dispose();
        _logListLock = new ReaderWriterLockSlim();
        _logList = [];
        _thread = new Thread(ThreadLoop)
        {
            IsBackground = true,
        };
        _thread.Start();
    }

    public void Exit()
    {
        _threadActive = false;
        Thread? thread = _thread;
        _thread = null;
        if (thread is not null)
        {
            thread.Interrupt();
            thread.Join();
        }
    }

    public void Reset()
    {
        _resetLog = true;
        _thread?.Interrupt();
    }

    public void SetDateTill(string date)
    {
        _tillDate = DateTime.Parse(date, CultureInfo.InvariantCulture, DateTimeStyles.None).ToUniversalTime();
        _threadActive = true;
        Logger.Info(CultureInfo.InvariantCulture, "SetDateTill: {0}", _tillDate.ToLocalTime());
    }

    private void ThreadLoop()
    {
        while (_thread != null)
        {
            if (_threadActive)
            {
                Update();
            }

            try
            {
                Thread.Sleep(1000);
            }
            catch (ThreadInterruptedException)
            {
                continue;
            }
        }
    }

    private void Update()
    {
        if (_logDirectoryInfo is not DirectoryInfo directory)
        {
            return;
        }
        if (_resetLog)
        {
            _firstRun = true;
            _resetLog = false;
            _logContextMap.Clear();
            _logListLock.EnterWriteLock();
            try
            {
                _logList.Clear();
            }
            finally
            {
                _logListLock.ExitWriteLock();
            }
        }

        var deletedNameSet = new HashSet<string>(_logContextMap.Keys, StringComparer.Ordinal);
        directory.Refresh();

        if ((directory.LinkTarget == null && directory.Exists) || Directory.Exists(directory.LinkTarget))
        {
            FileInfo[] fileInfos = directory.GetFiles("output_log_*.txt", SearchOption.TopDirectoryOnly);

            Array.Sort(fileInfos, (a, b) => a.CreationTimeUtc.CompareTo(b.CreationTimeUtc));

            foreach (FileInfo fileInfo in fileInfos)
            {
                fileInfo.Refresh();
                if (!fileInfo.Exists)
                {
                    continue;
                }

                if (DateTime.Compare(fileInfo.LastWriteTimeUtc, _tillDate) < 0)
                {
                    continue;
                }

                if (_logContextMap.TryGetValue(fileInfo.Name, out LogContext? logContext))
                {
                    deletedNameSet.Remove(fileInfo.Name);
                }
                else
                {
                    logContext = new LogContext();
                    _logContextMap.Add(fileInfo.Name, logContext);
                }

                if (logContext.Length == fileInfo.Length)
                {
                    continue;
                }

                logContext.Length = fileInfo.Length;
                ParseLog(fileInfo, logContext);
            }
        }

        foreach (string name in deletedNameSet)
        {
            _logContextMap.Remove(name);
        }

        _firstRun = false;
    }

    private void ParseLog(FileInfo fileInfo, LogContext logContext)
    {
        string? line = string.Empty;
        try
        {
            using var stream = new FileStream(fileInfo.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 65536, FileOptions.SequentialScan);
            stream.Position = logContext.Position;
            using var streamReader = new StreamReader(stream, Encoding.UTF8);
            while (true)
            {
                line = streamReader.ReadLine();
                if (line == null)
                {
                    logContext.Position = stream.Position;
                    break;
                }

                if (line.Length == 0)
                {
                    continue;
                }

                if (ParseLogUdonException(fileInfo, line))
                {
                    continue;
                }

                if (line.Length <= 36 ||
                    line[31] != '-')
                {
                    continue;
                }

                if (DateTime.TryParseExact(
                        line[..19],
                        "yyyy.MM.dd HH:mm:ss",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out DateTime lineDate
                    ))
                {
                    lineDate = lineDate.ToUniversalTime();

                    if (DateTime.Compare(lineDate, _tillDate) <= 0)
                    {

                        continue;
                    }

                    if (DateTime.UtcNow.AddMinutes(61) < lineDate)
                    {
                        Logger.Warn(CultureInfo.InvariantCulture, "Invalid log time, too new: {0}", line);
                        continue;
                    }
                }
                else
                {
                    Logger.Warn(CultureInfo.InvariantCulture, "Failed to parse log date: {0}", line);
                    continue;
                }

                int offset = 34;
                if (line[offset] == '[')
                {
                    if (ParseLogOnPlayerJoinedOrLeft(fileInfo, line) ||
                        ParseLogLocation(fileInfo, logContext, line) ||
                        ParseLogLocationDestination(fileInfo, logContext, line) ||
                        ParseLogPortalSpawn(fileInfo, line) ||
                        ParseLogNotification(fileInfo, line, offset) ||
                        ParseLogAPIRequest(fileInfo, line, offset) ||
                        ParseLogAvatarChange(fileInfo, line, offset) ||
                        ParseLogJoinBlocked(fileInfo, line) ||
                        ParseLogAvatarPedestalChange(fileInfo, line, offset) ||
                        ParseLogVideoError(fileInfo, logContext, line, offset) ||
                        ParseLogVideoChange(fileInfo, line, offset) ||
                        ParseLogAVProVideoChange(fileInfo, line, offset) ||
                        ParseLogUsharpVideoPlay(fileInfo, line, offset) ||
                        ParseLogUsharpVideoSync(fileInfo, line, offset) ||
                        ParseLogWorldVRCX(fileInfo, line, offset) ||
                        ParseLogWorldDataVRCX(line, offset) ||
                        ParseLogOnAudioConfigurationChanged(fileInfo, logContext, line) ||
                        ParseLogScreenshot(fileInfo, line) ||
                        ParseLogStringDownload(fileInfo, line) ||
                        ParseLogImageDownload(fileInfo, line) ||
                        ParseVoteKick(fileInfo, line, offset) ||
                        ParseFailedToJoin(fileInfo, line, offset) ||
                        ParseInstanceResetWarning(fileInfo, line) ||
                        ParseVoteKickInitiation(fileInfo, line) ||
                        ParseVoteKickSuccess(fileInfo, line) ||
                        ParseStickerSpawn(fileInfo, line))
                    {
                    }
                }
                else
                {
                    if (ParseLogNowPlaying(fileInfo, line, offset) ||
                        ParseLogShaderKeywordsLimit(fileInfo, logContext, line) ||
                        ParseLogSDK2VideoPlay(fileInfo, line, offset) ||
                        ParseApplicationQuit(fileInfo, line, offset) ||
                        ParseOpenVRInit(fileInfo, line, offset) ||
                        ParseDesktopMode(fileInfo, line, offset) ||
                        ParseOscFailedToStart(fileInfo, line, offset) ||
                        ParseUntrustedUrl(fileInfo, logContext, line, offset))
                    {
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Warn(ex, "Failed to parse log file: {0} {1} {2}", fileInfo.FullName, line, ex.Message);
        }
    }

    private void AppendLog(string?[] item)
    {
        _logListLock.EnterWriteLock();
        try
        {
            if (!_firstRun)
            {
                string logLine = JsonSerializer.Serialize(item);
#if LINUX
                _logQueue.Enqueue(logLine);
#else
                if (MainForm.Instance != null && MainForm.Instance.Browser != null)
                {
                    MainForm.Instance.Browser.ExecuteScriptAsync("window?.$bridge?.addGameLogEvent", logLine);
                }
#endif
            }

            _logList.Add(item);
        }
        finally
        {
            _logListLock.ExitWriteLock();
        }
    }

    public List<string> GetLogLines()
    {

        var logLines = new List<string>();
        while (_logQueue.TryDequeue(out string? logLine))
        {
            logLines.Add(logLine);
        }

        return logLines;
    }

    private string ConvertLogTimeToISO8601(string line)
    {

        if (DateTime.TryParseExact(
                line[..19],
                "yyyy.MM.dd HH:mm:ss",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out DateTime dt
            ))
        {
            dt = dt.ToUniversalTime();
        }
        else
        {
            dt = DateTime.UtcNow;
        }

        return dt.ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'", CultureInfo.InvariantCulture);
    }

    private bool ParseLogNotification(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[API] Received Notification: <", 0, 30, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf("> received at ", StringComparison.Ordinal);
        if (pos < 0)
        {
            return false;
        }

        string data = line[(offset + 30)..pos];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "notification",
            data,
        ]);

        return true;
    }

    private bool ParseLogAPIRequest(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[API] [", 0, 7, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf("] Sending Get request to ", StringComparison.Ordinal);
        if (pos < 0)
        {
            return false;
        }

        string data = line[(pos + 25)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "api-request",
            data,
        ]);

        return true;
    }

    private bool ParseLogUdonException(FileInfo fileInfo, string line)
    {

        int lineOffset = line.IndexOf(" ---> VRC.Udon.VM.UdonVMException: ", StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return false;
        }

        string data = line[lineOffset..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "udon-exception",
            data,
        ]);

        return true;
    }

    public string?[][] Get()
    {
        Update();

        if (!_resetLog &&
            _logList.Count > 0)
        {
            _logListLock.EnterWriteLock();
            try
            {
                string?[][] items;

                if (_logList.Count > 1000)
                {
                    items = new string?[1000][];
                    _logList.CopyTo(0, items, 0, 1000);
                    _logList.RemoveRange(0, 1000);
                }
                else
                {
                    items = [.. _logList];
                    _logList.Clear();
                }

                return items;
            }
            finally
            {
                _logListLock.ExitWriteLock();
            }
        }

        return [];
    }

    private static (string DisplayName, string UserId) ParseUserInfo(string userInfo)
    {
        string userDisplayName;
        string userId;

        int pos = userInfo.LastIndexOf(" (", StringComparison.Ordinal);
        if (pos >= 0)
        {
            userDisplayName = userInfo[..pos];
            userId = userInfo[(pos + 2)..userInfo.LastIndexOf(')')];
            userId = CleanId.Replace(userId, string.Empty);
        }
        else
        {
            userDisplayName = userInfo;
            userId = string.Empty;
        }

        return (userDisplayName, userId);
    }

    private sealed class LogContext
    {
        public bool AudioDeviceChanged;
        public string? LastAudioDevice;
        public readonly HashSet<string> VideoPlaybackErrors = new(50, StringComparer.Ordinal);
        public long Length;
        public string? LocationDestination;
        public long Position;
        public string? RecentWorldName;
        public bool ShaderKeywordsLimitReached;
    }

    [GeneratedRegex("[^a-zA-Z0-9_\\-~:()]", RegexOptions.ExplicitCapture, 1000)]
    private static partial Regex MyRegex();
    [GeneratedRegex("[/]", RegexOptions.ExplicitCapture, 1000)]
    private static partial Regex MyRegex1();
}
