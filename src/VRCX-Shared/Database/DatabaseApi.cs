using System.Text.RegularExpressions;

namespace VRCX.Database;

#if LINUX
public
#else
internal
#endif
sealed partial class DatabaseApi
{
    private string _userPrefix = string.Empty;

    public static DatabaseApi Instance { get; } = new DatabaseApi();

    private SQLiteDatabase Store => field ??= SQLiteDatabase.Instance;

    public void SetUser(string userId)
    {
        ArgumentNullException.ThrowIfNull(userId);
        string prefix = userId.Replace("-", string.Empty, StringComparison.Ordinal).Replace("_", string.Empty, StringComparison.Ordinal);
        if (!UserPrefixPattern().IsMatch(prefix))
        {
            throw new ArgumentException("The user id contains characters that cannot be used in a table name.", nameof(userId));
        }

        _userPrefix = char.IsAsciiDigit(prefix[0]) ? $"_{prefix}" : prefix;
    }

    public void BeginTransaction() => _ = Store.ExecuteNonQuery("BEGIN");

    public void CommitTransaction() => _ = Store.ExecuteNonQuery("COMMIT");

    private string UserTable(string suffix) => _userPrefix.Length == 0 ? throw new InvalidOperationException("No user has been set for the database.") : $"{_userPrefix}_{suffix}";

    private string Rows(string sql, params (string Name, object? Value)[] args) => Store.ExecuteJson(sql, ToArguments(args));

    private int Run(string sql, params (string Name, object? Value)[] args) => Store.ExecuteNonQuery(sql, ToArguments(args));

    private long Insert(string sql, params (string Name, object? Value)[] args) => Store.ExecuteInsert(sql, ToArguments(args));

    private static Dictionary<string, object?>? ToArguments((string Name, object? Value)[] args)
    {
        if (args.Length == 0)
        {
            return null;
        }

        var result = new Dictionary<string, object?>(args.Length, StringComparer.Ordinal);
        foreach ((string name, object? value) in args)
        {
            result[name] = value;
        }

        return result;
    }

    [GeneratedRegex("^[A-Za-z0-9]+$", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
    private static partial Regex UserPrefixPattern();
}
