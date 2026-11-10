using SkiaSharp;

namespace VRCX.Imaging;

internal sealed class ImageRaster : IDisposable
{
    private SKBitmap _bitmap;

    private ImageRaster(SKBitmap bitmap)
    {
        _bitmap = bitmap;
    }

    public int Width => _bitmap.Width;

    public int Height => _bitmap.Height;

    public static ImageRaster Load(byte[] data)
    {
        using var stream = new SKMemoryStream(data);
        using SKCodec codec = SKCodec.Create(stream) ?? throw new InvalidDataException("Unsupported image format.");
        if (codec.EncodedFormat is not (SKEncodedImageFormat.Bmp or SKEncodedImageFormat.Gif or SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
        {
            throw new InvalidDataException("Unsupported image format.");
        }

        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        var bitmap = new SKBitmap(info);
        if (codec.GetPixels(info, bitmap.GetPixels()) != SKCodecResult.Success)
        {
            bitmap.Dispose();
            throw new InvalidDataException("Failed to decode image.");
        }
        return new ImageRaster(bitmap);
    }

    public static ImageRaster Create(int width, int height, SKColor background)
    {
        var bitmap = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        bitmap.Erase(background);
        return new ImageRaster(bitmap);
    }

    public void Resize(int width, int height)
    {
        if (width == 0 && height > 0)
        {
            width = Math.Max(1, (int)Math.Round(Width * (double)height / Height));
        }
        if (height == 0 && width > 0)
        {
            height = Math.Max(1, (int)Math.Round(Height * (double)width / Width));
        }

        if (width <= 0 || height <= 0)
        {
            throw new InvalidOperationException("Image dimensions must be greater than zero.");
        }
        Replace(BicubicResizer.Resize(_bitmap, width, height));
    }

    public void Draw(ImageRaster image, int x, int y)
    {
        using var canvas = new SKCanvas(_bitmap);
        using var source = SKImage.FromBitmap(image._bitmap);
        canvas.DrawImage(source, x, y, new SKSamplingOptions(SKFilterMode.Nearest));
    }

    public void PlaceOnCanvas(int width, int height, SKColor background, int x, int y)
    {
        using ImageRaster canvas = Create(width, height, background);
        canvas.Draw(this, x, y);
        Replace(canvas._bitmap.Copy());
    }

    public void Rotate270()
    {
        int width = Width;
        int height = Height;
        SKColor[] source = _bitmap.Pixels;
        var target = new SKColor[source.Length];
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                target[((width - x - 1) * height) + y] = source[(y * width) + x];
            }
        }
        var rotated = new SKBitmap(height, width, _bitmap.ColorType, _bitmap.AlphaType)
        {
            Pixels = target,
        };
        Replace(rotated);
    }

    public void Crop(int x, int y, int width, int height)
    {
        var cropped = new SKBitmap();
        if (!_bitmap.ExtractSubset(cropped, SKRectI.Create(x, y, width, height)))
        {
            cropped.Dispose();
            throw new InvalidOperationException("Failed to crop image.");
        }
        Replace(cropped);
    }

    public byte[] EncodePng()
    {
        using SKPixmap pixels = _bitmap.PeekPixels();
        using SKData data = pixels.Encode(new SKPngEncoderOptions(SKPngEncoderFilterFlags.Paeth, 6))
            ?? throw new InvalidOperationException("Failed to encode image.");
        return data.ToArray();
    }

    public void Dispose()
    {
        _bitmap.Dispose();
    }

    private void Replace(SKBitmap bitmap)
    {
        _bitmap.Dispose();
        _bitmap = bitmap;
    }
}
