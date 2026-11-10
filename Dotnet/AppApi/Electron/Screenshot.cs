namespace VRCX;

public partial class AppApiElectron
{
    public override string AddScreenshotMetadata(string path, string metadataString, string worldId, bool changeFilename = false)
    {
        if (path.Length >= 3 && path[1] == ':' &&
            (path[2] == '\\' || path[2] == '/'))
        {
            string driveLetter = path[0].ToString().ToLowerInvariant();
            string winePrefix = Path.Join(_vrcPrefixPath, $"dosdevices/{driveLetter}:");
            string winePath = path[3..];
            path = Path.Join(winePrefix, winePath);
        }

        path = path.Replace("\\", "/");

        string fileName = Path.GetFileNameWithoutExtension(path);
        if (!File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal) || !fileName.StartsWith("VRChat_", StringComparison.Ordinal))
        {
            return string.Empty;
        }

        if (changeFilename)
        {
            string newFileName = $"{fileName}_{worldId}";
            string newPath = Path.Join(Path.GetDirectoryName(path), newFileName + Path.GetExtension(path));
            File.Move(path, newPath);
            path = newPath;
        }

        ScreenshotHelper.WriteVRCXMetadata(metadataString, path);
        return path;
    }
}
