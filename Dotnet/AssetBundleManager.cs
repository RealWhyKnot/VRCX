using System.Security.Cryptography;
using System.Text;
using NLog;

namespace VRCX;

internal sealed class AssetBundleManager
{
    public static readonly AssetBundleManager Instance;
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    static AssetBundleManager()
    {
        Instance = new AssetBundleManager();
    }

    public string GetAssetId(string id, string variant = "")
    {
        using var sha256 = SHA256.Create();
        byte[] hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(id + variant));
        var idHex = new StringBuilder(hash.Length * 2);
        foreach (byte b in hash)
        {
            idHex.Append($"{b:x2}");
        }
        return idHex.ToString().ToUpperInvariant()[..16];
    }

    public string GetAssetVersion(int version, int variantVersion = 0)
    {
        string versionHex = string.Empty;
        byte[] variantVersionBytes = BitConverter.GetBytes(variantVersion);
        foreach (byte b in variantVersionBytes)
        {
            versionHex += b.ToString("X2");
        }
        byte[] versionBytes = BitConverter.GetBytes(version);
        foreach (byte b in versionBytes)
        {
            versionHex += b.ToString("X2");
        }

        return versionHex.PadLeft(32, '0').ToLowerInvariant();
    }

    public (int, int) ReverseHexToDecimal(string hexString)
    {
        if (hexString.Length != 32)
        {
            return (0, 0);
        }

        try
        {
            string variantVersionHexString = hexString[..8];
            string versionHexString = hexString.Substring(24, 8);
            byte[] versionBytes = new byte[4];
            byte[] variantVersionBytes = new byte[4];
            for (int i = 0; i < 4; i++)
            {
                int versionValue = Convert.ToInt32(versionHexString.Substring(i * 2, 2), 16);
                versionBytes[i] = (byte)versionValue;
                int variantVersionValue = Convert.ToInt32(variantVersionHexString.Substring(i * 2, 2), 16);
                variantVersionBytes[i] = (byte)variantVersionValue;
            }
            int version = BitConverter.ToInt32(versionBytes, 0);
            int variantVersion = BitConverter.ToInt32(variantVersionBytes, 0);
            return (version, variantVersion);
        }
        catch (Exception ex)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Failed to convert hex to decimal: {hexString} {ex}");
            return (0, 0);
        }
    }

    public string GetVRChatCacheLocation() => Program.AppApiInstance.GetVRChatCacheLocation();









    public string GetVRChatCacheFullLocation(string id, int version, string variant = "", int variantVersion = 0)
    {
        string cachePath = GetVRChatCacheLocation();
        string idHash = GetAssetId(id, variant);
        string topDir = Path.Join(cachePath, idHash);
        string versionLocation = GetAssetVersion(version, variantVersion);
        if (!Directory.Exists(topDir))
        {
            return Path.Join(topDir, versionLocation);
        }

        string versionSearchPattern = string.Concat("*", versionLocation.AsSpan(16));
        string[] dirs = Directory.GetDirectories(topDir, versionSearchPattern);
        return dirs.Length > 0
            ? dirs.OrderByDescending(dir => ReverseHexToDecimal(Path.GetFileName(dir)).Item2).First()
            : Path.Join(topDir, versionLocation);
    }









    public Tuple<long, bool, string> CheckVRChatCache(string id, int version, string variant, int variantVersion)
    {
        long fileSize = -1;
        bool isLocked = false;
        string fullLocation = GetVRChatCacheFullLocation(id, version);
        if (!Directory.Exists(fullLocation))
        {
            fullLocation = GetVRChatCacheFullLocation(id, version, variant, variantVersion);
        }

        string fileLocation = Path.Join(fullLocation, "__data");
        string cachePath = string.Empty;
        if (File.Exists(fileLocation))
        {
            cachePath = fullLocation;
            var data = new FileInfo(fileLocation);
            fileSize = data.Length;
        }
        if (File.Exists(Path.Join(fullLocation, "__lock")))
        {
            isLocked = true;
        }
        return new Tuple<long, bool, string>(fileSize, isLocked, cachePath);
    }








    public void DeleteCache(string id, int version, string variant, int variantVersion)
    {
        string path = GetVRChatCacheFullLocation(id, version);
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }

        path = GetVRChatCacheFullLocation(id, version, variant, variantVersion);
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }
    }




    public void DeleteAllCache()
    {
        string cachePath = GetVRChatCacheLocation();
        if (Directory.Exists(cachePath))
        {
            Directory.Delete(cachePath, recursive: true);
            Directory.CreateDirectory(cachePath);
        }
    }




    public List<string> SweepCache()
    {
        var output = new List<string>();
        string cachePath = GetVRChatCacheLocation();
        if (!Directory.Exists(cachePath))
        {
            return output;
        }

        var directories = new DirectoryInfo(cachePath);
        DirectoryInfo[] cacheDirectories = directories.GetDirectories();
        foreach (DirectoryInfo cacheDirectory in cacheDirectories)
        {

            DirectoryInfo[] versionDirectories =
                [.. cacheDirectory.GetDirectories().OrderBy(d => d.LastWriteTime)];
            for (int index = 0; index < versionDirectories.Length; index++)
            {
                DirectoryInfo versionDirectory = versionDirectories[index];
                if (versionDirectory.GetDirectories().Length + versionDirectory.GetFiles().Length == 0)
                {
                    versionDirectory.Delete();
                    continue;
                }

                if (index == versionDirectories.Length - 1)
                {
                    continue;
                }

                if (File.Exists(Path.Join(versionDirectory.FullName, "__lock")))
                {
                    continue;
                }

                versionDirectory.Delete(recursive: true);
                output.Add($"{cacheDirectory.Name}\\{versionDirectory.Name}");
            }

            if (cacheDirectory.GetDirectories().Length + cacheDirectory.GetFiles().Length == 0)
            {
                cacheDirectory.Delete();
            }
        }

        return output;
    }





    public long GetCacheSize()
    {
        string cachePath = GetVRChatCacheLocation();

        return !Directory.Exists(cachePath) ? 0 : DirSize(new DirectoryInfo(cachePath));
    }







    public long DirSize(DirectoryInfo d)
    {
        long size = 0;
        FileInfo[] files = d.GetFiles("*.*", SearchOption.AllDirectories);
        foreach (FileInfo file in files)
        {
            size += file.Length;
        }
        return size;
    }
}
