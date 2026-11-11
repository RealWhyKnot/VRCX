using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace VRCX;

public partial class AppApiElectron
{
    public static string? GetVRChatWinePath()
    {
        string? compatTool = GetSteamVdfCompatTool();
        if (compatTool == null)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatTool not found");
            return null;
        }

        string protonPath = Path.Join(SteamPath, "steamapps", "common", compatTool);
        string winePath;
        if (Directory.Exists(protonPath))
        {
            winePath = Path.Join(protonPath, "dist", "bin", "wine");
            if (!File.Exists(winePath))
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "Wine not found in Proton path");
                return null;
            }
        }
        else
        {
            winePath = FindCompatToolWinePath(compatTool);
        }

        if (string.IsNullOrEmpty(winePath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatTool and Proton not found");
            return null;
        }

        return winePath;
    }

    private static string FindCompatToolWinePath(string compatTool)
    {
        string winePath = "";
        var roots = new List<string>
        {
            "/usr/share/steam/compatibilitytools.d",
            "/usr/local/share/steam/compatibilitytools.d",
        };
        string? extraPaths = Environment.GetEnvironmentVariable("STEAM_EXTRA_COMPAT_TOOLS_PATHS");
        if (!string.IsNullOrEmpty(extraPaths))
        {
            roots.AddRange(extraPaths.Split(':', StringSplitOptions.RemoveEmptyEntries));
        }

        roots.Add(Path.Join(SteamPath, "compatibilitytools.d"));

        foreach (string root in roots)
        {
            var candidates = new List<string> { root, Path.Join(root, compatTool) };
            if (Directory.Exists(root))
            {
                candidates.AddRange(Directory.GetDirectories(root, $"*{compatTool}*"));
            }

            foreach (string candidate in candidates)
            {
                winePath = Path.Join(candidate, "files", "bin", "wine");
                if (File.Exists(winePath))
                {
                    break;
                }

                winePath = "";
            }
            if (!string.IsNullOrEmpty(winePath))
            {
                break;
            }
        }

        return winePath;
    }

    private static ProcessStartInfo GetWineProcessStartInfo(string winePrefix, string wineCommand)
    {
        var processStartInfo = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            Arguments = $"-c \"{wineCommand.Replace("\"", "\\\"", StringComparison.Ordinal)}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        processStartInfo.Environment["WINEFSYNC"] = "1";
        processStartInfo.Environment["WINEPREFIX"] = winePrefix;


        return processStartInfo;
    }

    private static string? GetWineRegCommand(string command)
    {
        string? winePath = GetVRChatWinePath();
        string winePrefix = VrcPrefixPath;
        if (string.IsNullOrEmpty(winePath) || string.IsNullOrEmpty(winePrefix))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRC Wine path was not found");
            return null;
        }

        string wineRegCommand = $"\"{winePath}\" reg {command}";
        ProcessStartInfo processStartInfo = GetWineProcessStartInfo(winePrefix, wineRegCommand);
        using Process process = Process.Start(processStartInfo) ?? throw new InvalidOperationException($"Could not start Wine for the registry command in {winePrefix}");
        string output = process.StandardOutput.ReadToEnd();
        string error = process.StandardError.ReadToEnd();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Wine reg command failed (exit {process.ExitCode}): {error}");
            return null;
        }

        return output;
    }

    private static string GetWineRegCommandEx(string regCommand)
    {
        string filePath = Path.Join(VrcPrefixPath, "user.reg");
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"Registry file not found at {filePath}");
        }

        Match match = MyRegex1().Match(regCommand);
        if (!match.Success)
        {
            throw new ArgumentException("Invalid command format.", nameof(regCommand));
        }

        string action = match.Groups["action"].Value;
        string? valueName = match.Groups["valueName"].Success ? match.Groups["valueName"].Value : null;
        string? valueType = match.Groups["valueType"].Success ? match.Groups["valueType"].Value : null;
        string? valueData = match.Groups["valueData"].Success ? match.Groups["valueData"].Value : null;

        List<string> lines = [.. File.ReadAllLines(filePath)];

        if (string.Equals(action, "add", StringComparison.Ordinal))
        {
            return AddWineRegistryValue(filePath, lines, regCommand, valueName, valueType, valueData);
        }

        if (string.Equals(action, "query", StringComparison.Ordinal))
        {
            return QueryWineRegistryValue(lines, valueName);
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Unsupported registry command: {regCommand}");

        return $"Command '{regCommand}' executed successfully.";
    }

    private static string AddWineRegistryValue(string filePath, List<string> lines, string regCommand, string? valueName, string? valueType, string? valueData)
    {
        var updatedLines = new List<string>();
        bool keyFound = false;
        bool valueFound = false;
        bool inVRChatSection = false;
        int headerEndIndex = -1;
        string keyHeader = "[Software\\\\VRChat\\\\VRChat]";

        for (int i = 0; i < lines.Count; i++)
        {
            string line = lines[i].Trim();

            if (line.StartsWith(keyHeader, StringComparison.Ordinal))
            {
                inVRChatSection = true;
                keyFound = true;
                headerEndIndex = i;

                while (i < lines.Count && (lines[i].StartsWith('#') || lines[i].StartsWith('@') || lines[i].Trim().StartsWith(keyHeader, StringComparison.Ordinal)))
                {
                    updatedLines.Add(lines[i]);
                    i++;
                }
                i--;
                continue;
            }

            if (inVRChatSection && line.StartsWith('['))
            {
                inVRChatSection = false;
            }

            if (inVRChatSection && valueName != null)
            {
                if (line.TrimStart().StartsWith($"\"{valueName}\"=", StringComparison.Ordinal))
                {
                    valueFound = true;
                    updatedLines.Add($"\"{valueName}\"={GetRegistryValueFormat(valueType, valueData)}");
                    continue;
                }
            }

            updatedLines.Add(lines[i]);
        }

        if (keyFound && !valueFound && valueName != null)
        {
            InsertWineRegistryValue(updatedLines, headerEndIndex, $"\"{valueName}\"={GetRegistryValueFormat(valueType, valueData)}");
        }

        File.WriteAllLines(filePath, updatedLines);
        return $"Command '{regCommand}' executed successfully.";
    }

    private static void InsertWineRegistryValue(List<string> updatedLines, int headerEndIndex, string valueLine)
    {
        int insertIndex = headerEndIndex + 2;
        while (insertIndex < updatedLines.Count &&
               (updatedLines[insertIndex].StartsWith('#') || updatedLines[insertIndex].StartsWith('@')))
        {
            insertIndex++;
        }
        updatedLines.Insert(insertIndex, valueLine);
    }

    private static string QueryWineRegistryValue(List<string> lines, string? valueName)
    {
        ArgumentNullException.ThrowIfNull(valueName);
        if (!valueName.Contains("_h", StringComparison.Ordinal))
        {
            valueName = AddHashToKeyName(valueName);
        }

        foreach (string line in lines)
        {
            if (line.Contains(valueName, StringComparison.Ordinal))
            {
                return line;
            }
        }

        return $"Value \"{valueName}\" not found.";
    }

    private static string GetRegistryValueFormat(string? valueType, string? valueData)
    {
        ArgumentNullException.ThrowIfNull(valueData);
        if (string.Equals(valueType?.ToUpperInvariant(), "REG_DWORD100", StringComparison.Ordinal))
        {
            double inputValue = double.Parse(valueData, System.Globalization.CultureInfo.InvariantCulture);
            Span<byte> dataBytes = stackalloc byte[sizeof(double)];
            BitConverter.TryWriteBytes(dataBytes, inputValue);
            string[] hexValues = [.. dataBytes.ToArray().Select(b => b.ToString("x2", System.Globalization.CultureInfo.InvariantCulture))];
            string byteString = string.Join(",", hexValues);
            string result = $"hex(4):{byteString}";
            return result;
        }

        return valueType?.ToUpperInvariant() switch
        {
            "REG_DWORD" => $"dword:{int.Parse(valueData, System.Globalization.CultureInfo.InvariantCulture):X8}",
            _ => throw new ArgumentException($"Unsupported registry value type: {valueType}", nameof(valueType)),
        };
    }

    [GeneratedRegex(@"^(?<action>add|query|delete)\s+""[^""]+""(?:\s+/v\s+""(?<valueName>[^""]+)"")?(?:\s+/t\s+(?<valueType>\w+))?(?:\s+/d\s+(?<valueData>[^\s]+))?.*$", RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex1();
}
