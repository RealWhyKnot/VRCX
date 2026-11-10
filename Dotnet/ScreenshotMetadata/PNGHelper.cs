using System.Text;

namespace VRCX;

internal static class PNGHelper
{
    public static string ReadResolution(PNGFile pngFile)
    {
        PNGChunk? ihdrChunk = pngFile.GetChunk(PNGChunkTypeFilter.IHDR);
        if (ihdrChunk != null)
        {
            Tuple<int, int> resolution = ihdrChunk.ReadIHDRChunkResolution();
            return resolution.Item1 + "x" + resolution.Item2;
        }

        return "0x0";
    }












    public static string? ReadTextChunk(string keyword, PNGFile pngFile, bool legacySearch = false)
    {

        if (legacySearch)
        {
            PNGChunk? legacyTextChunk = pngFile.GetChunkReverse(PNGChunkTypeFilter.iTXt);
            if (legacyTextChunk != null)
            {
                Tuple<string, string> data = legacyTextChunk.ReadITXtChunk();
                if (string.Equals(data.Item1, keyword, StringComparison.Ordinal))
                {
                    return data.Item2;
                }
            }

            return null;
        }

        List<PNGChunk> iTXtChunk = pngFile.GetChunksOfType(PNGChunkTypeFilter.iTXt);
        if (iTXtChunk.Count == 0)
        {
            return null;
        }

        for (int i = 0; i < iTXtChunk.Count; i++)
        {
            Tuple<string, string> data = iTXtChunk[i].ReadITXtChunk();
            if (string.Equals(data.Item1, keyword, StringComparison.Ordinal))
            {
                return data.Item2;
            }
        }

        return null;
    }

    public static bool DeleteTextChunk(string keyword, PNGFile pngFile)
    {
        List<PNGChunk> iTXtChunk = pngFile.GetChunksOfType(PNGChunkTypeFilter.iTXt);
        if (iTXtChunk.Count == 0)
        {
            return false;
        }

        for (int i = 0; i < iTXtChunk.Count; i++)
        {
            Tuple<string, string> data = iTXtChunk[i].ReadITXtChunk();
            if (string.Equals(data.Item1, keyword, StringComparison.Ordinal))
            {
                return pngFile.DeleteChunk(iTXtChunk[i]);
            }
        }

        return false;
    }







    public static PNGChunk GenerateTextChunk(string keyword, string text)
    {
        byte[] textBytes = Encoding.UTF8.GetBytes(text);
        byte[] keywordBytes = Encoding.UTF8.GetBytes(keyword);

        List<byte> constructedTextChunk =
        [
            .. keywordBytes,
            0x0,
            0x0,
            0x0,
            0x0,
            0x0,
            .. textBytes,
        ];

        return new PNGChunk
        {
            ChunkType = "iTXt",
            ChunkTypeEnum = PNGChunkTypeFilter.iTXt,
            Data = [.. constructedTextChunk],
            Length = constructedTextChunk.Count,
        };
    }
}
