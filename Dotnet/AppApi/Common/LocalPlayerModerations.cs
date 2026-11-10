using System.Text;

namespace VRCX;

public partial class AppApi
{
    public Dictionary<string, short> GetVRChatModerations(string currentUserId)
    {


        string filePath = Path.Join(GetVRChatAppDataLocation(), @$"LocalPlayerModerations\{currentUserId}-show-hide-user.vrcset");
        if (!File.Exists(filePath))
        {
            return null;
        }

        var output = new Dictionary<string, short>(StringComparer.Ordinal);
        using var reader = new StreamReader(filePath);
        string line;
        while ((line = reader.ReadLine()) != null)
        {
            int index = line.IndexOf(' ');
            if (index <= 0)
            {
                continue;
            }

            string userId = line[..index];
            short type = short.Parse(line[^3..], System.Globalization.CultureInfo.InvariantCulture);
            output.Add(userId, type);
        }

        return output;
    }

    public short GetVRChatUserModeration(string currentUserId, string userId)
    {
        string filePath = Path.Join(GetVRChatAppDataLocation(), @$"LocalPlayerModerations\{currentUserId}-show-hide-user.vrcset");
        if (!File.Exists(filePath))
        {
            return 0;
        }

        using var reader = new StreamReader(filePath);
        string line;
        while ((line = reader.ReadLine()) != null)
        {
            int index = line.IndexOf(' ');
            if (index <= 0)
            {
                continue;
            }

            if (string.Equals(userId, line[..index], StringComparison.Ordinal))
            {
                return short.Parse(line[^3..], System.Globalization.CultureInfo.InvariantCulture);
            }
        }

        return 0;
    }

    public bool SetVRChatUserModeration(string currentUserId, string userId, int type)
    {
        string filePath = Path.Join(GetVRChatAppDataLocation(), @$"LocalPlayerModerations\{currentUserId}-show-hide-user.vrcset");
        if (!File.Exists(filePath))
        {
            return false;
        }

        List<string> lines = [.. File.ReadAllLines(filePath)];
        int index = lines.FindIndex(x => x.StartsWith(userId, StringComparison.Ordinal));
        if (index >= 0)
        {
            lines.RemoveAt(index);
        }

        if (type != 0)
        {
            var sb = new StringBuilder(userId);
            while (sb.Length < 64)
            {
                sb.Append(' ');
            }

            sb.Append(type.ToString("000", System.Globalization.CultureInfo.InvariantCulture));
            lines.Add(sb.ToString());
        }

        try
        {
            File.WriteAllLines(filePath, lines);
        }
        catch (Exception)
        {
            return false;
        }

        return true;
    }
}
