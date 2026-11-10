using System.Buffers.Binary;
using System.Runtime.InteropServices;
using JpegLibrary;
using SkiaSharp;

namespace VRCX.Imaging;

internal static class JpegRasterDecoder
{
    internal static SKBitmap? Decode(byte[] data)
    {
        if (data.Length < 2 || data[0] != 255 || data[1] != 216)
        {
            return null;
        }
        bool? rgb = ReadRgbMode(data);
        if (rgb is null)
        {
            return null;
        }
        var decoder = new JpegDecoder();
        decoder.SetInput(data);
        decoder.Identify();
        if (decoder.Precision != 8 || decoder.NumberOfComponents is not (1 or 3))
        {
            return null;
        }
        var writer = new JpegPixelWriter(decoder.Width, decoder.Height, decoder.NumberOfComponents);
        decoder.SetOutputWriter(writer);
        try
        {
            decoder.Decode();
        }
        catch (InvalidDataException)
        {
            return null;
        }
        byte[] pixels = ConvertPixels(writer.Pixels, decoder.NumberOfComponents, rgb.Value);
        var bitmap = new SKBitmap(decoder.Width, decoder.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        Marshal.Copy(pixels, 0, bitmap.GetPixels(), pixels.Length);
        return bitmap;
    }

    private static byte[] ConvertPixels(byte[] source, int components, bool rgb)
    {
        byte[] output = new byte[checked(source.Length / components * 4)];
        for (int index = 0; index < source.Length / components; index++)
        {
            int input = index * components;
            int destination = index * 4;
            float luminance = source[input];
            if (components == 1 || rgb)
            {
                output[destination] = source[input];
                output[destination + 1] = components == 1 ? source[input] : source[input + 1];
                output[destination + 2] = components == 1 ? source[input] : source[input + 2];
            }
            else
            {
                float blueDifference = source[input + 1] - 128;
                float redDifference = source[input + 2] - 128;
                output[destination] = Pack(luminance + (1.402f * redDifference));
                output[destination + 1] = Pack(luminance - (0.344136f * blueDifference) - (0.714136f * redDifference));
                output[destination + 2] = Pack(luminance + (1.772f * blueDifference));
            }
            output[destination + 3] = 255;
        }
        return output;
    }

    private static byte Pack(float value) => (byte)Math.Clamp((int)(value + 0.5f), 0, 255);

    private static bool? ReadRgbMode(byte[] data)
    {
        bool? rgb = null;
        int? adobeTransform = null;
        int offset = 2;
        while (offset < data.Length && data[offset++] == 255)
        {
            while (offset < data.Length && data[offset] == 255)
            {
                offset++;
            }
            if (offset >= data.Length)
            {
                return null;
            }
            byte marker = data[offset++];
            if (marker is 218 or 217)
            {
                break;
            }
            if (data.Length - offset < 2)
            {
                return null;
            }
            int length = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset));
            if (length < 2 || length > data.Length - offset)
            {
                return null;
            }
            ReadOnlySpan<byte> segment = data.AsSpan(offset + 2, length - 2);
            if (marker is 192 or 193 or 194)
            {
                rgb = ReadFrameMode(segment);
            }
            else if (marker == 238 && segment.Length >= 12 && segment.StartsWith("Adobe"u8))
            {
                adobeTransform = segment[11];
            }
            offset += length;
        }
        return adobeTransform switch
        {
            0 when rgb.HasValue => true,
            1 when rgb.HasValue => false,
            null => rgb,
            _ => null,
        };
    }

    private static bool? ReadFrameMode(ReadOnlySpan<byte> segment)
    {
        if (segment.Length < 6 || segment[0] != 8)
        {
            return null;
        }
        return segment[5] switch
        {
            1 => false,
            3 when segment.Length >= 15 => ReadComponentMode(segment),
            _ => null,
        };
    }

    private static bool? ReadComponentMode(ReadOnlySpan<byte> segment)
    {
        return (segment[6], segment[9], segment[12]) switch
        {
            (1, 2, 3) => false,
            ((byte)'R', (byte)'G', (byte)'B') => true,
            _ => null,
        };
    }
}
