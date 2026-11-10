using System.Buffers.Binary;
using System.Text;

namespace VRCX;

internal sealed class PNGChunk
{
    public int Index;
    public int Length;
    public string? ChunkType;
    public PNGChunkTypeFilter ChunkTypeEnum;
    public byte[]? Data;

    private static uint[]? crcTable;





    public bool IsZero() => Data == null || Data.Length == 0;






    public Tuple<string, string> ReadITXtChunk()
    {
        if (IsZero())
        {
            throw new Exception("Tried to read from invalid PNG chunk");
        }

        if (ChunkTypeEnum != PNGChunkTypeFilter.iTXt)
        {
            throw new Exception("Cannot read text from chunk type " + ChunkType);
        }

        int chunkLength = Length;
        byte[] chunkData = Data;

















        Encoding keywordEncoding = Encoding.UTF8;
        int keywordLength = 0;
        for (int i = 0; i < chunkLength; i++)
        {
            if (chunkData[i] == 0x0)
            {
                keywordLength = i;
                break;
            }
        }

        if (keywordLength == 0 || keywordLength > 79 || chunkLength < keywordLength)
        {
            return null;
        }

        string keyword = keywordEncoding.GetString(chunkData, 0, keywordLength);


        int textOffset = keywordLength + 5;
        int textLength = chunkLength - textOffset;

        return new Tuple<string, string>(keyword, Encoding.UTF8.GetString(chunkData, textOffset, textLength));
    }






    public Tuple<int, int> ReadIHDRChunkResolution()
    {
        if (IsZero())
        {
            throw new Exception("Tried to read from invalid PNG chunk");
        }

        if (ChunkTypeEnum != PNGChunkTypeFilter.IHDR)
        {
            throw new Exception("Cannot read text from chunk type " + ChunkType);
        }












        byte[] chunkData = Data;

        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(chunkData, 0, 4);
            Array.Reverse(chunkData, 4, 4);
        }

        int width = BitConverter.ToInt32(chunkData, 0);
        int height = BitConverter.ToInt32(chunkData, 4);

        return new Tuple<int, int>(width, height);
    }






    public bool ExistsInFile(FileStream fileStream)
    {
        fileStream.Seek(Index, SeekOrigin.Begin);

        byte[] buffer = new byte[4];
        fileStream.ReadExactly(buffer, 0, 4);

        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(buffer, 0, 4);
        }

        int chunkLength = BitConverter.ToInt32(buffer, 0);
        if (chunkLength != Length)
        {
            return false;
        }

        fileStream.Seek(4 + chunkLength, SeekOrigin.Current);
        fileStream.ReadExactly(buffer, 0, 4);

        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(buffer, 0, 4);
        }

        uint crc = BitConverter.ToUInt32(buffer, 0);
        uint calculatedCRC = CalculateCRC();

        return crc == calculatedCRC;
    }













    public byte[] GetBytes()
    {
        byte[] chunkTypeBytes = Encoding.ASCII.GetBytes(ChunkType);
        int totalLength = Data.Length + 12;
        byte[] result = new byte[totalLength];


        int chunkLength = BinaryPrimitives.ReverseEndianness(Data.Length);
        Buffer.BlockCopy(BitConverter.GetBytes(chunkLength), 0, result, 0, 4);


        Buffer.BlockCopy(chunkTypeBytes, 0, result, 4, chunkTypeBytes.Length);


        Buffer.BlockCopy(Data, 0, result, 8, Data.Length);


        uint crc = CalculateCRC();
        uint reversedCrc = BinaryPrimitives.ReverseEndianness(crc);

        Buffer.BlockCopy(BitConverter.GetBytes(reversedCrc), 0, result, totalLength - 4, 4);

        return result;
    }

    public uint CalculateCRC()
    {
        byte[] chunkTypeBytes = Encoding.UTF8.GetBytes(ChunkType);
        return Crc32(Data, 0, Data.Length, Crc32(chunkTypeBytes, 0, chunkTypeBytes.Length, 0));
    }



    private static uint Crc32(byte[] stream, int offset, int length, uint crc)
    {
        uint c;
        if (crcTable == null)
        {
            crcTable = new uint[256];
            for (uint n = 0; n <= 255; n++)
            {
                c = n;
                for (int k = 0; k <= 7; k++)
                {
                    c = (c & 1) == 1 ? 0xEDB88320 ^ ((c >> 1) & 0x7FFFFFFF) : (c >> 1) & 0x7FFFFFFF;
                }

                crcTable[n] = c;
            }
        }

        c = crc ^ 0xffffffff;
        int endOffset = offset + length;
        for (int i = offset; i < endOffset; i++)
        {
            c = crcTable[(c ^ stream[i]) & 255] ^ ((c >> 8) & 0xFFFFFF);
        }

        return c ^ 0xffffffff;
    }
}
