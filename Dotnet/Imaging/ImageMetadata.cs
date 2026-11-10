using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using TiffLibrary;

namespace VRCX.Imaging;

internal sealed class ImageMetadata
{
    private readonly List<byte[]> _chunks = [];

    public static ImageMetadata Read(byte[] data)
    {
        var metadata = new ImageMetadata();
        if (data.Length >= 8 && data[0] == 137 && data.AsSpan(1, 3).SequenceEqual("PNG"u8))
        {
            metadata.ReadPng(data);
        }
        else if (data.Length > 4 && data[0] == 255 && data[1] == 216)
        {
            metadata.ReadJpeg(data);
        }
        else if (data.Length >= 12 && data.AsSpan(0, 4).SequenceEqual("RIFF"u8) && data.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            metadata.ReadWebp(data);
        }
        else if (data.Length >= 46 && data.AsSpan(0, 2).SequenceEqual("BM"u8))
        {
            metadata.ReadBmp(data);
        }
        else if (ExtraImageDecoder.IsTiff(data))
        {
            metadata.ReadTiff(data);
        }
        else if (data.Length >= 14 && data.AsSpan(0, 4).SequenceEqual("qoif"u8))
        {
            metadata.AddResolution(BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(4)), BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(8)), perMeter: false);
        }
        return metadata;
    }

    private void ReadPng(byte[] data)
    {

        int offset = 8;
        while (offset <= data.Length - 12)
        {
            uint length = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(offset));
            if (length > data.Length - offset - 12)
            {
                throw new InvalidDataException("Invalid PNG chunk length.");
            }
            string type = Encoding.ASCII.GetString(data, offset + 4, 4);
            if (type is "pHYs" or "eXIf" or "iCCP" or "tEXt" or "zTXt" or "iTXt" or "gAMA")
            {
                _chunks.Add(data.AsSpan(offset, (int)length + 12).ToArray());
            }
            offset += (int)length + 12;
        }

    }

    private void ReadJpeg(byte[] data)
    {

        using var profile = new MemoryStream();
        int offset = 2;
        while (offset + 4 <= data.Length && data[offset] == 255)
        {
            byte marker = data[offset + 1];
            if (marker is 218 or 217)
            {
                break;
            }
            int length = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 2));
            if (length < 2 || offset + 2 + length > data.Length)
            {
                throw new InvalidDataException("Invalid JPEG segment length.");
            }
            if (marker == 225 && length >= 8 && data.AsSpan(offset + 4, 6).SequenceEqual("Exif\0\0"u8))
            {
                _chunks.Add(CreateChunk("eXIf"u8, data.AsSpan(offset + 10, length - 8)));
            }
            else if (marker == 226 && length >= 16 && data.AsSpan(offset + 4, 12).SequenceEqual("ICC_PROFILE\0"u8))
            {
                profile.Write(data.AsSpan(offset + 18, length - 16));
            }
            else if (marker == 224 && length >= 16 && data.AsSpan(offset + 4, 5).SequenceEqual("JFIF\0"u8))
            {
                byte units = data[offset + 11];
                double factor = units == 1 ? 100 / 2.54 : 100;
                byte[] resolution = new byte[9];
                BinaryPrimitives.WriteUInt32BigEndian(resolution, (uint)Math.Round(BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 12)) * (units == 0 ? 1 : factor)));
                BinaryPrimitives.WriteUInt32BigEndian(resolution.AsSpan(4), (uint)Math.Round(BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 14)) * (units == 0 ? 1 : factor)));
                resolution[8] = units == 0 ? (byte)0 : (byte)1;
                _chunks.Add(CreateChunk("pHYs"u8, resolution));
            }
            offset += length + 2;
        }
        if (profile.Length > 0)
        {
            AddColorProfile(profile.ToArray());
        }

    }

    private void ReadWebp(byte[] data)
    {

        int offset = 12;
        while (offset <= data.Length - 8)
        {
            uint length = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(offset + 4));
            if (length > data.Length - offset - 8)
            {
                throw new InvalidDataException("Invalid WebP chunk length.");
            }
            if (data.AsSpan(offset, 4).SequenceEqual("EXIF"u8))
            {
                ReadOnlySpan<byte> exif = data.AsSpan(offset + 8, (int)length);
                _chunks.Add(CreateChunk("eXIf"u8, exif.StartsWith("Exif\0\0"u8) ? exif[6..] : exif));
            }
            else if (data.AsSpan(offset, 4).SequenceEqual("ICCP"u8))
            {
                AddColorProfile(data.AsSpan(offset + 8, (int)length));
            }
            offset += 8 + (int)length + (int)(length & 1);
        }

    }

    private void ReadBmp(byte[] data)
    {

        int horizontal = BinaryPrimitives.ReadInt32LittleEndian(data.AsSpan(38));
        int vertical = BinaryPrimitives.ReadInt32LittleEndian(data.AsSpan(42));
        if (horizontal > 0 && vertical > 0)
        {
            AddResolution(horizontal, vertical, perMeter: true);
        }

    }

    private void ReadTiff(byte[] data)
    {

        using var reader = TiffFileReader.Open(data);
        using TiffFieldReader fields = reader.CreateFieldReader();
        var tags = new TiffTagReader(fields, reader.ReadImageFileDirectory());
        TiffResolutionUnit units = tags.ReadResolutionUnit();
        double horizontal = tags.ReadXResolution()?.ToDouble() ?? 96;
        double vertical = tags.ReadYResolution()?.ToDouble() ?? 96;
        double factor = units == TiffResolutionUnit.Inch ? 100 / 2.54 : units == TiffResolutionUnit.Centimeter ? 100 : 1;
        AddResolution(horizontal * factor, vertical * factor, perMeter: factor != 1);

    }

    public byte[] Apply(byte[] png)
    {
        using var output = new MemoryStream();
        output.Write(png.AsSpan(0, 33));
        bool hasResolution = false;
        foreach (byte[] chunk in _chunks)
        {
            hasResolution |= chunk.AsSpan(4, 4).SequenceEqual("pHYs"u8);
            output.Write(chunk);
        }
        if (!hasResolution)
        {
            output.Write(CreateChunk("pHYs"u8, [0, 0, 14, 196, 0, 0, 14, 196, 1]));
        }
        int offset = 33;
        while (offset <= png.Length - 12)
        {
            int length = checked((int)BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(offset)));
            if (!png.AsSpan(offset + 4, 4).SequenceEqual("sBIT"u8))
            {
                output.Write(png.AsSpan(offset, length + 12));
            }
            offset += length + 12;
        }
        return output.ToArray();
    }

    private void AddColorProfile(ReadOnlySpan<byte> profile)
    {
        using var output = new MemoryStream();
        output.Write("ICC Profile\0\0"u8);
        using (var compressed = new ZLibStream(output, CompressionLevel.Optimal, leaveOpen: true))
        {
            compressed.Write(profile);
        }
        _chunks.Add(CreateChunk("iCCP"u8, output.ToArray()));
    }

    private void AddResolution(double horizontal, double vertical, bool perMeter)
    {
        byte[] resolution = new byte[9];
        BinaryPrimitives.WriteUInt32BigEndian(resolution, (uint)Math.Round(horizontal));
        BinaryPrimitives.WriteUInt32BigEndian(resolution.AsSpan(4), (uint)Math.Round(vertical));
        resolution[8] = perMeter ? (byte)1 : (byte)0;
        _chunks.Add(CreateChunk("pHYs"u8, resolution));
    }

    internal static byte[] CreateChunk(ReadOnlySpan<byte> type, ReadOnlySpan<byte> content)
    {
        byte[] chunk = new byte[content.Length + 12];
        BinaryPrimitives.WriteUInt32BigEndian(chunk, (uint)content.Length);
        type.CopyTo(chunk.AsSpan(4));
        content.CopyTo(chunk.AsSpan(8));
        uint crc = uint.MaxValue;
        foreach (byte value in chunk.AsSpan(4, content.Length + 4))
        {
            crc ^= value;
            for (int bit = 0; bit < 8; bit++)
            {
                crc = (crc >> 1) ^ ((crc & 1) == 0 ? 0 : 0xedb88320U);
            }
        }
        BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(content.Length + 8), ~crc);
        return chunk;
    }
}
