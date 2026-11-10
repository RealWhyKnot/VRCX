using System.Text;

namespace VRCX;



internal sealed class PNGFile : IDisposable
{
    private readonly FileStream fileStream;
    private readonly List<PNGChunk> metadataChunkCache = [];

    private static readonly byte[] pngSignatureBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private const int MAX_CHUNKS_TO_READ = 16;
    private const int CHUNK_FIELD_SIZE = 4;
    private const int CHUNK_NONDATA_SIZE = 12;







    public PNGFile(string filePath, bool writeAccess)
    {
        fileStream = new FileStream(filePath, FileMode.Open, writeAccess ? FileAccess.ReadWrite : FileAccess.Read, FileShare.ReadWrite, 4096);
    }

    public PNGFile(string filePath, int bufferSize)
    {
        fileStream = new FileStream(filePath, FileMode.Open, FileAccess.ReadWrite, FileShare.ReadWrite, bufferSize);
    }






    public PNGChunk? GetChunk(PNGChunkTypeFilter chunkTypeFilter)
    {
        ReadAndCacheMetadata();

        PNGChunk? chunk = metadataChunkCache.FirstOrDefault((chunk) => chunkTypeFilter.HasFlag(chunk.ChunkTypeEnum));
        return chunk == null || chunk.IsZero() ? null : chunk;
    }









    public PNGChunk? GetChunkReverse(PNGChunkTypeFilter chunkTypeFilter)
    {
        PNGChunk? chunk = ReadChunkReverse(chunkTypeFilter);
        return chunk == null || chunk.IsZero() ? null : chunk;
    }








    public List<PNGChunk> GetChunks()
    {
        ReadAndCacheMetadata();

        return [.. metadataChunkCache];
    }






    public bool WriteChunk(PNGChunk chunk)
    {
        ReadAndCacheMetadata();

        if (metadataChunkCache.Count == 0)
        {
            return false;
        }

        PNGChunk? lastChunk = metadataChunkCache.LastOrDefault();
        if (lastChunk.IsZero())
        {
            return false;
        }

        int newChunkPosition = lastChunk.Index + CHUNK_NONDATA_SIZE + lastChunk.Length;
        fileStream.Seek(newChunkPosition, SeekOrigin.Begin);

        byte[] fileBytes = new byte[fileStream.Length - newChunkPosition];
        fileStream.ReadExactly(fileBytes, 0, (int)(fileStream.Length - newChunkPosition));
        fileStream.Seek(newChunkPosition, SeekOrigin.Begin);


        byte[] chunkBytes = chunk.GetBytes();
        fileStream.SetLength(fileStream.Length + CHUNK_NONDATA_SIZE + chunk.Length);
        fileStream.Write(chunkBytes, 0, chunkBytes.Length);
        fileStream.Write(fileBytes, 0, fileBytes.Length);

        return true;
    }






    public bool DeleteChunk(PNGChunk chunk)
    {
        if (!chunk.ExistsInFile(fileStream))
        {
            return false;
        }

        int bufferSize = 128 * 1024;
        int deleteStart = chunk.Index;
        int deleteLength = chunk.Length + CHUNK_NONDATA_SIZE;

        long sourcePos = deleteStart + deleteLength;
        long destPos = deleteStart;
        byte[] buffer = new byte[bufferSize];


        while (sourcePos < fileStream.Length)
        {
            fileStream.Seek(sourcePos, SeekOrigin.Begin);
            int bytesRead = fileStream.Read(buffer, 0, Math.Min(buffer.Length, (int)(fileStream.Length - sourcePos)));

            if (bytesRead == 0)
            {
                break;
            }

            fileStream.Seek(destPos, SeekOrigin.Begin);
            fileStream.Write(buffer, 0, bytesRead);

            sourcePos += bytesRead;
            destPos += bytesRead;
        }

        fileStream.SetLength(fileStream.Length - deleteLength);

        metadataChunkCache.Remove(chunk);


        for (int i = 0; i < metadataChunkCache.Count; i++)
        {
            PNGChunk cachedChunk = metadataChunkCache[i];
            if (cachedChunk.Index > deleteStart)
            {
                cachedChunk.Index -= deleteLength;
            }
        }

        return true;
    }










    public List<PNGChunk> GetChunksOfType(PNGChunkTypeFilter chunkTypeFilter)
    {
        ReadAndCacheMetadata();

        return metadataChunkCache.FindAll((chunk) => chunk.ChunkTypeEnum.HasFlag(chunkTypeFilter));
    }










    private IEnumerable<PNGChunk> ReadChunks()
    {
        int currentIndex = pngSignatureBytes.Length;
        int chunksRead = 0;
        byte[] buffer = new byte[4];

        while (currentIndex < fileStream.Length)
        {
            if (chunksRead >= MAX_CHUNKS_TO_READ)
            {
                yield break;
            }

            chunksRead++;
            fileStream.Seek(currentIndex, SeekOrigin.Begin);


            fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);


            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(buffer, 0, 4);
            }

            int chunkLength = BitConverter.ToInt32(buffer, 0);
            if (chunkLength < 0 || chunkLength > fileStream.Length - currentIndex - CHUNK_NONDATA_SIZE)
            {
                yield break;
            }


            fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

            string chunkType = Encoding.ASCII.GetString(buffer, 0, CHUNK_FIELD_SIZE);


            if (string.Equals(chunkType, "IDAT", StringComparison.Ordinal))
            {
                yield break;
            }


            if (string.Equals(chunkType, "IEND", StringComparison.Ordinal))
            {
                yield break;
            }


            byte[] chunkData = new byte[chunkLength];
            fileStream.ReadExactly(chunkData, 0, chunkLength);




            var chunk = new PNGChunk
            {
                Length = chunkLength,
                ChunkType = chunkType,
                ChunkTypeEnum = ChunkNameToEnum(chunkType),
                Data = chunkData,
                Index = currentIndex,
            };

            yield return chunk;


            currentIndex += CHUNK_NONDATA_SIZE + chunkLength;
        }
    }










    private PNGChunk? ReadChunkReverse(PNGChunkTypeFilter chunkTypeFilter)
    {
        if (fileStream.Length < 8300)
        {
            return null;
        }

        byte[] searchChunkBytes = Encoding.ASCII.GetBytes(ChunkTypeEnumToChunkName(chunkTypeFilter));


        fileStream.Seek(fileStream.Length - 8192 - CHUNK_NONDATA_SIZE, SeekOrigin.Begin);

        byte[] trailingBytesBuffer = new byte[8192];
        fileStream.ReadExactly(trailingBytesBuffer, 0, 8192);

        for (int i = 0; i < trailingBytesBuffer.Length - searchChunkBytes.Length; i++)
        {
            if (trailingBytesBuffer[i] == searchChunkBytes[0] &&
                trailingBytesBuffer[i + 1] == searchChunkBytes[1] &&
                trailingBytesBuffer[i + 2] == searchChunkBytes[2] &&
                trailingBytesBuffer[i + 3] == searchChunkBytes[3])
            {
                fileStream.Seek(fileStream.Length - trailingBytesBuffer.Length - CHUNK_NONDATA_SIZE + i - CHUNK_FIELD_SIZE, SeekOrigin.Begin);

                byte[] buffer = new byte[4];


                fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);


                if (BitConverter.IsLittleEndian)
                {
                    Array.Reverse(buffer, 0, 4);
                }

                int chunkLength = BitConverter.ToInt32(buffer, 0);
                if (chunkLength < 0 || chunkLength > fileStream.Length - i - CHUNK_NONDATA_SIZE)
                {
                    return null;
                }


                fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

                string chunkType = Encoding.ASCII.GetString(buffer, 0, CHUNK_FIELD_SIZE);


                byte[] chunkData = new byte[chunkLength];
                fileStream.ReadExactly(chunkData, 0, chunkLength);


                fileStream.Seek(CHUNK_FIELD_SIZE, SeekOrigin.Current);

                var chunk = new PNGChunk
                {
                    Length = chunkLength,
                    ChunkType = chunkType,
                    ChunkTypeEnum = ChunkNameToEnum(chunkType),
                    Data = chunkData,
                };

                return chunk;
            }
        }

        return null;
    }








    private void ReadAndCacheMetadata()
    {
        if (metadataChunkCache.Count > 0)
        {
            return;
        }

        if (!IsValid())
        {
            return;
        }


        metadataChunkCache.AddRange(ReadChunks());
    }

    private PNGChunkTypeFilter ChunkNameToEnum(string chunkType)
    {
        switch (chunkType)
        {
            case "IHDR":
                return PNGChunkTypeFilter.IHDR;
            case "sRGB":
                return PNGChunkTypeFilter.sRGB;
            case "iTXt":
                return PNGChunkTypeFilter.iTXt;
            case "IDAT":
                return PNGChunkTypeFilter.IDAT;
            case "IEND":
                return PNGChunkTypeFilter.IEND;
            default:
                break;
        }

        return PNGChunkTypeFilter.UNKNOWN;
    }

    private string ChunkTypeEnumToChunkName(PNGChunkTypeFilter chunkType)
    {
        switch (chunkType)
        {
            case PNGChunkTypeFilter.IHDR:
                return "IHDR";
            case PNGChunkTypeFilter.sRGB:
                return "sRGB";
            case PNGChunkTypeFilter.iTXt:
                return "iTXt";
            case PNGChunkTypeFilter.IDAT:
                return "IDAT";
            case PNGChunkTypeFilter.IEND:
                return "IEND";
            case PNGChunkTypeFilter.UNKNOWN:
                break;
            default:
                break;
        }

        return null;
    }





    public bool IsValid()
    {
        if (fileStream.Length < 57)
        {
            return false;
        }

        byte[] signature = new byte[8];
        return fileStream.Read(signature, 0, 8) >= 8 && signature.SequenceEqual(pngSignatureBytes);
    }




    public void Dispose() => fileStream.Dispose();
}
