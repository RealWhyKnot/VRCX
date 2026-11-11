using System.Text;
using System.Text.RegularExpressions;

namespace VRCX;

public partial class AppApiElectron
{
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

    [GeneratedRegex("\"(\\d+)\"\\s*\\{[^}]*\"name\"\\s*\"([^\"]+)\"", RegexOptions.Multiline | RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex MyRegex();
}
