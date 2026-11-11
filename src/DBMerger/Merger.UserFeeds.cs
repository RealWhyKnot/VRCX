using System.Globalization;

namespace DBMerger;

internal sealed partial class Merger
{
    private void MergeUsers()
    {
        MergeUserNotifications();
        MergeAvatarHistory();
        MergeUserFeeds();
    }

    private void MergeUserNotifications()
    {
        MergeTable(
            table => UserIdPattern.IsMatch(table) &&
                     (table.EndsWith("_notifications", StringComparison.Ordinal) || table.EndsWith("_moderation", StringComparison.Ordinal)),
            [0],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new feed entry");
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing feed entry");

                var oldDateTime = DateTime.Parse(ReadText(old[1]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[1]), CultureInfo.InvariantCulture);

                return oldDateTime > newDateTime ? old : existing;
            }
        );

    }

    private void MergeAvatarHistory()
    {
        MergeTable(
            table => UserIdPattern.IsMatch(table) && table.EndsWith("_avatar_history", StringComparison.Ordinal),
            [0],
            (old, existing) =>
            {
                if (existing == null)
                {
                    Logger.Trace(CultureInfo.InvariantCulture, "Inserting new avatar feed entry");
                    return old;
                }

                Logger.Trace(CultureInfo.InvariantCulture, "Replacing avatar feed entry");

                var oldDateTime = DateTime.Parse(ReadText(old[1]), CultureInfo.InvariantCulture);
                var newDateTime = DateTime.Parse(ReadText(existing[1]), CultureInfo.InvariantCulture);

                if (existing.Length < 3)
                {
                    return oldDateTime > newDateTime ? old : existing;
                }
                long oldAvatarTime = (old.Length >= 3 && old[2] != null) ? Convert.ToInt64(old[2], CultureInfo.InvariantCulture) : 0L;
                long newAvatarTime = (existing.Length >= 3 && existing[2] != null) ? Convert.ToInt64(existing[2], CultureInfo.InvariantCulture) : 0L;

                if (oldDateTime <= newDateTime)
                {
                    old.CopyTo(existing, 0);
                }
                existing[2] = oldAvatarTime + newAvatarTime;

                Logger.Trace(
                    CultureInfo.InvariantCulture,
                    "Combined avatar time: {} + {} = {}",
                    oldAvatarTime, newAvatarTime, oldAvatarTime + newAvatarTime
                );

                return existing;
            }
        );

    }

    private void MergeUserFeeds()
    {
        var overlappingTables = new List<string>();
        DateTime? oldestInNewTables = null;
        DateTime? newestInOldTables = null;
        for (int i = 0; i < _unMergedTables.Count; i++)
        {

            string table = _unMergedTables[i];
            if (!UserIdPattern.IsMatch(table))
            {
                continue;
            }
            _unMergedTables.RemoveAt(i);
            i--;

            if (SkipUserFeed(table))
            {
                continue;
            }

            Logger.Debug(CultureInfo.InvariantCulture, $"Merging table `{table}` into new database");

            List<string> colNames = GetTableColumnNames(_dbConn, _oldDBName, table);

            string? oldestInNew = SqliteExtensions.ReadScalarString(_dbConn, $"SELECT MIN({colNames[1]}) FROM {_newDBName}.{table};");
            DateTime? oldestInNewDT = oldestInNew != null ? DateTime.Parse(oldestInNew, CultureInfo.InvariantCulture) : null;
            string? newestInOld = SqliteExtensions.ReadScalarString(_dbConn, $"SELECT MAX({colNames[1]}) FROM {_oldDBName}.{table};");
            DateTime? newestInOldDT = newestInOld != null ? DateTime.Parse(newestInOld, CultureInfo.InvariantCulture) : null;

            if (newestInOldDT == null || oldestInNewDT == null || oldestInNewDT > newestInOldDT)
            {
                Logger.Debug(CultureInfo.InvariantCulture, $"User tables {table} has no overlap");

                CopyUserTable(table, colNames);
            }
            else
            {

                Logger.Debug(CultureInfo.InvariantCulture, $"User tables {table} has overlap");
                if (oldestInNewTables == null || oldestInNewDT < oldestInNewTables)
                {
                    oldestInNewTables = oldestInNewDT;
                }
                if (newestInOldTables == null || newestInOldDT > newestInOldTables)
                {
                    newestInOldTables = newestInOldDT;
                }
                overlappingTables.Add(table);
            }
        }

        if (overlappingTables.Count > 0)
        {

            if (oldestInNewTables is not DateTime oldest || newestInOldTables is not DateTime newest)
            {
                throw new InvalidOperationException("Overlapping tables have no date range.");
            }
            MergeUsersOverlap(overlappingTables, oldest, newest);
        }
    }

    private static bool SkipUserFeed(string table) =>
        table.EndsWith("_friend_log_current", StringComparison.Ordinal) || table.EndsWith("_notes", StringComparison.Ordinal) ||
                table.EndsWith("_mutual_graph_friends", StringComparison.Ordinal) || table.EndsWith("_mutual_graph_links", StringComparison.Ordinal) || table.EndsWith("_mutual_graph_meta", StringComparison.Ordinal) ||
                table.Contains("_activity_", StringComparison.Ordinal);

    private void CopyUserTable(string table, List<string> colNames)
    {
        string columnsClause = string.Join(", ", colNames.Skip(1));
        SqliteExtensions.ExecuteNonQuery(
            _dbConn,
            $"INSERT INTO {_newDBName}.{table}({columnsClause})" +
                $"SELECT {columnsClause} FROM {_oldDBName}.{table};"
        );
        SortTable(_dbConn, _newDBName, table, 1);
    }

    private void MergeUsersOverlap(List<string> tables, DateTime oldestInNew, DateTime newestInOld)
    {
        PrintOverlapWarning(tables, oldestInNew, newestInOld);

        string userInput = ReadOverlapChoice(out DateTime cutoffTime);

        if (string.Equals(userInput, "keep new", StringComparison.Ordinal))
        {
            Logger.Info(CultureInfo.InvariantCulture, "Keeping new");
            return;
        }
        if (string.Equals(userInput, "keep old", StringComparison.Ordinal))
        {
            Logger.Info(CultureInfo.InvariantCulture, "Keeping old");

            foreach (string table in tables)
            {
                Logger.Debug(CultureInfo.InvariantCulture, $"Deleting all rows in new database's {table}");
                SqliteExtensions.ExecuteNonQuery(_dbConn, $"DELETE FROM {_newDBName}.{table}");

                Logger.Debug(CultureInfo.InvariantCulture, $"Adding rows from old database's {table}");
                SqliteExtensions.ExecuteNonQuery(_dbConn, $"INSERT INTO {_newDBName}.{table} SELECT * FROM {_oldDBName}.{table};");

                SortTable(_dbConn, _newDBName, table, 1);
            }
            return;
        }

        string cutoffStr = cutoffTime.ToString(JSDateTimeFormat, CultureInfo.InvariantCulture);
        Logger.Info(CultureInfo.InvariantCulture, "Merging at date: " + cutoffTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));
        foreach (string table in tables)
        {

            List<string> colNames = GetTableColumnNames(_dbConn, _oldDBName, table);

            Logger.Debug(CultureInfo.InvariantCulture, $"Deleting rows in new database's {table} older than cutoff");
            SqliteExtensions.ExecuteNonQuery(_dbConn, $"DELETE FROM {_newDBName}.{table} WHERE {colNames[1]} < @p0;", cutoffStr);

            Logger.Debug(CultureInfo.InvariantCulture, $"Adding rows from old database's {table} older than cutoff");
            string columnsClause = string.Join(", ", colNames.Skip(1));
            SqliteExtensions.ExecuteNonQuery(
                _dbConn,
                $"INSERT INTO {_newDBName}.{table}({columnsClause})" +
                    $"SELECT {columnsClause} FROM {_oldDBName}.{table} " +
                        $"WHERE {colNames[1]} < @p0;",
                cutoffStr
            );

            SortTable(_dbConn, _newDBName, table, 1);
        }
    }

    private static void PrintOverlapWarning(List<string> tables, DateTime oldestInNew, DateTime newestInOld)
    {
        TimeSpan overlap = newestInOld - oldestInNew;
        string overlapString = $"{overlap.Days} days, {overlap.Hours} hours";

        Logger.Warn(CultureInfo.InvariantCulture, new string('=', 100));
        Logger.Warn(CultureInfo.InvariantCulture, "WARNING:".PadLeft(46));
        Logger.Warn(CultureInfo.InvariantCulture, "The merger has is unable to automatically merge the following USER FEED tables:");
        foreach (string table in tables)
        {
            Logger.Warn(CultureInfo.InvariantCulture, table);
        }
        Logger.Warn(CultureInfo.InvariantCulture, "");
        Logger.Warn(CultureInfo.InvariantCulture, "This is because these USER FEED tables contain overlap that can't be resolved:");
        Logger.Warn(CultureInfo.InvariantCulture, "old database".PadRight(64, '-') + "|");
        Logger.Warn(CultureInfo.InvariantCulture, ("|" + " new database".PadLeft(64, '-')).PadLeft(100));
        Logger.Warn(CultureInfo.InvariantCulture, $"overlap ({overlapString})".PadRight(35) + "|" + new string('-', 28) + "|");
        Logger.Warn(CultureInfo.InvariantCulture, "cutoff (^)".PadLeft(49));
        Logger.Warn(CultureInfo.InvariantCulture, "");
        Logger.Warn(CultureInfo.InvariantCulture, "Please choose a cutoff date and time. Data in the old USER FEED tables after this date");
        Logger.Warn(CultureInfo.InvariantCulture, "will be discarded, and data in the new USER FEED tables before this date will be discarded as well.");
        Logger.Warn(CultureInfo.InvariantCulture, "The remaining data will then be spliced together.");
        Logger.Warn(CultureInfo.InvariantCulture, "Your input should be in this format: `YYYY-MM-DD HH:MM:SS`");
        Logger.Warn(CultureInfo.InvariantCulture, "");
        Logger.Warn(CultureInfo.InvariantCulture, "Alternatively, you can enter `keep new` to discard the old data or `keep old` to discard new data.");
        Logger.Warn(CultureInfo.InvariantCulture, "");
        Logger.Warn(CultureInfo.InvariantCulture, "Again, this only affects USER FEED tables, all other tables are merged properly.");
        Logger.Warn(CultureInfo.InvariantCulture, "To read more about this process please check the VRCX wiki: <woops>");
        Logger.Warn(CultureInfo.InvariantCulture, new string('=', 100));
    }

    private static string ReadOverlapChoice(out DateTime cutoffTime)
    {
        string? userInput = null;
        bool datetimeParsed;
        do
        {
            if (userInput != null)
            {
                Logger.Error(CultureInfo.InvariantCulture, "Unrecognized input: " + userInput);
            }

            userInput = Console.ReadLine();
            datetimeParsed = DateTime.TryParseExact(
                userInput, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out cutoffTime
            );
        }
        while (!string.Equals(userInput, "keep old", StringComparison.Ordinal) && !string.Equals(userInput, "keep new", StringComparison.Ordinal) && !datetimeParsed);

        return userInput ?? throw new EndOfStreamException("No merge choice was entered.");
    }
}
