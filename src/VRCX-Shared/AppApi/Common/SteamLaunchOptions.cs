using System.Globalization;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace VRCX;

internal static partial class SteamLaunchOptions
{
    private const string VrchatAppKey = "\"438100\"";

    internal static string RemoveFrom(string steamPath, string arguments)
    {
        if (string.IsNullOrWhiteSpace(arguments))
        {
            return arguments;
        }

        string? options;
        try
        {
            options = Read(steamPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or SecurityException or ArgumentException or RegexMatchTimeoutException)
        {
            return arguments;
        }

        if (string.IsNullOrWhiteSpace(options))
        {
            return arguments;
        }

        List<(string Raw, string Value)>? steamTokens = Split(options);
        List<(string Raw, string Value)>? launchTokens = Split(arguments);
        if (steamTokens is null || launchTokens is null)
        {
            return arguments;
        }

        int commandIndex = steamTokens.FindIndex(token => string.Equals(token.Value, "%command%", StringComparison.Ordinal));
        var remainingOptions = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = commandIndex + 1; i < steamTokens.Count; i++)
        {
            string option = steamTokens[i].Value;
            remainingOptions[option] = remainingOptions.GetValueOrDefault(option) + 1;
        }

        var kept = new List<string>(launchTokens.Count);
        foreach ((string raw, string value) in launchTokens)
        {
            int count = remainingOptions.GetValueOrDefault(value);
            if (count > 0)
            {
                remainingOptions[value] = count - 1;
            }
            else
            {
                kept.Add(raw);
            }
        }

        return kept.Count == launchTokens.Count ? arguments : string.Join(' ', kept);
    }

    private static string? Read(string steamPath)
    {
        uint activeUser = GetActiveUser();
        if (activeUser == 0 || string.IsNullOrEmpty(steamPath))
        {
            return null;
        }

        string localConfig = Path.Join(steamPath, "userdata", activeUser.ToString(CultureInfo.InvariantCulture), "config", "localconfig.vdf");
        if (!File.Exists(localConfig))
        {
            return null;
        }

        string vdf = File.ReadAllText(localConfig);
        int index = 0;
        while ((index = vdf.IndexOf(VrchatAppKey, index, StringComparison.Ordinal)) >= 0)
        {
            index += VrchatAppKey.Length;
            string? block = ReadBlock(vdf, index);
            if (block is not null && LaunchOptionsRegex().Match(block) is { Success: true } match)
            {
                return VdfEscapeRegex().Replace(match.Groups["value"].Value, "${escaped}");
            }
        }

        return null;
    }

    private static uint GetActiveUser()
    {
        if (!OperatingSystem.IsWindows())
        {
            return 0;
        }

        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam\ActiveProcess");
            return key?.GetValue("ActiveUser") is int accountId ? unchecked((uint)accountId) : 0;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or SecurityException)
        {
            return 0;
        }
    }

    private static string? ReadBlock(string vdf, int start)
    {
        while (start < vdf.Length && char.IsWhiteSpace(vdf[start]))
        {
            start++;
        }

        if (start == vdf.Length || vdf[start] != '{')
        {
            return null;
        }

        var body = new StringBuilder();
        int depth = 1;
        bool quoted = false;
        for (int i = start + 1; i < vdf.Length; i++)
        {
            char c = vdf[i];
            if (quoted && c == '\\' && i + 1 < vdf.Length)
            {
                if (depth == 1)
                {
                    body.Append(c).Append(vdf[i + 1]);
                }

                i++;
                continue;
            }

            if (c == '"')
            {
                quoted = !quoted;
            }
            else if (!quoted && c == '{')
            {
                depth++;
                continue;
            }
            else if (!quoted && c == '}')
            {
                if (--depth == 0)
                {
                    return body.ToString();
                }

                continue;
            }

            if (depth == 1)
            {
                body.Append(c);
            }
        }

        return null;
    }

    private static List<(string Raw, string Value)>? Split(string commandLine)
    {
        var tokens = new List<(string Raw, string Value)>();
        var value = new StringBuilder();
        for (int i = 0; i < commandLine.Length;)
        {
            if (IsArgumentSeparator(commandLine[i]))
            {
                i++;
                continue;
            }

            int start = i;
            bool quoted = false;
            while (i < commandLine.Length && (quoted || !IsArgumentSeparator(commandLine[i])))
            {
                int slashStart = i;
                while (i < commandLine.Length && commandLine[i] == '\\')
                {
                    i++;
                }

                int slashes = i - slashStart;
                if (i < commandLine.Length && commandLine[i] == '"')
                {
                    value.Append('\\', slashes / 2);
                    i++;
                    if (slashes % 2 != 0)
                    {
                        value.Append('"');
                    }
                    else if (quoted && i < commandLine.Length && commandLine[i] == '"')
                    {
                        value.Append('"');
                        i++;
                    }
                    else
                    {
                        quoted = !quoted;
                    }
                }
                else
                {
                    value.Append('\\', slashes);
                    if (i < commandLine.Length && (quoted || !IsArgumentSeparator(commandLine[i])))
                    {
                        value.Append(commandLine[i++]);
                    }
                }
            }

            if (quoted)
            {
                return null;
            }

            tokens.Add((commandLine[start..i], value.ToString()));
            value.Clear();
        }

        return tokens;
    }

    private static bool IsArgumentSeparator(char c) => c is ' ' or '\t';

    [GeneratedRegex("\"LaunchOptions\"\\s+\"(?<value>(?:\\\\.|[^\"\\\\])*)\"", RegexOptions.CultureInvariant | RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex LaunchOptionsRegex();

    [GeneratedRegex(@"\\(?<escaped>[""\\])", RegexOptions.CultureInvariant | RegexOptions.ExplicitCapture, 2000)]
    private static partial Regex VdfEscapeRegex();
}
