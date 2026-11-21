using System.Data.SQLite;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace VRCX;

[SQLiteFunction(Name = "vrcx_contains", Arguments = 2, FuncType = FunctionType.Scalar)]
[SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "SQLite creates registered functions through reflection.")]
internal sealed class SQLiteContainsFunction : SQLiteFunction
{
    [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase", Justification = "Friend Log search follows its existing lowercase display-name filter.")]
    public override object Invoke(object[] args) =>
        (Convert.ToString(args[0], CultureInfo.InvariantCulture) ?? string.Empty).ToLowerInvariant()
            .Contains((Convert.ToString(args[1], CultureInfo.InvariantCulture) ?? string.Empty).ToLowerInvariant(), StringComparison.Ordinal);
}
