using System.Collections.Concurrent;
using System.Numerics;
using System.Xml;
using Newtonsoft.Json;
using NLog;

namespace VRCX;

internal static class ScreenshotHelper
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();
    private static readonly ScreenshotMetadataDatabase CacheDatabase = new(Path.Join(Program.AppDataDirectory, "metadataCache.db"));
    private static readonly ConcurrentDictionary<string, ScreenshotMetadata?> MetadataCache = new(StringComparer.Ordinal);

    internal enum ScreenshotSearchType
    {
        Username,
        UserID,
        WorldName,
        WorldID,
    }

    public static bool TryGetCachedMetadata(string filePath, out ScreenshotMetadata? metadata)
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
        ScreenshotMetadata? metadataObj = metadataStr == null ? null : JsonConvert.DeserializeObject<ScreenshotMetadata>(metadataStr);
        MetadataCache.TryAdd(filePath, metadataObj);

        metadata = metadataObj;
        return true;
    }

    public static List<ScreenshotMetadata> FindScreenshots(string query, string directory, ScreenshotSearchType searchType)
    {
        var result = new List<ScreenshotMetadata>();
        string[] files = Directory.GetFiles(directory, "*.png", SearchOption.AllDirectories);
        var addToCache = new List<MetadataCache>();
        int amtFromCache = 0;
        foreach (string file in files)
        {
            if (TryGetCachedMetadata(file, out ScreenshotMetadata? metadata))
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

            if (metadata == null)
            {
                continue;
            }

            switch (searchType)
            {
                case ScreenshotSearchType.Username:
                    if (metadata.ContainsPlayerName(query, partial: true, ignoreCase: true))
                    {
                        result.Add(metadata);
                    }

                    break;
                case ScreenshotSearchType.UserID:
                    if (metadata.ContainsPlayerID(query))
                    {
                        result.Add(metadata);
                    }

                    break;
                case ScreenshotSearchType.WorldName:
                    if (metadata.World.Name == null)
                    {
                        continue;
                    }

                    if (metadata.World.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
                    {
                        result.Add(metadata);
                    }

                    break;
                case ScreenshotSearchType.WorldID:
                    if (string.Equals(metadata.World.Id, query, StringComparison.Ordinal))
                    {
                        result.Add(metadata);
                    }

                    break;
                default:
                    break;
            }
        }

        if (addToCache.Count > 0)
        {
            CacheDatabase.BulkAddMetadataCache(addToCache);
        }

        Logger.ConditionalDebug("Found {0}/{1} screenshots matching query '{2}' of type '{3}'. {4}/{5} pulled from cache.", result.Count, files.Length, query, searchType, amtFromCache, files.Length);

        return result;
    }

    public static ScreenshotMetadata? GetScreenshotMetadata(string path, bool includeJSON = false)
    {

        if (!File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal))
        {
            return null;
        }

        List<string> metadata = ReadTextMetadata(path);
        var result = new ScreenshotMetadata();

        for (int i = 0; i < metadata.Count; i++)
        {
            bool gotVrchatMetadata = false;
            try
            {
                string metadataString = metadata[i];

                if (metadataString.StartsWith("<x:xmpmeta", StringComparison.Ordinal))
                {
                    result = ParseVRCImage(metadataString);
                    result.SourceFile = path;

                    gotVrchatMetadata = true;
                }

                if (metadataString.StartsWith('{') && metadataString.EndsWith('}'))
                {
                    ScreenshotMetadata? vrcxMetadataResult = JsonConvert.DeserializeObject<ScreenshotMetadata>(metadataString);
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
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Failed to parse metadata for file '{0}\n---'{1}\n---", path, string.Join("\n", metadata));
                return ScreenshotMetadata.JustError(path, "Failed to parse metadata. Check log file for details.");
            }
        }

        return result.Application == null || metadata.Count == 0
            ? ScreenshotMetadata.JustError(path, "Image has no valid metadata.")
            : result;
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

    public static ScreenshotMetadata ParseVRCImage(string xmlString)
    {
        int index = xmlString.IndexOf("<x:xmpmeta", StringComparison.Ordinal);
        xmlString = xmlString[index..];
        var doc = new XmlDocument();
        doc.LoadXml(xmlString);
        XmlElement? root = doc.DocumentElement;
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

        return new ScreenshotMetadata
        {
            Application = creatorTool,
            Version = 1,
            Author = new ScreenshotMetadata.AuthorDetail
            {
                Id = authorId,
                DisplayName = authorName,
            },
            World = new ScreenshotMetadata.WorldDetail
            {
                Id = worldId,
                InstanceId = worldId,
                Name = worldDisplayName,
            },
            Timestamp = DateTime.TryParse(dateTime, System.Globalization.CultureInfo.InvariantCulture, out DateTime dt) ? dt : null,
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






    public static ScreenshotMetadata ParseLfsPicture(string metadataString)
    {
        var metadata = new ScreenshotMetadata();













        string[] lfsParts = metadataString.Split('|');
        if (string.Equals(lfsParts[1], "cvr", StringComparison.Ordinal))
        {
            lfsParts = [.. lfsParts.Skip(1)];
        }

        int version = int.Parse(lfsParts[1], System.Globalization.CultureInfo.InvariantCulture);
        string application = lfsParts[0];
        metadata.Application = application;
        metadata.Version = version;

        bool isCVR = string.Equals(application, "cvr", StringComparison.Ordinal);

        if (string.Equals(application, "screenshotmanager", StringComparison.Ordinal))
        {


            string[] author = lfsParts[2].Split(',');

            metadata.Author.Id = author[0];
            metadata.Author.DisplayName = author[1];

            string[] world = lfsParts[3].Split(',');

            metadata.World.Id = world[0];
            metadata.World.Name = world[2];
            metadata.World.InstanceId = string.Join(":", world[0], world[1]);
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
                    float.TryParse(parts[0], System.Globalization.CultureInfo.InvariantCulture, out float x);
                    float.TryParse(parts[1], System.Globalization.CultureInfo.InvariantCulture, out float y);
                    float.TryParse(parts[2], System.Globalization.CultureInfo.InvariantCulture, out float z);

                    metadata.Pos = new Vector3(x, y, z);
                    break;







                case "players":
                    List<ScreenshotMetadata.PlayerDetail> playersArray = metadata.Players;
                    string[] players = value.Split(';');

                    foreach (string player in players)
                    {
                        string[] playerParts = player.Split(',');

                        float.TryParse(playerParts[1], System.Globalization.CultureInfo.InvariantCulture, out float x2);
                        float.TryParse(playerParts[2], System.Globalization.CultureInfo.InvariantCulture, out float y2);
                        float.TryParse(playerParts[3], System.Globalization.CultureInfo.InvariantCulture, out float z2);

                        var playerDetail = new ScreenshotMetadata.PlayerDetail
                        {
                            Id = isCVR ? string.Empty : playerParts[0],
                            DisplayName = isCVR ? $"{playerParts[4]} ({playerParts[0]})" : playerParts[4],
                            Pos = new Vector3(x2, y2, z2),
                        };

                        playersArray.Add(playerDetail);
                    }
                    break;
                default:
                    break;
            }
        }

        return metadata;
    }
}
