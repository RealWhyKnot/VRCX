using System.Numerics;
using Newtonsoft.Json;

namespace VRCX.ScreenshotMetadata;

internal sealed class ScreenshotInfo
{



    public string? Application { get; set; }




    public int Version { get; set; }




    public AuthorDetail Author { get; set; }




    public WorldDetail World { get; set; }




    public List<PlayerDetail> Players { get; set; }




    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    internal string? SourceFile { get; set; }




    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public Vector3? Pos { get; set; }

    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public DateTime? Timestamp { get; set; }

    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public string? Note { get; set; }





    [JsonIgnore]
    internal string? Error { get; set; }

    [JsonIgnore]
    internal string? JSON { get; set; }

    public ScreenshotInfo()
    {
        Application = "VRCX";
        Version = 1;
        Author = new AuthorDetail();
        World = new WorldDetail();
        Players = [];
    }

    public static ScreenshotInfo JustError(string sourceFile, string error)
    {
        return new ScreenshotInfo
        {
            Error = error,
            SourceFile = sourceFile,
        };
    }

    public bool ContainsPlayerID(string id) => Players.Any(p => string.Equals(p.Id, id, StringComparison.Ordinal));

    public bool ContainsPlayerName(string playerName, bool partial, bool ignoreCase)
    {
        StringComparison comparisonType = ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

        return partial
            ? Players.Any(p => p.DisplayName?.Contains(playerName, comparisonType) == true)
            : Players.Any(p => string.Equals(p.DisplayName, playerName, comparisonType));
    }

    internal sealed class AuthorDetail
    {



        public string? Id { get; set; }




        public string? DisplayName { get; set; }
    }

    internal sealed class WorldDetail
    {



        public string? Id { get; set; }




        public string? Name { get; set; }




        public string? InstanceId { get; set; }
    }

    internal sealed class PlayerDetail
    {



        public string? Id { get; set; }




        public string? DisplayName { get; set; }




        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public Vector3? Pos { get; set; } = null;
    }
}
