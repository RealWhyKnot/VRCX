using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VRCX;

public partial class AppApiElectron
{
    private const int NoneValueKind = -1;
    private const int UnknownValueKind = 0;
    private const int StringValueKind = 1;
    private const int ExpandStringValueKind = 2;
    private const int BinaryValueKind = 3;
    private const int DWordValueKind = 4;
    private const int MultiStringValueKind = 7;
    private const int QWordValueKind = 11;

    private static string AddHashToKeyName(string key)
    {
        uint hash = 5381;
        foreach (char c in key)
        {
            hash = (hash * 33) ^ c;
        }

        return key + "_h" + hash;
    }

    private static int FindMatchingBracket(string content, int openBracketIndex)
    {
        int depth = 0;
        for (int i = openBracketIndex; i < content.Length; i++)
        {
            if (content[i] == '{')
            {
                depth++;
            }
            else if (content[i] == '}')
            {
                depth--;
                if (depth == 0)
                {
                    return i;
                }
            }
        }
        return -1;
    }

    private static Dictionary<string, string> ExtractCompatToolMapping(string vdfContent)
    {
        var compatToolMapping = new Dictionary<string, string>(StringComparer.Ordinal);
        const string SectionHeader = "\"CompatToolMapping\"";
        int sectionStart = vdfContent.IndexOf(SectionHeader, StringComparison.Ordinal);

        if (sectionStart == -1)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatToolMapping not found");
            return compatToolMapping;
        }

        int blockStart = vdfContent.IndexOf('{', sectionStart) + 1;
        int blockEnd = FindMatchingBracket(vdfContent, blockStart - 1);

        if (blockStart == -1 || blockEnd == -1)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatToolMapping block not found");
            return compatToolMapping;
        }

        string blockContent = vdfContent[blockStart..blockEnd];

        Regex keyValuePattern = MyRegex();

        MatchCollection matches = keyValuePattern.Matches(blockContent);
        foreach (Match match in matches)
        {
            string key = match.Groups[1].Value;
            string name = match.Groups[2].Value;

            if (!string.Equals(key, "0", StringComparison.Ordinal))
            {
                compatToolMapping[key] = name;
            }
        }

        return compatToolMapping;
    }

    private static string? GetSteamVdfCompatTool()
    {
        string steamPath = SteamPath;
        string configVdfPath = Path.Join(steamPath, "config", "config.vdf");
        if (!File.Exists(configVdfPath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "config.vdf not found");
            return null;
        }

        string vdfContent = File.ReadAllText(configVdfPath);
        Dictionary<string, string> compatToolMapping = ExtractCompatToolMapping(vdfContent);

        return compatToolMapping.TryGetValue("438100", out string? name) ? name : null;
    }

    private static string? ParseWineRegOutput(string output, string keyName)
    {
        if (string.IsNullOrEmpty(output))
        {
            return null;
        }

        string[] lines = [.. output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Where(line =>
                !string.IsNullOrWhiteSpace(line) &&
                !line.Contains("fixme:", StringComparison.Ordinal) &&
                !line.Contains("wine:", StringComparison.Ordinal))];

        foreach (string? line in lines)
        {
            string[] parts = [.. line.Split(['\t', ' '], StringSplitOptions.RemoveEmptyEntries).Select(p => p.Trim())];
            if (parts.Length >= 3 && parts[0].Contains(keyName, StringComparison.Ordinal))
            {
                string valueType = parts[^2];
                string value = parts[^1];

                switch (valueType)
                {
                    case "REG_BINARY":
                        if (!TryParseHexBytes(SplitHexPairs(value), out byte[] hexValues))
                        {
                            LogRegistryParseError("REG_BINARY as plain hex string", InvalidHexMessage);
                            return null;
                        }

                        return Encoding.ASCII.GetString(hexValues).TrimEnd('\0');

                    case "REG_DWORD":
                        return "REG_DWORD";

                    default:
                        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Unsupported parsed registry value type: {valueType}");
                        return null;
                }
            }
        }

        return null;
    }

    private static string? ParseWineRegOutputEx(string output, string keyName)
    {
        string[] lines = output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (line.Contains('=', StringComparison.Ordinal))
            {
                string[] parts = line.Split(['='], 2);
                string currentKey = parts[0].Trim();
                string currentValue = parts[1].Trim();

                string escapedString = @$"{currentValue}";
                escapedString = escapedString.Replace("\\", "", StringComparison.Ordinal);
                currentValue = escapedString;

                if (currentKey.Contains(keyName, StringComparison.Ordinal))
                {
                    if (currentValue.EndsWith(",\\", StringComparison.Ordinal))
                    {
                        var multiLineValue = new StringBuilder(currentValue.TrimEnd('\\'));
                        while (currentValue.EndsWith(",\\", StringComparison.Ordinal))
                        {
                            currentValue = lines[++i].Trim();
                            multiLineValue.Append(currentValue.TrimEnd('\\'));
                        }
                        currentValue = multiLineValue.ToString();
                    }

                    if (!currentValue.StartsWith("dword:", StringComparison.Ordinal))
                    {
                        return currentValue.StartsWith("hex:", StringComparison.Ordinal) ? DecodeWineHexValue(currentValue) : currentValue;
                    }

                    if (!int.TryParse(currentValue[6..], System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture, out int dword))
                    {
                        LogRegistryParseError("REG_DWORD", InvalidHexMessage);
                        return null;
                    }

                    return dword.ToString(System.Globalization.CultureInfo.InvariantCulture);
                }
            }
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Key not found: {keyName}");

        return null;
    }

    private const string InvalidHexMessage = "Input is not a valid hexadecimal value.";

    private static IEnumerable<string> SplitHexPairs(string value) =>
        Enumerable.Range(0, value.Length / 2).Select(i => value.Substring(i * 2, 2));

    private static bool TryParseHexBytes(IEnumerable<string> hexValues, out byte[] bytes)
    {
        List<byte> parsed = [];
        foreach (string hex in hexValues)
        {
            if (!byte.TryParse(hex, System.Globalization.NumberStyles.AllowHexSpecifier, System.Globalization.CultureInfo.InvariantCulture, out byte parsedByte))
            {
                bytes = [];
                return false;
            }

            parsed.Add(parsedByte);
        }

        bytes = [.. parsed];
        return true;
    }

    private static string? DecodeWineHexValue(string currentValue)
    {
        string[] hexValues = currentValue[4..].Replace("\\", "", StringComparison.Ordinal).Split(',');
        if (!TryParseHexBytes(hexValues, out byte[] bytes))
        {
            LogRegistryParseError("hex value", InvalidHexMessage);
            return null;
        }

        string decodedString = Encoding.UTF8.GetString(bytes);

        if (decodedString.StartsWith('[') && decodedString.EndsWith(']'))
        {
            try
            {
                object? jsonObject = Newtonsoft.Json.JsonConvert.DeserializeObject(decodedString);
                return Newtonsoft.Json.JsonConvert.SerializeObject(jsonObject, Newtonsoft.Json.Formatting.Indented);
            }
            catch (Newtonsoft.Json.JsonException ex)
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing JSON: {ex.Message}");
                return decodedString;
            }
        }

        return currentValue;
    }

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

    public override object? GetVRChatRegistryKey(string key)
    {
        try
        {
            key = AddHashToKeyName(key);
            string regCommand = $"query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"{key}\"";
            string? queryResult = GetWineRegCommand(regCommand);
            if (queryResult == null)
            {
                return null;
            }

            string? result = ParseWineRegOutput(queryResult, key);
            if (string.Equals(result, "REG_DWORD", StringComparison.Ordinal))
            {
                queryResult = GetWineRegCommandEx(regCommand);
                result = ParseWineRegOutputEx(queryResult, key);
            }

            return result;
        }
        catch (Win32Exception ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (IOException ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (UnauthorizedAccessException ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (InvalidOperationException ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (ArgumentException ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (IndexOutOfRangeException ex)
        {
            return LogRegistryReadFailure(ex);
        }
        catch (TimeoutException ex)
        {
            return LogRegistryReadFailure(ex);
        }
    }

    private static object? LogRegistryReadFailure(Exception ex)
    {
        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Exception in GetRegistryValueFromWine: {ex.Message}");
        return null;
    }

    public override string? GetVRChatRegistryKeyString(string key) =>

        GetVRChatRegistryKey(key)?.ToString();


    public async Task SetVRChatRegistryKeyAsync(string key, object value, int typeInt, CancellationToken cancellationToken = default)
    {
        await Task.Run(() =>
        {
            SetVRChatRegistryKey(key, value, typeInt);
        }, cancellationToken).ConfigureAwait(false);
    }

    public override bool SetVRChatRegistryKey(string key, object value, int typeInt)
    {
        string keyName = AddHashToKeyName(key);
        switch (typeInt)
        {
            case BinaryValueKind:
                return SetVRChatRegistryBinary(keyName, value);
            case DWordValueKind:
                return SetVRChatRegistryDWord(keyName, value);
            case NoneValueKind:
            case UnknownValueKind:
            case StringValueKind:
            case ExpandStringValueKind:
            case MultiStringValueKind:
            case QWordValueKind:
                return true;
            default:
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Unsupported set registry value type: {typeInt}");
                return false;
        }
    }

    private static bool SetVRChatRegistryBinary(string keyName, object value)
    {
        if (value is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == JsonValueKind.String)
            {
                string text = jsonElement.GetString() ?? throw new InvalidOperationException($"REG_BINARY JSON string for {keyName} was null");
                byte[] byteArray = Encoding.UTF8.GetBytes(text);
                string data = Convert.ToHexString(byteArray);
                if (data.Length == 0)
                {
                    data = "\"\"";
                }

                return AddVRChatRegistryBinaryValue(keyName, data);
            }

            if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                byte[] byteArray = [.. jsonElement.EnumerateArray().Select(e => (byte)e.GetInt32())];
                return AddVRChatRegistryBinaryValue(keyName, Convert.ToHexString(byteArray));
            }

            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_BINARY: {value}. It must be a JSON string or array.");
            return false;
        }

        if (value is string jsonArray)
        {
            byte[] byteArray = Encoding.UTF8.GetBytes(jsonArray);
            return AddVRChatRegistryBinaryValue(keyName, Convert.ToHexString(byteArray));
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_BINARY: {value}. It must be a JsonElement.");
        return false;
    }

    private static bool AddVRChatRegistryBinaryValue(string keyName, string data)
    {
        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + data + " /f";
        return GetWineRegCommand(regCommand) != null;
    }

    private static bool SetVRChatRegistryDWord(string keyName, object value)
    {
        int dwordValue;
        if (value is int intValue)
        {
            dwordValue = intValue;
        }
        else if (value is string stringValue && int.TryParse(stringValue, System.Globalization.CultureInfo.InvariantCulture, out int parsedIntValue))
        {
            dwordValue = parsedIntValue;
        }
        else if (value is JsonElement jsonElementValue && jsonElementValue.ValueKind == JsonValueKind.Number)
        {
            dwordValue = jsonElementValue.GetInt32();
        }
        else
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_DWORD: {value}. It must be a valid integer.");
            return false;
        }

        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD /d " + dwordValue + " /f";
        return GetWineRegCommandEx(regCommand) != null;
    }

    public override void SetVRChatRegistryKey(string key, byte[] value)
    {
        string keyName = AddHashToKeyName(key);
        string data = Convert.ToHexString(value);
        if (data.Length == 0)
        {
            data = "\"\"";
        }

        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + data + " /f";
        GetWineRegCommand(regCommand);
    }

    public override string GetVRChatRegistryJson()
    {
        var registry = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
        const string RegCommand = "query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\"";
        string queryResult = GetWineRegCommand(RegCommand) ?? throw new InvalidOperationException("Failed to get VRC registry data");
        string[] lines = [.. queryResult.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Where(line =>
                !string.IsNullOrWhiteSpace(line) &&
                !line.Contains("fixme:", StringComparison.Ordinal) &&
                !line.Contains("wine:", StringComparison.Ordinal))];

        foreach (string line in lines)
        {
            string[] parts = [.. line.Split(['\t', ' '], StringSplitOptions.RemoveEmptyEntries).Select(p => p.Trim())];
            if (parts.Length >= 3)
            {
                string keyName = parts[0];
                int index = keyName.LastIndexOf("_h", StringComparison.Ordinal);
                if (index > 0)
                {
                    keyName = keyName[..index];
                }

                string valueType = parts[^2];
                string value = parts[^1];

                switch (valueType)
                {
                    case "REG_BINARY":
                        ParseRegistryBinaryEntry(registry, keyName, value);
                        break;
                    case "REG_DWORD":
                        ParseRegistryDwordEntry(registry, keyName);
                        break;
                    default:
                        break;
                }
            }
        }

        return Newtonsoft.Json.JsonConvert.SerializeObject(registry, Newtonsoft.Json.Formatting.Indented);
    }

    private static void ParseRegistryBinaryEntry(Dictionary<string, Dictionary<string, object>> registry, string keyName, string value)
    {
        if (!TryParseHexBytes(SplitHexPairs(value), out byte[] hexValues))
        {
            LogRegistryParseError("REG_BINARY as plain hex string", InvalidHexMessage);
            return;
        }

        try
        {
            var binDict = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                { "data", Encoding.ASCII.GetString(hexValues).TrimEnd('\0') },
                { "type", 3 },
            };
            registry.Add(keyName, binDict);
        }
        catch (ArgumentException ex)
        {
            LogRegistryParseError("REG_BINARY as plain hex string", ex);
        }
    }

    private static void ParseRegistryDwordEntry(Dictionary<string, Dictionary<string, object>> registry, string keyName)
    {
        string regCommandExDword = $"query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"{keyName}\"";
        string queryResultExDword = GetWineRegCommandEx(regCommandExDword);
        string? resultExDword = ParseWineRegOutputEx(queryResultExDword, keyName);
        if (resultExDword == null)
        {
            return;
        }

        try
        {
            if (resultExDword.StartsWith("hex(4)", StringComparison.Ordinal))
            {
                string[] hexValues = resultExDword.Split(':')[1].Split(',');
                if (!TryParseHexBytes(hexValues, out byte[] byteValues))
                {
                    LogRegistryParseError("REG_DWORD", InvalidHexMessage);
                    return;
                }

                if (byteValues.Length != 8)
                {
                    LogRegistryParseError("REG_DWORD", "Input does not represent a valid 8-byte double-precision float.");
                    return;
                }

                double parsedDouble = BitConverter.ToDouble(byteValues, 0);
                var doubleDict = new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    { "data", parsedDouble },
                    { "type", 100 },
                };
                registry.Add(keyName, doubleDict);
            }
            else
            {
                if (!int.TryParse(resultExDword, System.Globalization.CultureInfo.InvariantCulture, out int parsedInt))
                {
                    LogRegistryParseError("REG_DWORD", "Input is not a valid 32-bit integer.");
                    return;
                }

                var dwordDict = new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    { "data", parsedInt },
                    { "type", 4 },
                };
                registry.Add(keyName, dwordDict);
            }
        }
        catch (IndexOutOfRangeException ex)
        {
            LogRegistryParseError("REG_DWORD", ex);
        }
        catch (ArgumentException ex)
        {
            LogRegistryParseError("REG_DWORD", ex);
        }
    }

    private static void LogRegistryParseError(string valueKind, Exception ex) => LogRegistryParseError(valueKind, ex.Message);

    private static void LogRegistryParseError(string valueKind, string message) =>
        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing {valueKind}: {message}");

    public override void SetVRChatRegistry(string json)
    {
        Dictionary<string, Dictionary<string, object>> dict = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, object>>>(json)
            ?? throw new InvalidDataException("VRChat registry JSON must be an object of registry entries.");

        foreach (KeyValuePair<string, Dictionary<string, object>> item in dict)
        {
            var data = (JsonElement)item.Value["data"];
            if (!int.TryParse(item.Value["type"].ToString(), System.Globalization.CultureInfo.InvariantCulture, out int type))
            {
                throw new InvalidDataException("Unknown type: " + item.Value["type"]);
            }

            string keyName = AddHashToKeyName(item.Key);
            if (type == 4)
            {
                int intValue = data.GetInt32();
                string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD /d " + intValue + " /f";
                string addResult = GetWineRegCommandEx(regCommand);
                if (addResult == null)
                {
                    continue;
                }
            }
            else if (type == 100)
            {
                double valueLong = data.GetDouble();
                string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD100 /d " + valueLong + " /f";
                string addResult = GetWineRegCommandEx(regCommand);
                if (addResult == null)
                {
                    continue;
                }
            }
            else
            {
                if (data.ValueKind == JsonValueKind.Number)
                {
                    if (int.TryParse(data.ToString(), System.Globalization.CultureInfo.InvariantCulture, out int intValue))
                    {
                        SetVRChatRegistryKey(item.Key, intValue, type);
                        continue;
                    }

                    throw new InvalidDataException("Unknown number type: " + item.Key);
                }

                SetVRChatRegistryKey(item.Key, data, type);
            }
        }
    }

    public override bool HasVRChatRegistryFolder()
    {
        string regCommand = "query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\"";
        string? queryResult = GetWineRegCommand(regCommand);
        return !string.IsNullOrEmpty(queryResult);
    }

    private static void CreateVRChatRegistryFolder()
    {
        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /f";
        GetWineRegCommand(regCommand);
    }

    public override void DeleteVRChatRegistryFolder()
    {
        string regCommand = "delete \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /f";
        GetWineRegCommand(regCommand);
    }

    public override string ReadVrcRegJsonFile(string filepath)
    {
        if (!File.Exists(filepath))
        {
            return string.Empty;
        }

        string json = File.ReadAllText(filepath);
        return json;
    }

    [GeneratedRegex("\"(\\d+)\"\\s*\\{[^}]*\"name\"\\s*\"([^\"]+)\"", RegexOptions.Multiline | RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex();
    [GeneratedRegex(@"^(?<action>add|query|delete)\s+""[^""]+""(?:\s+/v\s+""(?<valueName>[^""]+)"")?(?:\s+/t\s+(?<valueType>\w+))?(?:\s+/d\s+(?<valueData>[^\s]+))?.*$", RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex1();
}
