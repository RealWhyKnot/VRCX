using System.Buffers.Binary;
using SkiaSharp;

namespace VRCX.Imaging;

internal static class PngAnimationDecoder
{
    public static bool TryDecode(byte[] data, out List<(SKBitmap Bitmap, int Duration)> frames, out int repeatCount)
    {
        frames = [];
        repeatCount = 0;
        if (data.Length < 33 || data[0] != 137 || !data.AsSpan(1, 3).SequenceEqual("PNG"u8))
        {
            return false;
        }

        bool animated = false;
        int offset = 33;
        while (offset <= data.Length - 12)
        {
            int length = ReadLength(data, offset);
            if (data.AsSpan(offset + 4, 4).SequenceEqual("acTL"u8) && length == 8)
            {
                uint repetitions = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(offset + 12));
                repeatCount = repetitions == 0 ? -1 : checked((int)repetitions - 1);
                animated = true;
                break;
            }
            offset += length + 12;
        }
        if (!animated)
        {
            return false;
        }

        DecodeFrames(data, frames);
        return frames.Count > 0;
    }

    private static void DecodeFrames(byte[] data, List<(SKBitmap Bitmap, int Duration)> frames)
    {
        int width = checked((int)BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(16)));
        int height = checked((int)BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(20)));
        using var canvas = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        canvas.Erase(SKColors.Transparent);
        using var shared = new MemoryStream();
        using var compressed = new MemoryStream();
        byte[]? control = null;
        int offset = 33;
        while (offset <= data.Length - 12)
        {
            int length = ReadLength(data, offset);
            ReadOnlySpan<byte> type = data.AsSpan(offset + 4, 4);
            if (type.SequenceEqual("fcTL"u8) || type.SequenceEqual("IEND"u8))
            {
                if (control is not null)
                {
                    DrawFrame(data, canvas, control, shared.ToArray(), compressed.ToArray(), frames);
                    compressed.SetLength(0);
                }
                control = type.SequenceEqual("fcTL"u8) ? data.AsSpan(offset + 8, length).ToArray() : null;
            }
            else if (type.SequenceEqual("PLTE"u8) || type.SequenceEqual("tRNS"u8))
            {
                shared.Write(data.AsSpan(offset, length + 12));
            }
            else if (control is not null && type.SequenceEqual("IDAT"u8))
            {
                compressed.Write(data.AsSpan(offset + 8, length));
            }
            else if (control is not null && type.SequenceEqual("fdAT"u8) && length >= 4)
            {
                compressed.Write(data.AsSpan(offset + 12, length - 4));
            }
            offset += length + 12;
        }
    }

    private static void DrawFrame(byte[] data, SKBitmap canvas, byte[] control, byte[] shared, byte[] compressed, List<(SKBitmap Bitmap, int Duration)> frames)
    {
        if (control.Length != 26)
        {
            throw new InvalidDataException("Invalid PNG frame control.");
        }
        using var encoded = new MemoryStream();
        encoded.Write(data.AsSpan(0, 8));
        byte[] header = data.AsSpan(16, 13).ToArray();
        control.AsSpan(4, 8).CopyTo(header);
        encoded.Write(ImageMetadata.CreateChunk("IHDR"u8, header));
        encoded.Write(shared);
        encoded.Write(ImageMetadata.CreateChunk("IDAT"u8, compressed));
        encoded.Write(ImageMetadata.CreateChunk("IEND"u8, []));
        using SKBitmap frame = SKBitmap.Decode(encoded.ToArray()) ?? throw new InvalidDataException("Invalid PNG frame.");
        int x = checked((int)BinaryPrimitives.ReadUInt32BigEndian(control.AsSpan(12)));
        int y = checked((int)BinaryPrimitives.ReadUInt32BigEndian(control.AsSpan(16)));
        using SKBitmap previous = canvas.Copy();
        using var drawing = new SKCanvas(canvas);
        using var paint = new SKPaint { BlendMode = control[25] == 0 ? SKBlendMode.Src : SKBlendMode.SrcOver };
        using var image = SKImage.FromBitmap(frame);
        drawing.DrawImage(image, x, y, new SKSamplingOptions(SKFilterMode.Nearest), paint);
        int numerator = BinaryPrimitives.ReadUInt16BigEndian(control.AsSpan(20));
        int denominator = BinaryPrimitives.ReadUInt16BigEndian(control.AsSpan(22));
        frames.Add((canvas.Copy(), (int)Math.Round(numerator * 1000.0 / (denominator == 0 ? 100 : denominator))));
        paint.BlendMode = SKBlendMode.Src;
        if (control[24] == 1)
        {
            paint.Color = SKColors.Transparent;
            drawing.DrawRect(SKRect.Create(x, y, frame.Width, frame.Height), paint);
        }
        else if (control[24] == 2)
        {
            using var restored = SKImage.FromBitmap(previous);
            drawing.DrawImage(restored, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest), paint);
        }
    }

    private static int ReadLength(byte[] data, int offset)
    {
        uint length = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(offset));
        return length > data.Length - offset - 12
            ? throw new InvalidDataException("Invalid PNG chunk length.")
            : (int)length;
    }
}
