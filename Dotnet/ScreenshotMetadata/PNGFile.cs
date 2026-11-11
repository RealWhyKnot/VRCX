using System.Text;

namespace VRCX.ScreenshotMetadata;

internal sealed class PNGFile : IDisposable
{
    private static readonly byte[] PngSignatureBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private const int MAX_CHUNKS_TO_READ = 16;
    private const int CHUNK_FIELD_SIZE = 4;
    private const int CHUNK_NONDATA_SIZE = 12;

    private readonly FileStream _fileStream;
    private readonly List<PNGChunk> _metadataChunkCache = [];

    public PNGFile(string filePath, bool writeAccess)
    {
        _fileStream = new FileStream(filePath, FileMode.Open, writeAccess ? FileAccess.ReadWrite : FileAccess.Read, FileShare.ReadWrite, 4096);
    }

    public PNGFile(string filePath, int bufferSize)
    {
        _fileStream = new FileStream(filePath, FileMode.Open, FileAccess.ReadWrite, FileShare.ReadWrite, bufferSize);
    }

    public PNGChunk? GetChunk(PNGChunkTypeFilter chunkTypeFilter)
    {
        ReadAndCacheMetadata();

        PNGChunk? chunk = _metadataChunkCache.FirstOrDefault(candidate => chunkTypeFilter.HasFlag(candidate.ChunkTypeEnum));
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

        return [.. _metadataChunkCache];
    }

    public bool WriteChunk(PNGChunk chunk)
    {
        ReadAndCacheMetadata();

        if (_metadataChunkCache.Count == 0)
        {
            return false;
        }

        PNGChunk lastChunk = _metadataChunkCache[^1];
        if (lastChunk.IsZero())
        {
            return false;
        }

        int newChunkPosition = lastChunk.Index + CHUNK_NONDATA_SIZE + lastChunk.Length;
        _fileStream.Seek(newChunkPosition, SeekOrigin.Begin);

        byte[] fileBytes = new byte[_fileStream.Length - newChunkPosition];
        _fileStream.ReadExactly(fileBytes, 0, (int)(_fileStream.Length - newChunkPosition));
        _fileStream.Seek(newChunkPosition, SeekOrigin.Begin);

        byte[] chunkBytes = chunk.GetBytes();
        _fileStream.SetLength(_fileStream.Length + CHUNK_NONDATA_SIZE + chunk.Length);
        _fileStream.Write(chunkBytes, 0, chunkBytes.Length);
        _fileStream.Write(fileBytes, 0, fileBytes.Length);

        return true;
    }

    public bool DeleteChunk(PNGChunk chunk)
    {
        if (!chunk.ExistsInFile(_fileStream))
        {
            return false;
        }

        int bufferSize = 128 * 1024;
        int deleteStart = chunk.Index;
        int deleteLength = chunk.Length + CHUNK_NONDATA_SIZE;

        long sourcePos = deleteStart + deleteLength;
        long destPos = deleteStart;
        byte[] buffer = new byte[bufferSize];

        while (sourcePos < _fileStream.Length)
        {
            _fileStream.Seek(sourcePos, SeekOrigin.Begin);
            int bytesRead = _fileStream.Read(buffer, 0, Math.Min(buffer.Length, (int)(_fileStream.Length - sourcePos)));

            if (bytesRead == 0)
            {
                break;
            }

            _fileStream.Seek(destPos, SeekOrigin.Begin);
            _fileStream.Write(buffer, 0, bytesRead);

            sourcePos += bytesRead;
            destPos += bytesRead;
        }

        _fileStream.SetLength(_fileStream.Length - deleteLength);

        _metadataChunkCache.Remove(chunk);

        for (int i = 0; i < _metadataChunkCache.Count; i++)
        {
            PNGChunk cachedChunk = _metadataChunkCache[i];
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

        return _metadataChunkCache.FindAll(chunk => chunk.ChunkTypeEnum.HasFlag(chunkTypeFilter));
    }

    private IEnumerable<PNGChunk> ReadChunks()
    {
        int currentIndex = PngSignatureBytes.Length;
        int chunksRead = 0;

        while (currentIndex < _fileStream.Length && chunksRead < MAX_CHUNKS_TO_READ)
        {
            chunksRead++;
            PNGChunk? chunk = ReadChunkAt(currentIndex);
            if (chunk == null)
            {
                yield break;
            }

            yield return chunk;

            currentIndex += CHUNK_NONDATA_SIZE + chunk.Length;
        }
    }

    private PNGChunk? ReadChunkAt(int currentIndex)
    {
        byte[] buffer = new byte[4];
        _fileStream.Seek(currentIndex, SeekOrigin.Begin);
        _fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(buffer, 0, 4);
        }

        int chunkLength = BitConverter.ToInt32(buffer, 0);
        if (chunkLength < 0 || chunkLength > _fileStream.Length - currentIndex - CHUNK_NONDATA_SIZE)
        {
            return null;
        }

        _fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

        string chunkType = Encoding.ASCII.GetString(buffer, 0, CHUNK_FIELD_SIZE);
        if (chunkType is "IDAT" or "IEND")
        {
            return null;
        }

        byte[] chunkData = new byte[chunkLength];
        _fileStream.ReadExactly(chunkData, 0, chunkLength);

        return new PNGChunk
        {
            Length = chunkLength,
            ChunkType = chunkType,
            ChunkTypeEnum = ChunkNameToEnum(chunkType),
            Data = chunkData,
            Index = currentIndex,
        };
    }

    private PNGChunk? ReadChunkReverse(PNGChunkTypeFilter chunkTypeFilter)
    {
        if (_fileStream.Length < 8300)
        {
            return null;
        }

        byte[] searchChunkBytes = Encoding.ASCII.GetBytes(ChunkTypeEnumToChunkName(chunkTypeFilter));

        _fileStream.Seek(_fileStream.Length - 8192 - CHUNK_NONDATA_SIZE, SeekOrigin.Begin);

        byte[] trailingBytesBuffer = new byte[8192];
        _fileStream.ReadExactly(trailingBytesBuffer, 0, 8192);

        for (int i = 0; i < trailingBytesBuffer.Length - searchChunkBytes.Length; i++)
        {
            if (trailingBytesBuffer[i] == searchChunkBytes[0] &&
                trailingBytesBuffer[i + 1] == searchChunkBytes[1] &&
                trailingBytesBuffer[i + 2] == searchChunkBytes[2] &&
                trailingBytesBuffer[i + 3] == searchChunkBytes[3])
            {
                return ReadChunkFromTrailer(trailingBytesBuffer.Length, i);
            }
        }

        return null;
    }

    private PNGChunk? ReadChunkFromTrailer(int trailingLength, int matchIndex)
    {
        _fileStream.Seek(_fileStream.Length - trailingLength - CHUNK_NONDATA_SIZE + matchIndex - CHUNK_FIELD_SIZE, SeekOrigin.Begin);

        byte[] buffer = new byte[4];
        _fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(buffer, 0, 4);
        }

        int chunkLength = BitConverter.ToInt32(buffer, 0);
        if (chunkLength < 0 || chunkLength > _fileStream.Length - matchIndex - CHUNK_NONDATA_SIZE)
        {
            return null;
        }

        _fileStream.ReadExactly(buffer, 0, CHUNK_FIELD_SIZE);

        string chunkType = Encoding.ASCII.GetString(buffer, 0, CHUNK_FIELD_SIZE);

        byte[] chunkData = new byte[chunkLength];
        _fileStream.ReadExactly(chunkData, 0, chunkLength);

        _fileStream.Seek(CHUNK_FIELD_SIZE, SeekOrigin.Current);

        return new PNGChunk
        {
            Length = chunkLength,
            ChunkType = chunkType,
            ChunkTypeEnum = ChunkNameToEnum(chunkType),
            Data = chunkData,
        };
    }

    private void ReadAndCacheMetadata()
    {
        if (_metadataChunkCache.Count > 0)
        {
            return;
        }

        if (!IsValid())
        {
            return;
        }

        _metadataChunkCache.AddRange(ReadChunks());
    }

    private static PNGChunkTypeFilter ChunkNameToEnum(string chunkType) => chunkType switch
    {
        "IHDR" => PNGChunkTypeFilter.IHDR,
        "sRGB" => PNGChunkTypeFilter.sRGB,
        "iTXt" => PNGChunkTypeFilter.iTXt,
        "IDAT" => PNGChunkTypeFilter.IDAT,
        "IEND" => PNGChunkTypeFilter.IEND,
        _ => PNGChunkTypeFilter.UNKNOWN,
    };

    private static string ChunkTypeEnumToChunkName(PNGChunkTypeFilter chunkType) => chunkType switch
    {
        PNGChunkTypeFilter.IHDR => "IHDR",
        PNGChunkTypeFilter.sRGB => "sRGB",
        PNGChunkTypeFilter.iTXt => "iTXt",
        PNGChunkTypeFilter.IDAT => "IDAT",
        PNGChunkTypeFilter.IEND => "IEND",
        PNGChunkTypeFilter.UNKNOWN or _ => throw new ArgumentOutOfRangeException(nameof(chunkType), chunkType, "No PNG chunk name for this type"),
    };

    public bool IsValid()
    {
        if (_fileStream.Length < 57)
        {
            return false;
        }

        byte[] signature = new byte[8];
        return _fileStream.Read(signature, 0, 8) >= 8 && signature.SequenceEqual(PngSignatureBytes);
    }

    public void Dispose() => _fileStream.Dispose();
}
