using System.Numerics;
using Newtonsoft.Json;

namespace VRCX;

internal sealed class ScreenshotMetadata
{



    public string Application { get; set; }




    public int Version { get; set; }




    public AuthorDetail Author { get; set; }




    public WorldDetail World { get; set; }




    public List<PlayerDetail> Players { get; set; }




    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    internal string SourceFile;




    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public Vector3? Pos { get; set; }

    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public DateTime? Timestamp { get; set; }

    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public string? Note { get; set; }





    [JsonIgnore]
    internal string? Error;

    [JsonIgnore]
    internal string JSON;

    public ScreenshotMetadata()
    {
        Application = "VRCX";
        Version = 1;
        Author = new AuthorDetail();
        World = new WorldDetail();
        Players = [];
    }

    public static ScreenshotMetadata JustError(string sourceFile, string error)
    {
        return new ScreenshotMetadata
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
            ? Players.Any(p => p.DisplayName.IndexOf(playerName, comparisonType) != -1)
            : Players.Any(p => p.DisplayName.Equals(playerName, comparisonType));
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
