using System.ComponentModel;
using System.Text;
using System.Text.Json;

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
}
