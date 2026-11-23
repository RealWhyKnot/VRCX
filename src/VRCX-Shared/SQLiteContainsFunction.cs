using System.Globalization;

namespace VRCX;

internal static class SQLiteContainsFunction
{
    internal static object Invoke(object[] callback) => callback is ["Invoke", object[] args]
        ? (Convert.ToString(args[0], CultureInfo.InvariantCulture) ?? string.Empty)
            .Contains(Convert.ToString(args[1], CultureInfo.InvariantCulture) ?? string.Empty, StringComparison.OrdinalIgnoreCase)
        : DBNull.Value;
}
