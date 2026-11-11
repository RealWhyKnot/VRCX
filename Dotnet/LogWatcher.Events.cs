using System.Globalization;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
sealed partial class LogWatcher
{
    private bool ParseLogLocation(FileInfo fileInfo, LogContext logContext, string line)
    {

        if (line.Contains("[Behaviour] Entering Room: ", StringComparison.Ordinal))
        {
            int lineOffset = line.LastIndexOf("] Entering Room: ", StringComparison.Ordinal);
            if (lineOffset < 0)
            {
                return true;
            }

            lineOffset += 17;
            if (lineOffset > line.Length)
            {
                return true;
            }

            string worldName = line[lineOffset..];
            logContext.RecentWorldName = worldName;
            return true;
        }

        if (line.Contains("[Behaviour] Joining ", StringComparison.Ordinal) && !line.Contains("] Joining or Creating Room: ", StringComparison.Ordinal) && !line.Contains("] Joining friend: ", StringComparison.Ordinal))
        {
            int lineOffset = line.LastIndexOf("] Joining ", StringComparison.Ordinal);
            if (lineOffset < 0)
            {
                return true;
            }

            lineOffset += 10;
            if (lineOffset >= line.Length)
            {
                return true;
            }

            string location = line[lineOffset..];
            location = CleanLocation.Replace(location, string.Empty);

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "location",
                location,
                logContext.RecentWorldName,
            ]);

            logContext.LastAudioDevice = string.Empty;
            logContext.VideoPlaybackErrors.Clear();
            VrcClosedGracefully = false;

            return true;
        }

        return false;
    }

    private bool ParseLogScreenshot(FileInfo fileInfo, string line)
    {

        if (!line.Contains("[VRC Camera] Took screenshot to: ", StringComparison.Ordinal))
        {
            return false;
        }

        int lineOffset = line.LastIndexOf("] Took screenshot to: ", StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return true;
        }

        string screenshotPath = line[(lineOffset + 22)..];
        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "screenshot",
            screenshotPath,
        ]);
        return true;
    }

    private bool ParseLogLocationDestination(FileInfo fileInfo, LogContext logContext, string line)
    {

        if (line.Contains("[Behaviour] OnLeftRoom", StringComparison.Ordinal))
        {
            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "location-destination",
                logContext.LocationDestination,
            ]);

            logContext.LocationDestination = string.Empty;

            return true;
        }

        if (line.Contains("[Behaviour] Destination fetching: ", StringComparison.Ordinal))
        {
            int lineOffset = line.LastIndexOf("] Destination fetching: ", StringComparison.Ordinal);
            if (lineOffset < 0)
            {
                return true;
            }

            lineOffset += 24;
            if (lineOffset >= line.Length)
            {
                return true;
            }

            string locationDestination = line[lineOffset..];
            logContext.LocationDestination = CleanLocation.Replace(locationDestination, string.Empty);

            return true;
        }

        return false;
    }

    private bool ParseLogOnPlayerJoinedOrLeft(FileInfo fileInfo, string line)
    {
        if (line.Contains("[Behaviour] OnPlayerJoined", StringComparison.Ordinal) && !line.Contains("] OnPlayerJoined:", StringComparison.Ordinal))
        {
            ParseLogPlayerJoined(fileInfo, line);
            return true;
        }

        if (line.Contains("[Behaviour] OnPlayerLeft", StringComparison.Ordinal) && !line.Contains("] OnPlayerLeftRoom", StringComparison.Ordinal) && !line.Contains("] OnPlayerLeft:", StringComparison.Ordinal))
        {
            ParseLogPlayerLeft(fileInfo, line);
            return true;
        }

        return false;
    }

    private void ParseLogPlayerJoined(FileInfo fileInfo, string line)
    {
        int lineOffset = line.LastIndexOf("] OnPlayerJoined", StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return;
        }

        lineOffset += 17;
        if (lineOffset > line.Length)
        {
            return;
        }

        (string? displayName, string? userId) = ParseUserInfo(line[lineOffset..]);
        if (string.IsNullOrEmpty(displayName) && string.IsNullOrEmpty(userId))
        {
            Logger.Warn(CultureInfo.InvariantCulture, "Failed to parse user info from log line: {0}", line);
            return;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "player-joined",
            displayName,
            userId,
        ]);
    }

    private void ParseLogPlayerLeft(FileInfo fileInfo, string line)
    {
        int lineOffset = line.LastIndexOf("] OnPlayerLeft", StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return;
        }

        lineOffset += 15;
        if (lineOffset > line.Length)
        {
            return;
        }

        (string? displayName, string? userId) = ParseUserInfo(line[lineOffset..]);
        if (string.IsNullOrEmpty(displayName) && string.IsNullOrEmpty(userId))
        {
            Logger.Warn(CultureInfo.InvariantCulture, "Failed to parse user info from log line: {0}", line);
            return;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "player-left",
            displayName ?? string.Empty,
            userId ?? string.Empty,
        ]);
    }

    private bool ParseLogPortalSpawn(FileInfo fileInfo, string line)
    {

        if (line.Contains("[Behaviour] Instantiated a (Clone [", StringComparison.Ordinal) && line.Contains("] Portals/PortalInternalDynamic)", StringComparison.Ordinal))
        {
            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "portal-spawn",
            ]);
            return true;
        }

        return false;
    }

    private bool ParseLogShaderKeywordsLimit(FileInfo fileInfo, LogContext logContext, string line)
    {

        if (line.Contains("Maximum number (384) of shader global keywords exceeded", StringComparison.Ordinal))
        {
            if (logContext.ShaderKeywordsLimitReached)
            {
                return true;
            }

            AppendLog(
            [
                fileInfo.Name,
                ConvertLogTimeToISO8601(line),
                "event",
                "Shader Keyword Limit has been reached",
            ]);
            logContext.ShaderKeywordsLimitReached = true;

            return true;
        }

        return false;
    }

    private bool ParseLogJoinBlocked(FileInfo fileInfo, string line)
    {

        if (!line.Contains("] Master is not sending any events! Moving to a new instance.", StringComparison.Ordinal))
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            "Joining instance blocked by master",
        ]);

        return true;
    }

    private bool ParseLogAvatarPedestalChange(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Network Processing] RPC invoked SwitchAvatar on AvatarPedestal for ", 0, 68, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        string data = line[(offset + 68)..];

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            $"{data} changed avatar pedestal",
        ]);

        return true;
    }

    private bool ParseApplicationQuit(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "VRCApplication: OnApplicationQuit at ", 0, 37, StringComparison.Ordinal) != 0 &&
            string.Compare(line, offset, "VRCApplication: HandleApplicationQuit at ", 0, 41, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "vrc-quit",
        ]);

        VrcClosedGracefully = true;

        return true;
    }

    private bool ParseOpenVRInit(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "Initializing VRSDK.", 0, 19, StringComparison.Ordinal) != 0 &&
            string.Compare(line, offset, "STEAMVR HMD Model: ", 0, 20, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "openvr-init",
        ]);

        return true;
    }

    private bool ParseDesktopMode(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "VR Disabled", 0, 11, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "desktop-mode",
        ]);

        return true;
    }

    private bool ParseLogStringDownload(FileInfo fileInfo, string line)
    {

        string check = "] Attempting to load String from URL '";
        if (!line.Contains(check, StringComparison.Ordinal))
        {
            return false;
        }

        int lineOffset = line.LastIndexOf(check, StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return true;
        }

        string stringData = line[(lineOffset + check.Length)..];
        stringData = stringData[..^1];

        if (stringData.StartsWith("http://127.0.0.1:22500", StringComparison.Ordinal) || stringData.StartsWith("http://localhost:22500", StringComparison.Ordinal))
        {
            return true;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "resource-load-string",
            stringData,
        ]);
        return true;
    }

    private bool ParseLogImageDownload(FileInfo fileInfo, string line)
    {

        string check = "] Attempting to load image from URL '";
        if (!line.Contains(check, StringComparison.Ordinal))
        {
            return false;
        }

        int lineOffset = line.LastIndexOf(check, StringComparison.Ordinal);
        if (lineOffset < 0)
        {
            return true;
        }

        string imageData = line[(lineOffset + check.Length)..];
        imageData = imageData[..^1];

        if (imageData.StartsWith("http://127.0.0.1:22500", StringComparison.Ordinal) || imageData.StartsWith("http://localhost:22500", StringComparison.Ordinal))
        {
            return true;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "resource-load-image",
            imageData,
        ]);
        return true;
    }

    private bool ParseVoteKick(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Behaviour] Received executive message: ", 0, 40, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            line[(offset + 40)..],
        ]);
        return true;
    }

    private bool ParseFailedToJoin(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "[Behaviour] Failed to join instance ", 0, 36, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            line[(offset + 12)..],
        ]);
        return true;
    }

    private bool ParseOscFailedToStart(FileInfo fileInfo, string line, int offset)
    {

        if (string.Compare(line, offset, "Could not Start OSC: ", 0, 21, StringComparison.Ordinal) != 0)
        {
            return false;
        }

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            $"VRChat couldn't start OSC server, \"{line[offset..]}\"",
        ]);
        return true;
    }

    private bool ParseInstanceResetWarning(FileInfo fileInfo, string line)
    {

        if (!line.Contains("[ModerationManager] This instance will be reset in ", StringComparison.Ordinal))
        {
            return false;
        }

        int index = line.IndexOf("[ModerationManager] This instance will be reset in ", StringComparison.Ordinal) + 20;

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            line[index..],
        ]);

        return true;
    }

    private bool ParseVoteKickInitiation(FileInfo fileInfo, string line)
    {

        if (!line.Contains("[ModerationManager] A vote kick has been initiated against ", StringComparison.Ordinal))
        {
            return false;
        }

        int index = line.IndexOf("[ModerationManager] A vote kick has been initiated against ", StringComparison.Ordinal) + 20;

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            line[index..],
        ]);

        return true;
    }

    private bool ParseVoteKickSuccess(FileInfo fileInfo, string line)
    {

        if (!line.Contains("[ModerationManager] Vote to kick ", StringComparison.Ordinal))
        {
            return false;
        }

        int index = line.IndexOf("[ModerationManager] Vote to kick ", StringComparison.Ordinal) + 20;

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "event",
            line[index..],
        ]);

        return true;
    }

    private bool ParseStickerSpawn(FileInfo fileInfo, string line)
    {

        int index = line.IndexOf("[StickersManager] User ", StringComparison.Ordinal);
        if (index == -1 || !line.Contains("inv_", StringComparison.Ordinal) || !line.Contains("spawned sticker", StringComparison.Ordinal))
        {
            return false;
        }

        string info = line[(index + 23)..];

        (string? userId, string? displayName) = ParseUserInfo(info);
        if (string.IsNullOrEmpty(displayName) && string.IsNullOrEmpty(userId))
        {
            Logger.Warn(CultureInfo.InvariantCulture, "Failed to parse user info from log line: {0}", line);
            return true;
        }

        int inventoryIdIndex = info.IndexOf("inv_", StringComparison.Ordinal);
        string inventoryId = info[inventoryIdIndex..];
        inventoryId = CleanId.Replace(inventoryId, string.Empty);

        AppendLog(
        [
            fileInfo.Name,
            ConvertLogTimeToISO8601(line),
            "sticker-spawn",
            userId,
            displayName,
            inventoryId,
        ]);

        return true;
    }

}
