using System.Collections.Concurrent;
using System.Globalization;
using System.Numerics;
using System.Xml;
using Newtonsoft.Json;
using NLog;

namespace VRCX.ScreenshotMetadata;

internal static class ScreenshotHelper
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly ScreenshotMetadataDatabase CacheDatabase = new(Path.Join(Program.AppDataDirectory, "metadataCache.db"));
    private static readonly ConcurrentDictionary<string, ScreenshotInfo?> MetadataCache = new(StringComparer.Ordinal);

    internal enum ScreenshotSearchType
    {
        Username,
        UserID,
        WorldName,
        WorldID,
    }

    public static bool TryGetCachedMetadata(string filePath, out ScreenshotInfo? metadata)
    {
        if (MetadataCache.TryGetValue(filePath, out metadata))
        {
            return true;
        }

        int id = CacheDatabase.IsFileCached(filePath);
        if (id == -1)
        {
            return false;
        }

        string? metadataStr = CacheDatabase.GetMetadataById(id);
        ScreenshotInfo? metadataObj = metadataStr == null ? null : JsonConvert.DeserializeObject<ScreenshotInfo>(metadataStr);
        MetadataCache.TryAdd(filePath, metadataObj);

        metadata = metadataObj;
        return true;
    }

    public static List<ScreenshotInfo> FindScreenshots(string query, string directory, ScreenshotSearchType searchType)
    {
        var result = new List<ScreenshotInfo>();
        string[] files = Directory.GetFiles(directory, "*.png", SearchOption.AllDirectories);
        var addToCache = new List<MetadataCache>();
        int amtFromCache = 0;
        foreach (string file in files)
        {
            if (TryGetCachedMetadata(file, out ScreenshotInfo? metadata))
            {
                amtFromCache++;
            }
            else
            {
                metadata = GetScreenshotMetadata(file, includeJSON: false);
                var dbEntry = new MetadataCache()
                {
                    FilePath = file,
                    Metadata = null,
                    CachedAt = DateTimeOffset.Now,
                };

                if (metadata == null || metadata.Error != null)
                {
                    addToCache.Add(dbEntry);
                    MetadataCache.TryAdd(file, value: null);
                    continue;
                }

                dbEntry.Metadata = JsonConvert.SerializeObject(metadata);
                addToCache.Add(dbEntry);
                MetadataCache.TryAdd(file, metadata);
            }

            if (metadata != null && MatchesSearch(metadata, query, searchType))
            {
                result.Add(metadata);
            }
        }

        if (addToCache.Count > 0)
        {
            CacheDatabase.BulkAddMetadataCache(addToCache);
        }

        Logger.ConditionalDebug("Found {0}/{1} screenshots matching query '{2}' of type '{3}'. {4}/{5} pulled from cache.", result.Count, files.Length, query, searchType, amtFromCache, files.Length);

        return result;
    }

    private static bool MatchesSearch(ScreenshotInfo metadata, string query, ScreenshotSearchType searchType) => searchType switch
    {
        ScreenshotSearchType.Username => metadata.ContainsPlayerName(query, partial: true, ignoreCase: true),
        ScreenshotSearchType.UserID => metadata.ContainsPlayerID(query),
        ScreenshotSearchType.WorldName => metadata.World.Name != null && metadata.World.Name.Contains(query, StringComparison.OrdinalIgnoreCase),
        ScreenshotSearchType.WorldID => string.Equals(metadata.World.Id, query, StringComparison.Ordinal),
        _ => false,
    };

    public static ScreenshotInfo? GetScreenshotMetadata(string path, bool includeJSON = false)
    {
        if (!File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal))
        {
            return null;
        }

        List<string> metadata = ReadTextMetadata(path);
        var result = new ScreenshotInfo();

        for (int i = 0; i < metadata.Count; i++)
        {
            try
            {
                result = ParseMetadataLine(metadata[i], path, result, includeJSON);
            }
            catch (Exception ex) when (IsParseFailure(ex))
            {
                Logger.Error(ex, "Failed to parse metadata for file '{0}\n---'{1}\n---", path, string.Join("\n", metadata));
                return ScreenshotInfo.JustError(path, "Failed to parse metadata. Check log file for details.");
            }
        }

        return result.Application == null || metadata.Count == 0
            ? ScreenshotInfo.JustError(path, "Image has no valid metadata.")
            : result;
    }

    private static bool IsParseFailure(Exception exception) =>
        exception is JsonException or XmlException or FormatException or ArgumentException or IndexOutOfRangeException or InvalidOperationException or OverflowException;

    private static ScreenshotInfo ParseMetadataLine(string metadataString, string path, ScreenshotInfo result, bool includeJSON)
    {
        bool gotVrchatMetadata = false;

        if (metadataString.StartsWith("<x:xmpmeta", StringComparison.Ordinal))
        {
            result = ParseVRCImage(metadataString);
            result.SourceFile = path;

            gotVrchatMetadata = true;
        }

        if (metadataString.StartsWith('{') && metadataString.EndsWith('}'))
        {
            ScreenshotInfo? vrcxMetadataResult = JsonConvert.DeserializeObject<ScreenshotInfo>(metadataString);
            if (vrcxMetadataResult != null)
            {
                vrcxMetadataResult.SourceFile = path;
                if (gotVrchatMetadata)
                {
                    result.Players = vrcxMetadataResult.Players;
                    result.World.InstanceId = vrcxMetadataResult.World.InstanceId;
                }
                else
                {
                    result = vrcxMetadataResult;
                }

                if (includeJSON)
                {
                    result.JSON = metadataString;
                }
            }
        }

        if (metadataString.StartsWith("lfs", StringComparison.Ordinal) || metadataString.StartsWith("screenshotmanager", StringComparison.Ordinal))
        {
            result = ParseLfsPicture(metadataString);
            result.SourceFile = path;
        }

        return result;
    }

    public static List<string> ReadTextMetadata(string path)
    {
        using var pngFile = new PNGFile(path, writeAccess: false);
        var result = new List<string>();
        string? metadata = PNGHelper.ReadTextChunk("Description", pngFile);
        string? vrchatMetadata = PNGHelper.ReadTextChunk("XML:com.adobe.xmp", pngFile);

        if (!string.IsNullOrEmpty(vrchatMetadata))
        {
            result.Add(vrchatMetadata);
        }

        if (!string.IsNullOrEmpty(metadata))
        {
            result.Add(metadata);
        }

        if (result.Count == 0 && pngFile.GetChunk(PNGChunkTypeFilter.sRGB) != null)
        {
            string? lfsMetadata = PNGHelper.ReadTextChunk("Description", pngFile, legacySearch: true);

            if (!string.IsNullOrEmpty(lfsMetadata))
            {
                result.Add(lfsMetadata);
            }
        }

        return result;
    }

    public static void DeleteTextMetadata(string path, bool deleteVRChatMetadata = false)
    {
        using var pngFile = new PNGFile(path, 128 * 1024);
        if (deleteVRChatMetadata)
        {
            PNGHelper.DeleteTextChunk("XML:com.adobe.xmp", pngFile);
        }

        PNGHelper.DeleteTextChunk("Description", pngFile);
    }

    public static bool WriteVRCXMetadata(string text, string path)
    {
        var pngFile = new PNGFile(path, writeAccess: true);
        PNGChunk chunk = PNGHelper.GenerateTextChunk("Description", text);
        bool status = pngFile.WriteChunk(chunk);
        pngFile.Dispose();

        return status;
    }

    public static ScreenshotInfo ParseVRCImage(string xmlString)
    {
        int index = xmlString.IndexOf("<x:xmpmeta", StringComparison.Ordinal);
        xmlString = xmlString[index..];
        var doc = new XmlDocument();
        doc.LoadXml(xmlString);
        XmlElement root = doc.DocumentElement ?? throw new InvalidOperationException("XMP document has no root element");
        var nsManager = new XmlNamespaceManager(doc.NameTable);
        nsManager.AddNamespace("x", "adobe:ns:meta/");
        nsManager.AddNamespace("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
        nsManager.AddNamespace("xmp", "http://ns.adobe.com/xap/1.0/");
        nsManager.AddNamespace("tiff", "http://ns.adobe.com/tiff/1.0/");
        nsManager.AddNamespace("dc", "http://purl.org/dc/elements/1.1/");
        nsManager.AddNamespace("vrc", "http://ns.vrchat.com/vrc/1.0/");
        string? creatorTool = root.SelectSingleNode("//xmp:CreatorTool", nsManager)?.InnerText;
        string? authorName = root.SelectSingleNode("//xmp:Author", nsManager)?.InnerText;
        string? dateTime = root.SelectSingleNode("//tiff:DateTime", nsManager)?.InnerText;
        string? note = root.SelectSingleNode("//dc:title/rdf:Alt/rdf:li", nsManager)?.InnerText;
        string? worldId = root.SelectSingleNode("//vrc:WorldID", nsManager)?.InnerText;
        string? worldDisplayName = root.SelectSingleNode("//vrc:WorldDisplayName", nsManager)?.InnerText;
        string? authorId = root.SelectSingleNode("//vrc:AuthorID", nsManager)?.InnerText;

        if (string.IsNullOrEmpty(worldId))
        {
            worldId = root.SelectSingleNode("//vrc:World", nsManager)?.InnerText;
        }

        if (string.IsNullOrEmpty(authorId))
        {
            authorId = authorName;
            authorName = null;
        }

        return new ScreenshotInfo
        {
            Application = creatorTool,
            Version = 1,
            Author = new ScreenshotInfo.AuthorDetail
            {
                Id = authorId,
                DisplayName = authorName,
            },
            World = new ScreenshotInfo.WorldDetail
            {
                Id = worldId,
                InstanceId = worldId,
                Name = worldDisplayName,
            },
            Timestamp = DateTime.TryParse(dateTime, CultureInfo.InvariantCulture, out DateTime dt) ? dt : null,
            Note = note,
        };
    }

    public static bool IsPNGFile(string path)
    {
        byte[] pngSignatureBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (fs.Length < 33)
        {
            return false;
        }

        byte[] signature = new byte[8];
        fs.ReadExactly(signature, 0, 8);
        return signature.SequenceEqual(pngSignatureBytes);
    }

    public static ScreenshotInfo ParseLfsPicture(string metadataString)
    {
        var metadata = new ScreenshotInfo();

        string[] lfsParts = metadataString.Split('|');
        if (string.Equals(lfsParts[1], "cvr", StringComparison.Ordinal))
        {
            lfsParts = [.. lfsParts.Skip(1)];
        }

        int version = int.Parse(lfsParts[1], CultureInfo.InvariantCulture);
        string application = lfsParts[0];
        metadata.Application = application;
        metadata.Version = version;

        bool isCVR = string.Equals(application, "cvr", StringComparison.Ordinal);

        if (string.Equals(application, "screenshotmanager", StringComparison.Ordinal))
        {
            ParseScreenshotManagerFields(metadata, lfsParts);
            return metadata;
        }

        for (int i = 2; i < lfsParts.Length; i++)
        {
            string[] split = lfsParts[i].Split(':');
            string key = split[0];
            string value = split[1];

            if (string.IsNullOrEmpty(value))
            {
                continue;
            }

            ParseLfsField(metadata, key, value, isCVR, version);
        }

        return metadata;
    }

    private static void ParseScreenshotManagerFields(ScreenshotInfo metadata, string[] lfsParts)
    {
        string[] author = lfsParts[2].Split(',');

        metadata.Author.Id = author[0];
        metadata.Author.DisplayName = author[1];

        string[] world = lfsParts[3].Split(',');

        metadata.World.Id = world[0];
        metadata.World.Name = world[2];
        metadata.World.InstanceId = string.Join(":", world[0], world[1]);
    }

    private static void ParseLfsField(ScreenshotInfo metadata, string key, string value, bool isCVR, int version)
    {
        string[] parts = value.Split(',');
        switch (key)
        {
            case "author":
                metadata.Author.Id = isCVR ? string.Empty : parts[0];
                metadata.Author.DisplayName = isCVR ? $"{parts[1]} ({parts[0]})" : parts[1];
                break;

            case "world":
                metadata.World.Id = isCVR || version == 1 ? string.Empty : parts[0];
                metadata.World.InstanceId = isCVR || version == 1 ? string.Empty : string.Join(":", parts[0], parts[1]);
                metadata.World.Name = isCVR ? $"{parts[2]} ({parts[0]})" : (version == 1 ? value : parts[2]);
                break;

            case "pos":
                metadata.Pos = ParseVector(parts[0], parts[1], parts[2]);
                break;

            case "players":
                AddPlayers(metadata, value, isCVR);
                break;

            default:
                break;
        }
    }

    private static void AddPlayers(ScreenshotInfo metadata, string value, bool isCVR)
    {
        string[] players = value.Split(';');

        foreach (string player in players)
        {
            string[] playerParts = player.Split(',');

            var playerDetail = new ScreenshotInfo.PlayerDetail
            {
                Id = isCVR ? string.Empty : playerParts[0],
                DisplayName = isCVR ? $"{playerParts[4]} ({playerParts[0]})" : playerParts[4],
                Pos = ParseVector(playerParts[1], playerParts[2], playerParts[3]),
            };

            metadata.Players.Add(playerDetail);
        }
    }

    private static Vector3 ParseVector(string x, string y, string z)
    {
        _ = float.TryParse(x, CultureInfo.InvariantCulture, out float parsedX);
        _ = float.TryParse(y, CultureInfo.InvariantCulture, out float parsedY);
        _ = float.TryParse(z, CultureInfo.InvariantCulture, out float parsedZ);

        return new Vector3(parsedX, parsedY, parsedZ);
    }
}
