using System.CommandLine;
using System.CommandLine.Parsing;
using System.Data.SQLite;
using System.Diagnostics;
using System.Reflection;
using NLog;
using NLog.Targets;

namespace DBMerger;

internal static class Program
{
    private static readonly Logger Logger = LogManager.GetLogger("DBMerger");


    public static SQLiteConnection? DBConn { get; private set; }
    public static SQLiteConnection? OldDBConn { get; private set; }
    public static Config? Config { get; private set; }

    public static void Main(string[] args)
    {
        AppDomain.CurrentDomain.UnhandledException += (_, exception) =>
            Logger.Fatal(System.Globalization.CultureInfo.InvariantCulture, "Unhandled exception: {0}", exception.ExceptionObject);
        TaskScheduler.UnobservedTaskException += (_, exception) =>
            Logger.Error(exception.Exception, System.Globalization.CultureInfo.InvariantCulture, "Unobserved task exception");
        ProcessArgs(args);
        if (Config is not Config config)
        {
            return;
        }
        ConfigureLogger(config);
        if (config.Debug && !ConfirmDebugOutput())
        {
            return;
        }
        var asm = Assembly.GetExecutingAssembly();
        var versionInfo = FileVersionInfo.GetVersionInfo(asm.Location);
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"{versionInfo.ProductName}-{versionInfo.ProductVersion}");
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"by {versionInfo.LegalCopyright}\n");
        if (string.Equals(Path.GetFullPath(config.NewDBPath), Path.GetFullPath(config.OldDBPath), StringComparison.Ordinal))
        {
            Logger.Fatal(System.Globalization.CultureInfo.InvariantCulture, "Database paths cannot be the same.");
            return;
        }
        MergeDatabases(config);
    }

    private static bool ConfirmDebugOutput()
    {
        Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, new string('=', 100));
        Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "WARNING:".PadLeft(46));
        Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Debug mode will output some sensitive information (friends list, friend history, etc.)");
        Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, "Only use this mode for debug purposes. Enter `y` to confirm or anything else to exit.");
        Logger.Warn(System.Globalization.CultureInfo.InvariantCulture, new string('=', 100));
        return string.Equals(Console.ReadLine(), "y", StringComparison.Ordinal);
    }

    private static void MergeDatabases(Config config)
    {
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Creating connection to old DB");
        using var connection = new SQLiteConnection($"Data Source=\"{config.OldDBPath}\";Version=3;");
        DBConn = connection;
        try
        {
            connection.Open();
        }
        catch (SQLiteException exception)
        {
            Logger.Fatal(exception, System.Globalization.CultureInfo.InvariantCulture, "Could not connect to old DB.");
            return;
        }
        Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Creating connection to new DB");
        try
        {
            using SQLiteCommand attachCommand = connection.CreateCommand();
            attachCommand.CommandText = "ATTACH DATABASE @p0 AS new_db";
            attachCommand.Parameters.AddWithValue("@p0", config.NewDBPath);
            attachCommand.ExecuteNonQuery();
        }
        catch (SQLiteException exception)
        {
            Logger.Fatal(exception, System.Globalization.CultureInfo.InvariantCulture, "Could not connect to new DB.");
            return;
        }
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Database connections created successfully!");
        CreateBackup(config);
        try
        {
            new Merger(connection, "main", "new_db", config).Merge();
        }
        catch (SQLiteException exception)
        {
            Logger.Fatal(exception, System.Globalization.CultureInfo.InvariantCulture, "Database merge failed.");
        }
        finally
        {
            Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Closing database connection...");
        }
    }

    private static string? ValidateDatabasePath(ArgumentResult arg)
    {
        string path = arg.Tokens[0].Value;
        Option option = arg.Argument.Parents.OfType<Option>().Single();

        string extension = Path.GetExtension(path);
        if (string.IsNullOrEmpty(extension))
        {
            path = Path.ChangeExtension(path, "sqlite3");
        }
        else if (!string.Equals(extension, ".sqlite3", StringComparison.Ordinal))
        {
            arg.AddError($"File given to option `{option.Aliases.First()}` is not a sqlite database!");
            return null;
        }

        if (!File.Exists(path))
        {
            arg.AddError($"File given to option `{option.Aliases.First()}` does not exist!");
            return null;
        }

        return path;
    }


    private static void ProcessArgs(string[] args)
    {
        var rootCommand = new RootCommand("Merge an old and new VRCX sqlite database into one.");

        var newDBOption = new Option<string>(
            "--new-db-path",
            "-n"
        )
        {
            Description = "The path of the new DB to merge the old onto.",
            Required = true,
            CustomParser = ValidateDatabasePath,
        };
        rootCommand.Add(newDBOption);

        var oldDBOption = new Option<string>(
            "--old-db-path",
            "-o"
        )
        {
            Description = "The path of the old DB to merge into the new.",
            Required = true,
            CustomParser = ValidateDatabasePath,
        };
        rootCommand.Add(oldDBOption);


        var debugOption = new Option<bool>("--verbose", "-v", "-d", "--debug")
        {
            Description = "Add debug information to the output.",
        };
        rootCommand.Add(debugOption);

        var importConfigOption = new Option<bool>("--import-config")
        {
            Description = "Imports the config values from the old database. This will override the config in the new database.",
        };
        rootCommand.Add(importConfigOption);

        rootCommand.SetAction(parseResult =>
        {
            string newDBPath = parseResult.GetValue(newDBOption) ?? throw new InvalidOperationException("New database path is missing.");
            string oldDBPath = parseResult.GetValue(oldDBOption) ?? throw new InvalidOperationException("Old database path is missing.");
            bool debug = parseResult.GetValue(debugOption);
            bool importConfig = parseResult.GetValue(importConfigOption);

            Config = new Config(newDBPath, oldDBPath, debug, importConfig);
        });


        if (rootCommand.Parse(args).Invoke() != 0)
        {
            Environment.Exit(0);
        }
    }

    private static void ConfigureLogger(Config config)
    {
        LogManager.Setup().LoadConfiguration(builder =>
        {
            var fileTarget = new FileTarget("fileTarget")
            {
                FileName = "DBMerger.log",
                Layout = "${longdate} [${level:uppercase=true:padding=-5}] ${logger:padding=-20} - ${message} ${exception:format=tostring}",
                ArchiveSuffixFormat = "{1:yyyy-MM-dd.HH-mm-ss}",
                ArchiveOldFileOnStartup = true,
                KeepFileOpen = true,
                AutoFlush = true,
                Encoding = System.Text.Encoding.UTF8,
            };

            var consoleTarget = new ColoredConsoleTarget()
            {
                Layout = "[${level:uppercase=true:padding=-5}] ${message} ${exception:format=tostring}",
                AutoFlush = true,
                Encoding = System.Text.Encoding.UTF8,
            };

            builder.ForLogger().FilterMinLevel(config.Debug ? LogLevel.Trace : LogLevel.Debug).WriteTo(fileTarget);
            builder.ForLogger().FilterMinLevel(config.Debug ? LogLevel.Trace : LogLevel.Info).WriteTo(consoleTarget);
        });
    }

    private static void CreateBackup(Config config)
    {

        string date = DateTime.Now.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);
        int counter = 0;
        string backupPath;
        do
        {
            backupPath = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(config.NewDBPath)) ?? throw new InvalidOperationException("Database folder is missing."), $"VRCX.back.{date}.{counter}.sqlite3");
            counter++;
        }
        while (File.Exists(backupPath));

        File.Copy(config.NewDBPath, backupPath);
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, $"Created backup of new DB at {backupPath}");
    }
}
