using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace VRCX;

public partial class AppApiElectron
{
    private string AddHashToKeyName(string key)
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
        const string sectionHeader = "\"CompatToolMapping\"";
        int sectionStart = vdfContent.IndexOf(sectionHeader, StringComparison.Ordinal);

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

    private static string GetSteamVdfCompatTool()
    {
        string steamPath = _steamPath;
        string configVdfPath = Path.Join(steamPath, "config", "config.vdf");
        if (!File.Exists(configVdfPath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "config.vdf not found");
            return null;
        }

        string vdfContent = File.ReadAllText(configVdfPath);
        Dictionary<string, string> compatToolMapping = ExtractCompatToolMapping(vdfContent);

        return compatToolMapping.TryGetValue("438100", out string name) ? name : null;
    }

    private string ParseWineRegOutput(string output, string keyName)
    {
        if (string.IsNullOrEmpty(output))
        {
            return null;
        }

        string[] lines = [.. output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Where(line =>
                !string.IsNullOrWhiteSpace(line) &&
                !line.Contains("fixme:") &&
                !line.Contains("wine:"))];

        foreach (string? line in lines)
        {
            string[] parts = [.. line.Split(['\t', ' '], StringSplitOptions.RemoveEmptyEntries).Select(p => p.Trim())];
            if (parts.Length >= 3 && parts[0].Contains(keyName))
            {
                string valueType = parts[^2];
                string value = parts[^1];

                switch (valueType)
                {
                    case "REG_BINARY":
                        try
                        {

                            byte[] hexValues = [.. Enumerable.Range(0, value.Length / 2)
                                .Select(i => value.Substring(i * 2, 2))
                                .Select(hex => Convert.ToByte(hex, 16))];

                            return Encoding.ASCII.GetString(hexValues).TrimEnd('\0');
                        }
                        catch (Exception ex)
                        {
                            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing REG_BINARY as plain hex string: {ex.Message}");
                            return null;
                        }

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

    private string ParseWineRegOutputEx(string output, string keyName)
    {
        string[] lines = output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        string currentKey = null;
        string currentValue = null;

        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (line.Contains("="))
            {
                string[] parts = line.Split(['='], 2);
                currentKey = parts[0].Trim();
                currentValue = parts[1].Trim();

                string escapedString = @$"{currentValue}";
                escapedString = escapedString.Replace("\\", "");
                currentValue = escapedString;

                if (currentKey.Contains(keyName))
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

                    if (currentValue.StartsWith("dword:", StringComparison.Ordinal))
                    {
                        return int.Parse(currentValue[6..], System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture).ToString(System.Globalization.CultureInfo.InvariantCulture);
                    }

                    if (currentValue.StartsWith("hex:", StringComparison.Ordinal))
                    {
                        string[] hexValues = currentValue[4..].Replace("\\", "").Split(',');
                        byte[] bytes = [.. hexValues.Select(hex => Convert.ToByte(hex, 16))];
                        string decodedString = Encoding.UTF8.GetString(bytes);

                        if (decodedString.StartsWith('[') && decodedString.EndsWith(']'))
                        {
                            try
                            {
                                object? jsonObject = Newtonsoft.Json.JsonConvert.DeserializeObject(decodedString);
                                return Newtonsoft.Json.JsonConvert.SerializeObject(jsonObject, Newtonsoft.Json.Formatting.Indented);
                            }
                            catch (Exception ex)
                            {
                                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing JSON: {ex.Message}");
                                return decodedString;
                            }
                        }

                        return currentValue;
                    }

                    return currentValue;
                }
            }
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Key not found: {keyName}");

        return null;
    }

    public static string GetVRChatWinePath()
    {
        string compatTool = GetSteamVdfCompatTool();
        if (compatTool == null)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatTool not found");
            return null;
        }

        string steamPath = _steamPath;
        string winePath = "";



        string protonPath = Path.Join(steamPath, "steamapps", "common", compatTool);
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

            roots.Add(Path.Join(steamPath, "compatibilitytools.d"));

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
        }

        if (string.IsNullOrEmpty(winePath))
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "CompatTool and Proton not found");
            return null;
        }

        return winePath;
    }

    private ProcessStartInfo GetWineProcessStartInfo(string winePath, string winePrefix, string wineCommand)
    {
        var processStartInfo = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            Arguments = $"-c \"{wineCommand.Replace("\"", "\\\"")}\"",
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

    private string GetWineRegCommand(string command)
    {
        string winePath = GetVRChatWinePath();
        string winePrefix = _vrcPrefixPath;
        if (string.IsNullOrEmpty(winePath) || string.IsNullOrEmpty(winePrefix))
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRC Wine path was not found");
            return null;
        }

        string wineRegCommand = $"\"{winePath}\" reg {command}";
        ProcessStartInfo processStartInfo = GetWineProcessStartInfo(winePath, winePrefix, wineRegCommand);
        using var process = Process.Start(processStartInfo);
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

    private string GetWineRegCommandEx(string regCommand)
    {
        string winePrefix = _vrcPrefixPath;
        string filePath = Path.Join(winePrefix, "user.reg");
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"Registry file not found at {filePath}");
        }

        Match match = MyRegex1().Match(regCommand);
        if (!match.Success)
        {
            throw new ArgumentException("Invalid command format.");
        }

        string action = match.Groups[1].Value.ToLowerInvariant();
        string valueName = match.Groups[3].Success ? match.Groups[3].Value : null;
        string valueType = match.Groups[4].Success ? match.Groups[4].Value : null;
        string valueData = match.Groups[5].Success ? match.Groups[5].Value : null;

        List<string> lines = [.. File.ReadAllLines(filePath)];
        var updatedLines = new List<string>();
        bool keyFound = false;
        bool valueFound = false;
        bool inVRChatSection = false;
        int headerEndIndex = -1;
        string keyHeader = "[Software\\\\VRChat\\\\VRChat]";

        if (string.Equals(action, "add", StringComparison.Ordinal))
        {
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
                int insertIndex = headerEndIndex + 2;
                while (insertIndex < updatedLines.Count &&
                       (updatedLines[insertIndex].StartsWith('#') || updatedLines[insertIndex].StartsWith('@')))
                {
                    insertIndex++;
                }
                updatedLines.Insert(insertIndex, $"\"{valueName}\"={GetRegistryValueFormat(valueType, valueData)}");
            }

            File.WriteAllLines(filePath, updatedLines);
            return $"Command '{regCommand}' executed successfully.";
        }

        if (string.Equals(action, "query", StringComparison.Ordinal))
        {
            if (!valueName.Contains("_h"))
            {
                valueName = AddHashToKeyName(valueName);
            }

            foreach (string? line in lines)
            {
                if (line.Contains(valueName))
                {
                    return line;
                }
            }

            return $"Value \"{valueName}\" not found.";
        }

        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Unsupported registry command: {regCommand}");

        return $"Command '{regCommand}' executed successfully.";
    }

    private static string GetRegistryValueFormat(string valueType, string valueData)
    {
        if (string.Equals(valueType?.ToUpperInvariant(), "REG_DWORD100", StringComparison.Ordinal))
        {
            double inputValue = double.Parse(valueData, System.Globalization.CultureInfo.InvariantCulture);
            Span<byte> dataBytes = stackalloc byte[sizeof(double)];
            BitConverter.TryWriteBytes(dataBytes, inputValue);
            string[] hexValues = [.. dataBytes.ToArray().Select(b => b.ToString("X2"))];
            string byteString = string.Join(",", hexValues).ToLowerInvariant();
            string result = $"hex(4):{byteString}";
            return result;
        }

        return valueType?.ToUpperInvariant() switch
        {
            "REG_DWORD" => $"dword:{int.Parse(valueData, System.Globalization.CultureInfo.InvariantCulture):X8}",
            _ => throw new ArgumentException($"Unsupported registry value type: {valueType}"),
        };
    }

    public override object GetVRChatRegistryKey(string key)
    {
        try
        {
            key = AddHashToKeyName(key);
            string regCommand = $"query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"{key}\"";
            string queryResult = GetWineRegCommand(regCommand);
            if (queryResult == null)
            {
                return null;
            }

            string result = ParseWineRegOutput(queryResult, key);
            if (string.Equals(result, "REG_DWORD", StringComparison.Ordinal))
            {
                queryResult = GetWineRegCommandEx(regCommand);
                result = ParseWineRegOutputEx(queryResult, key);
            }

            return result;
        }
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Exception in GetRegistryValueFromWine: {ex.Message}");
            return null;
        }
    }

    public override string GetVRChatRegistryKeyString(string key) =>

        GetVRChatRegistryKey(key)?.ToString();


    public async Task SetVRChatRegistryKeyAsync(string key, object value, int typeInt)
    {
        await Task.Run(() =>
        {
            SetVRChatRegistryKey(key, value, typeInt);
        });
    }

    public override bool SetVRChatRegistryKey(string key, object value, int typeInt)
    {
        var type = (RegistryValueKind)typeInt;
        string keyName = AddHashToKeyName(key);
        switch (type)
        {
            case RegistryValueKind.Binary:
                if (value is JsonElement jsonElement)
                {

                    if (jsonElement.ValueKind == JsonValueKind.String)
                    {
                        byte[] byteArray = Encoding.UTF8.GetBytes(jsonElement.GetString());
                        string data = BitConverter.ToString(byteArray).Replace("-", "");
                        if (data.Length == 0)
                        {
                            data = "\"\"";
                        }

                        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + data + " /f";
                        string addResult = GetWineRegCommand(regCommand);
                        if (addResult == null)
                        {
                            return false;
                        }
                    }
                    else if (jsonElement.ValueKind == JsonValueKind.Array)
                    {
                        byte[] byteArray = [.. jsonElement.EnumerateArray().Select(e => (byte)e.GetInt32())];
                        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + BitConverter.ToString(byteArray).Replace("-", "") + " /f";
                        string addResult = GetWineRegCommand(regCommand);
                        if (addResult == null)
                        {
                            return false;
                        }
                    }
                    else
                    {
                        Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_BINARY: {value}. It must be a JSON string or array.");
                        return false;
                    }
                }
                else if (value is string jsonArray)
                {
                    byte[] byteArray = Encoding.UTF8.GetBytes(jsonArray);
                    string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + BitConverter.ToString(byteArray).Replace("-", "") + " /f";
                    string addResult = GetWineRegCommand(regCommand);
                    if (addResult == null)
                    {
                        return false;
                    }
                }
                else
                {
                    Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_BINARY: {value}. It must be a JsonElement.");
                    return false;
                }
                break;

            case RegistryValueKind.DWord:
                if (value is int intValue)
                {
                    string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD /d " + intValue + " /f";
                    string addResult = GetWineRegCommandEx(regCommand);
                    if (addResult == null)
                    {
                        return false;
                    }
                }
                else if (value is string stringValue && int.TryParse(stringValue, System.Globalization.CultureInfo.InvariantCulture, out int parsedIntValue))
                {
                    string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD /d " + parsedIntValue + " /f";
                    string addResult = GetWineRegCommandEx(regCommand);
                    if (addResult == null)
                    {
                        return false;
                    }
                }
                else if (value is JsonElement jsonElementValue && jsonElementValue.ValueKind == JsonValueKind.Number)
                {
                    int parsedInt32Value = jsonElementValue.GetInt32();
                    string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_DWORD /d " + parsedInt32Value + " /f";
                    string addResult = GetWineRegCommandEx(regCommand);
                    if (addResult == null)
                    {
                        return false;
                    }
                }
                else
                {
                    Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Invalid value for REG_DWORD: {value}. It must be a valid integer.");
                    return false;
                }
                break;
            case RegistryValueKind.None:
                break;
            case RegistryValueKind.Unknown:
                break;
            case RegistryValueKind.String:
                break;
            case RegistryValueKind.ExpandString:
                break;
            case RegistryValueKind.MultiString:
                break;
            case RegistryValueKind.QWord:
                break;
            default:
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Unsupported set registry value type: {typeInt}");
                return false;
        }
        return true;
    }

    public override void SetVRChatRegistryKey(string key, byte[] value)
    {
        string keyName = AddHashToKeyName(key);
        string data = BitConverter.ToString(value).Replace("-", "");
        if (data.Length == 0)
        {
            data = "\"\"";
        }

        string regCommand = "add \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"" + keyName + "\" /t REG_BINARY /d " + data + " /f";
        GetWineRegCommand(regCommand);
    }

    public override Dictionary<string, Dictionary<string, object>> GetVRChatRegistry() => null;



    public string GetVRChatRegistryJson()
    {
        var registry = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
        const string regCommand = "query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\"";
        string queryResult = GetWineRegCommand(regCommand) ?? throw new Exception("Failed to get VRC registry data");
        string[] lines = [.. queryResult.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Where(line =>
                !string.IsNullOrWhiteSpace(line) &&
                !line.Contains("fixme:") &&
                !line.Contains("wine:"))];

        foreach (string? line in lines)
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
                        try
                        {

                            byte[] hexValues = [.. Enumerable.Range(0, value.Length / 2)
                                .Select(i => value.Substring(i * 2, 2))
                                .Select(hex => Convert.ToByte(hex, 16))];

                            var binDict = new Dictionary<string, object>(StringComparer.Ordinal)
                            {
                                { "data", Encoding.ASCII.GetString(hexValues).TrimEnd('\0') },
                                { "type", 3 },
                            };
                            registry.Add(keyName, binDict);
                        }
                        catch (Exception ex)
                        {
                            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing REG_BINARY as plain hex string: {ex.Message}");
                        }
                        break;

                    case "REG_DWORD":
                        string regCommandExDword = $"query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\" /v \"{keyName}\"";
                        string queryResultExDword = GetWineRegCommandEx(regCommandExDword);
                        if (queryResultExDword == null)
                        {
                            break;
                        }

                        string resultExDword = ParseWineRegOutputEx(queryResultExDword, keyName);
                        if (resultExDword == null)
                        {
                            break;
                        }

                        try
                        {
                            if (resultExDword.StartsWith("hex(4)", StringComparison.Ordinal))
                            {
                                string hexString = resultExDword;
                                string[] hexValues = hexString.Split(':')[1].Split(',');
                                byte[] byteValues = [.. hexValues.Select(h => Convert.ToByte(h, 16))];
                                if (byteValues.Length != 8)
                                {
                                    throw new ArgumentException("Input does not represent a valid 8-byte double-precision float.");
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

                                int parsedInt = int.Parse(resultExDword, System.Globalization.CultureInfo.InvariantCulture);
                                var dwordDict = new Dictionary<string, object>(StringComparer.Ordinal)
                                {
                                    { "data", parsedInt },
                                    { "type", 4 },
                                };
                                registry.Add(keyName, dwordDict);
                            }
                        }
                        catch (Exception ex)
                        {
                            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error parsing REG_DWORD: {ex.Message}");
                        }
                        break;
                    default:
                        break;
                }
            }
        }

        return Newtonsoft.Json.JsonConvert.SerializeObject(registry, Newtonsoft.Json.Formatting.Indented);
    }

    public override void SetVRChatRegistry(string json)
    {
        Dictionary<string, Dictionary<string, object>>? dict = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, object>>>(json);
        foreach (KeyValuePair<string, Dictionary<string, object>> item in dict)
        {
            var data = (JsonElement)item.Value["data"];
            if (!int.TryParse(item.Value["type"].ToString(), System.Globalization.CultureInfo.InvariantCulture, out int type))
            {
                throw new Exception("Unknown type: " + item.Value["type"]);
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

                    throw new Exception("Unknown number type: " + item.Key);
                }

                SetVRChatRegistryKey(item.Key, data, type);
            }
        }
    }

    public override bool HasVRChatRegistryFolder()
    {
        string regCommand = "query \"HKEY_CURRENT_USER\\SOFTWARE\\VRChat\\VRChat\"";
        string queryResult = GetWineRegCommand(regCommand);
        return queryResult != null && !string.IsNullOrEmpty(queryResult);
    }

    private void CreateVRChatRegistryFolder()
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

    [GeneratedRegex("\"(\\d+)\"\\s*\\{[^}]*\"name\"\\s*\"([^\"]+)\"", RegexOptions.Multiline | RegexOptions.ExplicitCapture)]
    private static partial Regex MyRegex();
    [GeneratedRegex(@"^(add|query|delete)\s+""([^""]+)""(?:\s+/v\s+""([^""]+)"")?(?:\s+/t\s+(\w+))?(?:\s+/d\s+([^\s]+))?.*$")]
    private static partial Regex MyRegex1();
}
