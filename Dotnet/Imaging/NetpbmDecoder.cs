using System.Buffers.Binary;
using SkiaSharp;

namespace VRCX.Imaging;

internal static class NetpbmDecoder
{
    public static SKBitmap Decode(byte[] data)
    {
        int kind = data[1] - '0';
        int offset = 2;
        int width = ReadNumber(data, ref offset);
        int height = ReadNumber(data, ref offset);
        int maximum = kind is 1 or 4 ? 1 : ReadNumber(data, ref offset);
        if (width <= 0 || height <= 0 || maximum is <= 0 or > 65535)
        {
            throw new InvalidDataException("Invalid Netpbm dimensions or sample range.");
        }
        if (kind >= 4)
        {
            if (offset >= data.Length || !IsSpace(data[offset]))
            {
                throw new InvalidDataException("Invalid Netpbm header.");
            }
            byte separator = data[offset++];
            if (separator == 13 && offset < data.Length && data[offset] == 10)
            {
                offset++;
            }
        }
        var bitmap = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int red;
                if (kind == 4)
                {
                    int index = checked(offset + (y * ((width + 7) / 8)) + (x / 8));
                    if (index >= data.Length)
                    {
                        bitmap.Dispose();
                        throw new InvalidDataException("Truncated Netpbm image.");
                    }
                    red = 1 - ((data[index] >> (7 - (x % 8))) & 1);
                }
                else
                {
                    red = ReadSample(data, kind, maximum, ref offset);
                    if (kind == 1)
                    {
                        red = 1 - red;
                    }
                }
                int green = kind is 3 or 6 ? ReadSample(data, kind, maximum, ref offset) : red;
                int blue = kind is 3 or 6 ? ReadSample(data, kind, maximum, ref offset) : red;
                bitmap.SetPixel(x, y, new SKColor(Scale(red, maximum), Scale(green, maximum), Scale(blue, maximum)));
            }
        }
        return bitmap;
    }

    private static byte Scale(int value, int maximum) => (byte)Math.Clamp((int)Math.Round(value * 255.0 / maximum), 0, 255);

    private static int ReadSample(byte[] data, int kind, int maximum, ref int offset)
    {
        if (kind < 4)
        {
            return ReadNumber(data, ref offset);
        }
        int bytes = maximum > 255 ? 2 : 1;
        if (offset > data.Length - bytes)
        {
            throw new InvalidDataException("Truncated Netpbm image.");
        }
        int value = bytes == 1 ? data[offset] : BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset));
        offset += bytes;
        return value;
    }

    private static int ReadNumber(byte[] data, ref int offset)
    {
        while (offset < data.Length)
        {
            if (IsSpace(data[offset]))
            {
                offset++;
            }
            else if (data[offset] == '#')
            {
                while (offset < data.Length && data[offset] is not 10 and not 13)
                {
                    offset++;
                }
            }
            else
            {
                break;
            }
        }
        int start = offset;
        int value = 0;
        while (offset < data.Length && data[offset] is >= (byte)'0' and <= (byte)'9')
        {
            value = checked((value * 10) + data[offset++] - '0');
        }
        return offset == start ? throw new InvalidDataException("Invalid Netpbm number.") : value;
    }

    private static bool IsSpace(byte value) => value is 9 or 10 or 11 or 12 or 13 or 32;
}
