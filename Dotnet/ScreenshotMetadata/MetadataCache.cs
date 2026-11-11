namespace VRCX.ScreenshotMetadata;

internal sealed class MetadataCache
{
    public int Id { get; set; }
    public string? FilePath { get; set; }
    public string? Metadata { get; set; }
    public DateTimeOffset CachedAt { get; set; }
}
