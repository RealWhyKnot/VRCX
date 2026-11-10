using Pfim;
using QoiSharp;
using SkiaSharp;
using TiffLibrary;
using TiffLibrary.PixelFormats;

namespace VRCX.Imaging;

internal static class ExtraImageDecoder
{
    public static SKBitmap Decode(byte[] data)
    {
        if (data.AsSpan().StartsWith("qoif"u8))
        {
            QoiImage image = QoiDecoder.Decode(data);
            int channels = (int)image.Channels;
            var bitmap = new SKBitmap(image.Width, image.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
            for (int y = 0; y < image.Height; y++)
            {
                for (int x = 0; x < image.Width; x++)
                {
                    int index = ((y * image.Width) + x) * channels;
                    bitmap.SetPixel(x, y, new SKColor(image.Data[index], image.Data[index + 1], image.Data[index + 2], channels == 4 ? image.Data[index + 3] : (byte)255));
                }
            }
            return bitmap;
        }
        return data.Length > 2 && data[0] == 'P' && data[1] is >= (byte)'1' and <= (byte)'6'
            ? NetpbmDecoder.Decode(data)
            : data.Length >= 18 && data[1] <= 1 && data[2] is 1 or 2 or 3 or 9 or 10 or 11
                ? DecodeTga(data)
                : throw new InvalidDataException("Unsupported image format.");
    }

    public static bool IsTiff(byte[] data) => data.AsSpan().StartsWith("II*\0"u8) || data.AsSpan().StartsWith("MM\0*"u8)
        || data.AsSpan().StartsWith("II+\0"u8) || data.AsSpan().StartsWith("MM\0+"u8);

    public static List<SKBitmap> DecodeTiffFrames(byte[] data)
    {
        using var reader = TiffFileReader.Open(data);
        List<SKBitmap> frames = [];
        var visited = new HashSet<long>();
        TiffStreamOffset offset = reader.FirstImageFileDirectoryOffset;
        while (!offset.IsZero)
        {
            if (!visited.Add(offset.Offset))
            {
                throw new InvalidDataException("Invalid TIFF directory loop.");
            }
            TiffImageFileDirectory directory = reader.ReadImageFileDirectory(offset);
            frames.Add(DecodeTiffFrame(reader.CreateImageDecoder(directory)));
            offset = directory.NextOffset;
        }
        return frames.Count == 0 ? throw new InvalidDataException("TIFF image has no frames.") : frames;
    }

    private static SKBitmap DecodeTiffFrame(TiffImageDecoder decoder)
    {
        var pixels = new TiffRgba32[checked(decoder.Width * decoder.Height)];
        var buffer = new TiffMemoryPixelBuffer<TiffRgba32>(pixels, decoder.Width, decoder.Height, writable: true);
        decoder.Decode(buffer);
        var bitmap = new SKBitmap(decoder.Width, decoder.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        for (int y = 0; y < decoder.Height; y++)
        {
            for (int x = 0; x < decoder.Width; x++)
            {
                TiffRgba32 pixel = pixels[(y * decoder.Width) + x];
                bitmap.SetPixel(x, y, new SKColor(pixel.R, pixel.G, pixel.B, pixel.A));
            }
        }
        return bitmap;
    }

    private static SKBitmap DecodeTga(byte[] data)
    {
        bool top = (data[17] & 32) != 0;
        bool right = (data[17] & 16) != 0;
        byte[] bottomLeft = (byte[])data.Clone();
        bottomLeft[17] &= 207;
        using var stream = new MemoryStream(bottomLeft);
        using IImage image = Pfimage.FromStream(stream);
        SKBitmap? bitmap = null;
        try
        {
            bitmap = new SKBitmap(image.Width, image.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
            for (int y = 0; y < image.Height; y++)
            {
                for (int x = 0; x < image.Width; x++)
                {
                    int row = top ? image.Height - y - 1 : y;
                    int column = right ? image.Width - x - 1 : x;
                    int index = (row * image.Stride) + (column * image.BitsPerPixel / 8);
                    byte[] pixels = image.Data;
                    SKColor color = image.Format switch
                    {
                        ImageFormat.Rgba32 => new SKColor(pixels[index + 2], pixels[index + 1], pixels[index], pixels[index + 3]),
                        ImageFormat.Rgb24 => new SKColor(pixels[index + 2], pixels[index + 1], pixels[index]),
                        ImageFormat.Rgb8 => new SKColor(pixels[index], pixels[index], pixels[index]),
                        ImageFormat.R5g5b5 or ImageFormat.R5g5b5a1 => DecodePackedColor(pixels[index] | (pixels[index + 1] << 8), image.Format == ImageFormat.R5g5b5a1),
                        ImageFormat.R5g6b5 or ImageFormat.Rgba16 or ImageFormat.R16f or ImageFormat.R32f => throw new InvalidDataException("Unsupported TGA pixel format."),
                        _ => throw new InvalidDataException("Unsupported TGA pixel format."),
                    };
                    bitmap.SetPixel(x, y, color);
                }
            }
            SKBitmap result = bitmap;
            bitmap = null;
            return result;
        }
        finally
        {
            bitmap?.Dispose();
        }
    }

    private static SKColor DecodePackedColor(int value, bool alpha) => new(
        (byte)(((value >> 10) & 31) * 255 / 31),
        (byte)(((value >> 5) & 31) * 255 / 31),
        (byte)((value & 31) * 255 / 31),
        alpha && (value & 32768) == 0 ? (byte)0 : (byte)255);
}
