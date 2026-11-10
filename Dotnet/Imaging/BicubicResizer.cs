using System.Numerics;
using System.Runtime.InteropServices;
using SkiaSharp;

namespace VRCX.Imaging;

internal static class BicubicResizer
{
    internal static SKBitmap Resize(SKBitmap source, int width, int height)
    {
        Vector4[] pixels = ReadPixels(source);
        List<(int Index, float Weight)>[] horizontal = CreateWeights(source.Width, width);
        List<(int Index, float Weight)>[] vertical = CreateWeights(source.Height, height);
        var intermediate = new Vector4[checked(width * source.Height)];
        for (int y = 0; y < source.Height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                Vector4 sum = Vector4.Zero;
                foreach ((int index, float weight) in horizontal[x])
                {
                    sum += pixels[(y * source.Width) + index] * weight;
                }
                intermediate[(y * width) + x] = sum;
            }
        }

        var output = new Vector4[checked(width * height)];
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                Vector4 sum = Vector4.Zero;
                foreach ((int index, float weight) in vertical[y])
                {
                    sum += intermediate[(index * width) + x] * weight;
                }
                float alpha = sum.W;
                if (alpha != 0)
                {
                    sum /= alpha;
                }
                sum.W = alpha;
                output[(y * width) + x] = Vector4.Clamp(sum, Vector4.Zero, Vector4.One);
            }
        }
        return WritePixels(output, width, height, source.ColorType);
    }

    private static Vector4[] ReadPixels(SKBitmap source)
    {
        bool highPrecision = source.ColorType == SKColorType.RgbaF16;
        var info = new SKImageInfo(source.Width, source.Height,
            highPrecision ? SKColorType.RgbaF32 : SKColorType.Rgba8888, SKAlphaType.Unpremul);
        using var converted = new SKBitmap(info);
        using SKPixmap sourcePixels = source.PeekPixels();
        if (!sourcePixels.ReadPixels(info, converted.GetPixels(), converted.RowBytes, 0, 0))
        {
            throw new InvalidDataException("Failed to read image pixels.");
        }
        var result = new Vector4[checked(source.Width * source.Height)];
        if (highPrecision)
        {
            float[] values = new float[checked(result.Length * 4)];
            Marshal.Copy(converted.GetPixels(), values, 0, values.Length);
            for (int index = 0; index < result.Length; index++)
            {
                int offset = index * 4;
                result[index] = new Vector4(values[offset], values[offset + 1], values[offset + 2], values[offset + 3]);
            }
        }
        else
        {
            byte[] values = new byte[checked(result.Length * 4)];
            Marshal.Copy(converted.GetPixels(), values, 0, values.Length);
            for (int index = 0; index < result.Length; index++)
            {
                int offset = index * 4;
                result[index] = new Vector4(values[offset], values[offset + 1], values[offset + 2], values[offset + 3]) / 255;
            }
        }
        for (int index = 0; index < result.Length; index++)
        {
            float alpha = result[index].W;
            result[index] *= alpha;
            result[index].W = alpha;
        }
        return result;
    }

    private static SKBitmap WritePixels(Vector4[] pixels, int width, int height, SKColorType colorType)
    {
        bool highPrecision = colorType == SKColorType.RgbaF16;
        byte[] bytes = new byte[checked(pixels.Length * (highPrecision ? 8 : 4))];
        ReadOnlySpan<float> values = MemoryMarshal.Cast<Vector4, float>(pixels.AsSpan());
        if (highPrecision)
        {
            Span<Half> halves = MemoryMarshal.Cast<byte, Half>(bytes.AsSpan());
            for (int index = 0; index < values.Length; index++)
            {
                halves[index] = (Half)values[index];
            }
        }
        else
        {
            for (int index = 0; index < values.Length; index++)
            {
                bytes[index] = (byte)((values[index] * 255) + 0.5f);
            }
        }
        var bitmap = new SKBitmap(width, height,
            highPrecision ? SKColorType.RgbaF16 : SKColorType.Rgba8888, SKAlphaType.Unpremul);
        Marshal.Copy(bytes, 0, bitmap.GetPixels(), bytes.Length);
        return bitmap;
    }

    private static List<(int Index, float Weight)>[] CreateWeights(int source, int destination)
    {
        var result = new List<(int Index, float Weight)>[destination];
        double ratio = (double)source / destination;
        double scale = Math.Max(1, ratio);
        for (int position = 0; position < destination; position++)
        {
            double center = ((position + 0.5) * ratio) - 0.5;
            int left = Math.Max(0, (int)Math.Ceiling(center - (2 * scale)));
            int right = Math.Min(source - 1, (int)Math.Floor(center + (2 * scale)));
            float sum = 0;
            var weights = new List<(int Index, float Weight)>();
            for (int index = left; index <= right; index++)
            {
                float distance = (float)Math.Abs((index - center) / scale);
                float weight = distance <= 1
                    ? ((((1.5f * distance) - 2.5f) * distance * distance) + 1)
                    : (((((-0.5f * distance) + 2.5f) * distance) - 4) * distance) + 2;
                weights.Add((index, weight));
                sum += weight;
            }
            for (int index = 0; index < weights.Count; index++)
            {
                weights[index] = (weights[index].Index, weights[index].Weight / sum);
            }
            result[position] = weights;
        }
        return result;
    }
}
