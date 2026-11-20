using System.ComponentModel;
using System.Runtime.InteropServices;

namespace VRCX;

internal static class VrcLaunchArguments
{
    internal static string Capture(int processId)
    {
        try
        {
            string[]? arguments = WinApi.GetProcessArguments(processId);
            return arguments is null ? string.Empty : Format(arguments);
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException
            or Win32Exception or MarshalDirectiveException or SEHException or AccessViolationException
            or ArgumentException or OverflowException or OutOfMemoryException)
        {
            return string.Empty;
        }
    }

    internal static string Format(IReadOnlyList<string> arguments)
    {
        var kept = new List<string>();
        for (int i = 1; i < arguments.Count; i++)
        {
            string argument = arguments[i];
            if (argument.Length == 0 ||
                argument.StartsWith("vrchat://", StringComparison.OrdinalIgnoreCase) ||
                argument.StartsWith("--startup-begin-ts=", StringComparison.Ordinal))
            {
                continue;
            }

            if (argument.Contains('"', StringComparison.Ordinal) || argument.Any(char.IsControl))
            {
                return string.Empty;
            }

            kept.Add(Quote(argument));
        }

        return string.Join(' ', kept);
    }

    private static string Quote(string argument)
    {
        if (!argument.Any(char.IsWhiteSpace))
        {
            return argument;
        }

        int end = argument.Length;
        while (end > 0 && argument[end - 1] == '\\')
        {
            end--;
        }

        return $"\"{argument}{argument.AsSpan(end)}\"";
    }
}
