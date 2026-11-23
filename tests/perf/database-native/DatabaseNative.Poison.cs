using System.Text.Json;
using VRCX.Database;

namespace VRCX;

internal static partial class DatabaseNative
{
    private static void CheckMalformedRetainedEvents(SQLiteDatabase db, DatabaseApi api)
    {
        api.AppendRetainedEvents(Account, """
            [
              {"kind":"profile","subject":"usr_valid_before","createdAt":"t","data":{"bio":"before"}},
              null, 7, {},
              {"kind":"unknown","subject":"usr_bad","createdAt":"t","data":{}},
              {"kind":"avatar","subject":"usr_bad","createdAt":"t","data":{"avatarName":"missing fields"}},
              {"kind":"badge","subject":"usr_bad","createdAt":"t","data":{"badgeId":null}},
              {"kind":"profile","subject":"usr_bad","createdAt":"t","data":{"bio":"partial","tags":null}},
              {"kind":"remote-favorites","subject":"snapshot","createdAt":"t","data":[{"type":"world","itemId":"wrld_bad","group":null}]},
              {"kind":"profile","subject":"usr_valid_after","createdAt":"t","data":{"bio":"after"}}
            ]
            """);
        using var before = JsonDocument.Parse(api.GetProfileHistory("usr_valid_before", beforeId: null, 10));
        using var after = JsonDocument.Parse(api.GetProfileHistory("usr_valid_after", beforeId: null, 10));
        Ensure(before.RootElement.GetArrayLength() == 1 && after.RootElement.GetArrayLength() == 1, "Malformed history blocked valid neighbors");
        Ensure(Number(db, "SELECT COUNT(*) FROM retained_event WHERE subject = 'usr_bad'") == 0, "Malformed history wrote partial fields");
        Ensure(Number(db, "SELECT vrcx_contains('ÉLODIE', 'élo')") == 1, "Unicode search function was not bound");
        Ensure(Number(db, "SELECT vrcx_contains('X%_Y', '%_')") == 1 && Number(db, "SELECT vrcx_contains('XY', '%_')") == 0, "Search wildcards stopped being literal");
        Console.WriteLine("Passed malformed retained event isolation and explicit Unicode function binding");
    }
}
