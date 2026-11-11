using VRCX.ScreenshotMetadata;

namespace VRCX;

internal partial class AppApiCef
{







    public override string AddScreenshotMetadata(string path, string metadataString, string worldId, bool changeFilename = false)
    {
        string fileName = Path.GetFileNameWithoutExtension(path);
        if (!File.Exists(path) || !path.EndsWith(".png", StringComparison.Ordinal) || !fileName.StartsWith("VRChat_", StringComparison.Ordinal))
        {
            return FileSkipped();
        }


        bool success = false;
        for (int i = 0; i < 10; i++)
        {
            try
            {
                using (File.Open(path, FileMode.Append, FileAccess.Write, FileShare.None))
                {
                    success = true;
                    break;
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Thread.Sleep(1000);
            }
        }
        if (!success)
        {
            return FileSkipped();
        }

        try
        {
            if (changeFilename)
            {
                string newFileName = $"{fileName}_{worldId}";
                string newPath = Path.Join(Path.GetDirectoryName(path), newFileName + Path.GetExtension(path));
                File.Move(path, newPath);
                path = newPath;
            }

            ScreenshotHelper.WriteVRCXMetadata(metadataString, path);
        }
        catch (UnauthorizedAccessException ex)
        {
            Logger.Error(ex, System.Globalization.CultureInfo.InvariantCulture, "Access denied while adding screenshot metadata");
            return FileAccessDenied();
        }

        return FileSaved(path);
    }
}
