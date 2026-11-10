using System.Runtime.InteropServices;
using JpegLibrary;

namespace VRCX.Imaging;

internal sealed class JpegPixelWriter : JpegBlockOutputWriter
{
    private readonly int _width;
    private readonly int _height;
    private readonly int _components;

    internal JpegPixelWriter(int width, int height, int components)
    {
        _width = width;
        _height = height;
        _components = components;
        Pixels = new byte[checked(width * height * components)];
    }

    internal byte[] Pixels { get; }

    public override void WriteBlock(ref short blockRef, int componentIndex, int x, int y)
    {
        ReadOnlySpan<short> block = MemoryMarshal.CreateReadOnlySpan(ref blockRef, 64);
        for (int row = 0; row < Math.Min(8, _height - y); row++)
        {
            for (int column = 0; column < Math.Min(8, _width - x); column++)
            {
                int offset = ((((y + row) * _width) + x + column) * _components) + componentIndex;
                Pixels[offset] = (byte)Math.Clamp(block[(row * 8) + column], (short)0, (short)255);
            }
        }
    }
}
