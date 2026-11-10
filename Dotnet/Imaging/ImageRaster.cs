using SkiaSharp;

namespace VRCX.Imaging;

internal sealed class ImageRaster : IDisposable
{
    private SKBitmap _bitmap;
    private ImageMetadata _metadata = new();
    private readonly List<(ImageRaster Image, int Duration)> _frames = [];
    private int _duration;
    private int _repeatCount;

    private ImageRaster(SKBitmap bitmap)
    {
        _bitmap = bitmap;
    }

    public int Width => _bitmap.Width;

    public int Height => _bitmap.Height;

    public static ImageRaster Load(byte[] data)
    {
        SKBitmap? jpeg = JpegRasterDecoder.Decode(data);
        if (jpeg is not null)
        {
            return new ImageRaster(jpeg) { _metadata = ImageMetadata.Read(data) };
        }
        if (ExtraImageDecoder.IsTiff(data))
        {
            List<SKBitmap> bitmaps = ExtraImageDecoder.DecodeTiffFrames(data);
            var tiff = new ImageRaster(bitmaps[0]) { _metadata = ImageMetadata.Read(data) };
            for (int index = 1; index < bitmaps.Count; index++)
            {
                tiff._frames.Add((new ImageRaster(bitmaps[index]), 0));
            }
            return tiff;
        }

        if (PngAnimationDecoder.TryDecode(data, out List<(SKBitmap Bitmap, int Duration)> animation, out int repeatCount))
        {
            var animated = new ImageRaster(animation[0].Bitmap)
            {
                _metadata = ImageMetadata.Read(data),
                _duration = animation[0].Duration,
                _repeatCount = repeatCount,
            };
            for (int index = 1; index < animation.Count; index++)
            {
                animated._frames.Add((new ImageRaster(animation[index].Bitmap), animation[index].Duration));
            }
            return animated;
        }

        return LoadCodec(data);
    }

    private static ImageRaster LoadCodec(byte[] data)
    {
        using var stream = new SKMemoryStream(data);
        using SKCodec? codec = CreateCodec(stream);
        if (codec is null)
        {
            return new ImageRaster(ExtraImageDecoder.Decode(data)) { _metadata = ImageMetadata.Read(data) };
        }
        if (codec.EncodedFormat is not (SKEncodedImageFormat.Bmp or SKEncodedImageFormat.Gif or SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
        {
            throw new InvalidDataException("Unsupported image format.");
        }

        SKColorType colorType = codec.EncodedFormat == SKEncodedImageFormat.Png && data.Length > 24 && data[24] == 16
            ? SKColorType.RgbaF16 : SKColorType.Rgba8888;
        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, colorType, SKAlphaType.Unpremul);
        var bitmap = new SKBitmap(info);
        SKCodecResult result = codec.GetPixels(info, bitmap.GetPixels());
        if (result != SKCodecResult.Success)
        {
            bitmap.Dispose();
            throw new InvalidDataException("Failed to decode image.");
        }

        var image = new ImageRaster(bitmap) { _metadata = ImageMetadata.Read(data) };
        SKCodecFrameInfo[] frames = codec.FrameInfo;
        if (frames.Length > 1)
        {
            image._duration = frames[0].Duration;
            image._repeatCount = codec.RepetitionCount;
            for (int index = 1; index < frames.Length; index++)
            {
                var frame = new SKBitmap(info);
                result = codec.GetPixels(info, frame.GetPixels(), new SKCodecOptions(index));
                if (result != SKCodecResult.Success)
                {
                    frame.Dispose();
                    image.Dispose();
                    throw new InvalidDataException("Failed to decode image frame.");
                }
                image._frames.Add((new ImageRaster(frame), frames[index].Duration));
            }
        }
        return image;
    }

    private static SKCodec? CreateCodec(SKStream stream) => SKCodec.Create(stream);

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
        SKBitmap resized = BicubicResizer.Resize(_bitmap, width, height);
        Replace(resized);
        foreach ((ImageRaster frame, _) in _frames)
        {
            frame.Resize(width, height);
        }
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
        _metadata = new ImageMetadata();
        DisposeFrames();
    }

    public void Rotate270()
    {
        var rotated = new SKBitmap(Height, Width, _bitmap.ColorType, _bitmap.AlphaType);
        for (int y = 0; y < Height; y++)
        {
            for (int x = 0; x < Width; x++)
            {
                rotated.SetPixel(y, Width - x - 1, _bitmap.GetPixel(x, y));
            }
        }
        Replace(rotated);
        foreach ((ImageRaster frame, _) in _frames)
        {
            frame.Rotate270();
        }
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
        foreach ((ImageRaster frame, _) in _frames)
        {
            frame.Crop(x, y, width, height);
        }
    }

    public byte[] EncodePng()
    {
        using SKPixmap pixels = _bitmap.PeekPixels();
        using SKData data = pixels.Encode(new SKPngEncoderOptions(SKPngEncoderFilterFlags.Paeth, 6))
            ?? throw new InvalidOperationException("Failed to encode image.");
        byte[] png = _metadata.Apply(data.ToArray());
        return _frames.Count == 0 ? png : AnimatedPng.Encode(png, _duration, _repeatCount, _frames);
    }

    public void Dispose()
    {
        _bitmap.Dispose();
        DisposeFrames();
    }

    private void DisposeFrames()
    {
        foreach ((ImageRaster frame, _) in _frames)
        {
            frame.Dispose();
        }
        _frames.Clear();
    }

    private void Replace(SKBitmap bitmap)
    {
        _bitmap.Dispose();
        _bitmap = bitmap;
    }
}
