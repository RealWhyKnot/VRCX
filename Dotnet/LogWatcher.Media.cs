using System.Globalization;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed partial class LogWatcher
{
    private bool ParseLogVideoError(FileInfo fileInfo, LogContext logContext, string line, int offset)
    {

        if (line.Contains("[Video Playback] ERROR: ", StringComparison.Ordinal))
        {
            string data = line[(offset + 24)..];
            if (!logContext.VideoPlaybackErrors.Add(data))
            {
                return true;
            }

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "event",
                "VideoError: " + data,
            ]);

            return true;
        }

        if (line.Contains("[AVProVideo] Error: ", StringComparison.Ordinal))
        {
            string data = line[(offset + 20)..];
            if (!logContext.VideoPlaybackErrors.Add(data))
            {
                return true;
            }

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "event",
                "VideoError: " + data,
            ]);

            return true;
        }

        return false;
    }

    private bool ParseUntrustedUrl(FileInfo fileInfo, LogContext logContext, string line, int offset)
    {

        if (line.Contains("Attempted to play an untrusted URL", StringComparison.Ordinal))
        {
            string data = line[offset..];
            if (!logContext.VideoPlaybackErrors.Add(data))
            {
                return true;
            }

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "event",
                "VideoError: " + data,
            ]);

            return true;
        }

        return false;
    }

    private bool ParseLogWorldVRCX(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[VRCX] ", 0, 7, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        string data = line[(offset + 7)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "vrcx",
            data,
        ]);

        return true;
    }

    private bool ParseLogNowPlaying(FileInfo fileInfo, string line, int offset)
    {

        const string marker = "nowplaying {";
        int markerPos = line.IndexOf(marker, offset, StringComparison.Ordinal);
        if (markerPos < 0)
        {
            return false;
        }

        int jsonStart = markerPos + marker.Length - 1;
        int jsonEnd = line.LastIndexOf('}');
        if (jsonEnd < jsonStart)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "nowplaying",
            line.Substring(jsonStart, jsonEnd - jsonStart + 1),
        ]);

        return true;
    }

    private bool ParseLogWorldDataVRCX(string line, int offset)
    {

        if (string.Compare(line, offset, "[VRCX-World] ", 0, 13, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        string data = line[(offset + 13)..];

        Logger.Info(CultureInfo.InvariantCulture, "VRCX-World data: {0}", data);
        return true;
    }

    private bool ParseLogVideoChange(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Video Playback] Attempting to resolve URL '", 0, 44, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf('\'');
        if (pos < 0)
        {
            return false;
        }

        string data = line[(offset + 44)..];
        data = data[..^1];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "video-play",
            data,
        ]);

        return true;
    }

    private bool ParseLogAVProVideoChange(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Video Playback] Resolving URL '", 0, 32, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf('\'');
        if (pos < 0)
        {
            return false;
        }

        string data = line[(offset + 32)..];
        data = data[..^1];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "video-play",
            data,
        ]);

        return true;
    }

    private bool ParseLogSDK2VideoPlay(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "User ", 0, 5, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf(" added URL ", StringComparison.Ordinal);
        if (pos < 0)
        {
            return false;
        }

        string displayName = line[(offset + 5)..pos];
        string data = line[(pos + 11)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "video-play",
            data,
            displayName,
        ]);

        return true;
    }

    private bool ParseLogUsharpVideoPlay(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[USharpVideo] Started video load for URL: ", 0, 42, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf(", requested by ", StringComparison.Ordinal);
        if (pos < 0)
        {
            return false;
        }

        string data = line[(offset + 42)..pos];
        string displayName = line[(pos + 15)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "video-play",
            data,
            displayName,
        ]);

        return true;
    }

    private bool ParseLogUsharpVideoSync(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[USharpVideo] Syncing video to ", 0, 31, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        string data = line[(offset + 31)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "video-sync",
            data,
        ]);

        return true;
    }

    private bool ParseLogAvatarChange(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Behaviour] Switching ", 0, 22, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        int pos = line.LastIndexOf(" to avatar ", StringComparison.Ordinal);
        if (pos < 0)
        {
            return false;
        }

        string displayName = line[(offset + 22)..pos];
        string avatarName = line[(pos + 11)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "avatar-change",
            displayName,
            avatarName,
        ]);

        return true;
    }

    private bool ParseLogOnAudioConfigurationChanged(FileInfo fileInfo, LogContext logContext, string line)
    {

        if (line.Contains("[Always] uSpeak: OnAudioConfigurationChanged", StringComparison.Ordinal))
        {
            logContext.AudioDeviceChanged = true;
            return true;
        }

        if (line.Contains("[Always] uSpeak: SetInputDevice 0", StringComparison.Ordinal))
        {
            int lineOffset = line.LastIndexOf(") '", StringComparison.Ordinal);
            if (lineOffset < 0)
            {
                return true;
            }

            lineOffset += 3;
            int endPos = line.Length - 1;
            int length = Math.Min(endPos - lineOffset + 1, line.Length - lineOffset);
            if (length <= 0)
            {
                return true;
            }

            string audioDevice = line.Substring(lineOffset, length);
            if (string.IsNullOrEmpty(logContext.LastAudioDevice))
            {
                logContext.AudioDeviceChanged = false;
                logContext.LastAudioDevice = audioDevice;
                return true;
            }

            if (!logContext.AudioDeviceChanged || string.Equals(logContext.LastAudioDevice, audioDevice, StringComparison.Ordinal))
            {
                return true;
            }

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "event",
                $"Audio device changed, mic set to '{audioDevice}'",
            ]);

            logContext.LastAudioDevice = audioDevice;
            logContext.AudioDeviceChanged = false;

            return true;
        }

        return false;
    }

}
