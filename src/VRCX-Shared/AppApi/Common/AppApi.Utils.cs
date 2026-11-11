using System.Text.RegularExpressions;

namespace VRCX;

#if LINUX
public
#else
internal
#endif
partial class AppApi
{
    private static readonly Regex FolderRegex = new(string.Format(System.Globalization.CultureInfo.InvariantCulture, @"([{0}]*\.+$)|([{0}]+)",
        Regex.Escape(new string(Path.GetInvalidPathChars()))), RegexOptions.None, TimeSpan.FromSeconds(2));

    private static readonly Regex FileRegex = new(string.Format(System.Globalization.CultureInfo.InvariantCulture, @"([{0}]*\.+$)|([{0}]+)",
        Regex.Escape(new string(Path.GetInvalidFileNameChars()))), RegexOptions.None, TimeSpan.FromSeconds(2));

    private static string MakeValidFileName(string name)
    {
        name = name.Replace("/", "", StringComparison.Ordinal);
        name = name.Replace("\\", "", StringComparison.Ordinal);
        name = FolderRegex.Replace(name, "");
        name = FileRegex.Replace(name, "");

        return name;
    }
}
