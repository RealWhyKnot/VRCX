using System.Buffers.Binary;

namespace VRCX.Imaging;

internal static class AnimatedPng
{
    public static byte[] Encode(byte[] first, int duration, int repeatCount, List<(ImageRaster Image, int Duration)> frames)
    {
        using var output = new MemoryStream();
        output.Write(first.AsSpan(0, 33));
        byte[] animation = new byte[8];
        BinaryPrimitives.WriteUInt32BigEndian(animation, (uint)frames.Count + 1);
        BinaryPrimitives.WriteUInt32BigEndian(animation.AsSpan(4), repeatCount < 0 ? 0 : (uint)repeatCount + 1);
        output.Write(ImageMetadata.CreateChunk("acTL"u8, animation));
        uint sequence = 0;
        WriteFrame(output, first, duration, isFirst: true, ref sequence);
        foreach ((ImageRaster frame, int delay) in frames)
        {
            WriteFrame(output, frame.EncodePng(), delay, isFirst: false, ref sequence);
        }
        output.Write(ImageMetadata.CreateChunk("IEND"u8, []));
        return output.ToArray();
    }

    private static void WriteFrame(Stream output, byte[] png, int duration, bool isFirst, ref uint sequence)
    {
        byte[] control = new byte[26];
        BinaryPrimitives.WriteUInt32BigEndian(control, sequence++);
        png.AsSpan(16, 8).CopyTo(control.AsSpan(4));
        BinaryPrimitives.WriteUInt16BigEndian(control.AsSpan(20), (ushort)Math.Clamp(duration / 10, 0, ushort.MaxValue));
        BinaryPrimitives.WriteUInt16BigEndian(control.AsSpan(22), 100);
        output.Write(ImageMetadata.CreateChunk("fcTL"u8, control));
        int offset = 33;
        while (offset < png.Length - 12)
        {
            int length = checked((int)BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(offset)));
            ReadOnlySpan<byte> type = png.AsSpan(offset + 4, 4);
            if (type.SequenceEqual("IDAT"u8))
            {
                if (isFirst)
                {
                    output.Write(png.AsSpan(offset, length + 12));
                }
                else
                {
                    byte[] frame = new byte[length + 4];
                    BinaryPrimitives.WriteUInt32BigEndian(frame, sequence++);
                    png.AsSpan(offset + 8, length).CopyTo(frame.AsSpan(4));
                    output.Write(ImageMetadata.CreateChunk("fdAT"u8, frame));
                }
            }
            else if (isFirst)
            {
                output.Write(png.AsSpan(offset, length + 12));
            }
            offset += length + 12;
        }
    }
}
