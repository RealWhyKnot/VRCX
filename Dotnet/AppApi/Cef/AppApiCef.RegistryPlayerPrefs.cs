using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace VRCX;

internal partial class AppApiCef
{
    [LibraryImport("advapi32.dll", EntryPoint = "RegSetValueExA", StringMarshalling = StringMarshalling.Custom, StringMarshallingCustomType = typeof(AnsiStringMarshaller), SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial uint RegSetValueEx(
        UIntPtr hKey,
        string lpValueName,
        int reserved,
        RegistryValueKind dwType,
        byte[] lpData,
        int cbData);

    [LibraryImport("advapi32.dll", EntryPoint = "RegOpenKeyExA", StringMarshalling = StringMarshalling.Custom, StringMarshallingCustomType = typeof(AnsiStringMarshaller), SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial int RegOpenKeyEx(
        UIntPtr hKey,
        string subKey,
        int ulOptions,
        int samDesired,
        out UIntPtr hkResult);

    [LibraryImport("advapi32.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial int RegCloseKey(UIntPtr hKey);

    private static string AddHashToKeyName(string key)
    {
        uint hash = 5381;
        foreach (char c in key)
        {
            hash = (hash * 33) ^ c;
        }

        return key + "_h" + hash;
    }

    public override object? GetVRChatRegistryKey(string key)
    {
        string keyName = AddHashToKeyName(key);
        using RegistryKey? regKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\VRChat\VRChat");
        object? data = regKey?.GetValue(keyName);
        if (regKey == null || data == null)
        {
            return null;
        }

        RegistryValueKind type = regKey.GetValueKind(keyName);
        switch (type)
        {
            case RegistryValueKind.Binary:
                return Encoding.ASCII.GetString((byte[])data);

            case RegistryValueKind.DWord:
                if (data.GetType() != typeof(long))
                {
                    return data;
                }

                _ = long.TryParse(data.ToString(), System.Globalization.CultureInfo.InvariantCulture, out long longValue);
                byte[] bytes = BitConverter.GetBytes(longValue);
                double doubleValue = BitConverter.ToDouble(bytes, 0);
                return doubleValue;
            case RegistryValueKind.None:
                break;
            case RegistryValueKind.Unknown:
                break;
            case RegistryValueKind.String:
                break;
            case RegistryValueKind.ExpandString:
                break;
            case RegistryValueKind.MultiString:
                break;
            case RegistryValueKind.QWord:
                break;
            default:
                break;
        }

        return null;
    }

    public override string? GetVRChatRegistryKeyString(string key) =>
        GetVRChatRegistryKey(key)?.ToString();




    public override bool SetVRChatRegistryKey(string key, object value, int typeInt)
    {
        var type = (RegistryValueKind)typeInt;
        string keyName = AddHashToKeyName(key);
        using RegistryKey? regKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\VRChat\VRChat", writable: true);
        if (regKey == null)
        {
            return false;
        }

        object? setValue = null;
        switch (type)
        {
            case RegistryValueKind.Binary:
                setValue = Encoding.ASCII.GetBytes(value.ToString() ?? string.Empty);
                break;

            case RegistryValueKind.DWord:
                setValue = value;
                break;
            case RegistryValueKind.None:
                break;
            case RegistryValueKind.Unknown:
                break;
            case RegistryValueKind.String:
                break;
            case RegistryValueKind.ExpandString:
                break;
            case RegistryValueKind.MultiString:
                break;
            case RegistryValueKind.QWord:
                break;
            default:
                break;
        }

        if (setValue == null)
        {
            return false;
        }

        regKey.SetValue(keyName, setValue, type);

        return true;
    }



    public override void SetVRChatRegistryKey(string key, byte[] value)
    {
        string keyName = AddHashToKeyName(key);
        nuint hKey = 0x80000001;
        const int KeyWrite = 0x20006;
        const string KeyFolder = @"SOFTWARE\VRChat\VRChat";
        int openKeyResult = RegOpenKeyEx(hKey, KeyFolder, 0, KeyWrite, out nuint folderPointer);
        if (openKeyResult != 0)
        {
            throw new InvalidOperationException("Error opening registry key. Error code: " + openKeyResult);
        }

        uint setKeyResult = RegSetValueEx(folderPointer, keyName, 0, RegistryValueKind.DWord, value, value.Length);
        if (setKeyResult != 0)
        {
            throw new InvalidOperationException("Error setting registry value. Error code: " + setKeyResult);
        }

        _ = RegCloseKey(folderPointer);
    }

    public override string GetVRChatRegistryJson() => Newtonsoft.Json.JsonConvert.SerializeObject(ReadVRChatRegistry());

    private static Dictionary<string, Dictionary<string, object>> ReadVRChatRegistry()
    {
        var output = new Dictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
        using RegistryKey regKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\VRChat\VRChat") ?? throw new InvalidOperationException("Failed to get VRC registry data");
        foreach (string key in regKey.GetValueNames())
        {
            object? data = regKey.GetValue(key);
            int index = key.LastIndexOf("_h", StringComparison.Ordinal);
            if (index <= 0 || data == null)
            {
                continue;
            }

            AddRegistryEntry(output, key[..index], regKey.GetValueKind(key), data);
        }

        return output;
    }

    private static void AddRegistryEntry(Dictionary<string, Dictionary<string, object>> output, string keyName, RegistryValueKind type, object data)
    {
        switch (type)
        {
            case RegistryValueKind.Binary:
                var binDict = new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    { "data", Encoding.ASCII.GetString((byte[])data) },
                    { "type", type },
                };
                output.Add(keyName, binDict);
                break;

            case RegistryValueKind.DWord:
                if (data.GetType() != typeof(long))
                {
                    var dwordDict = new Dictionary<string, object>(StringComparer.Ordinal)
                    {
                        { "data", data },
                        { "type", type },
                    };
                    output.Add(keyName, dwordDict);
                    break;
                }

                double doubleValue = BitConverter.Int64BitsToDouble((long)data);
                var floatDict = new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    { "data", doubleValue },
                    { "type", 100 },
                };
                output.Add(keyName, floatDict);
                break;
            case RegistryValueKind.None:
                break;
            case RegistryValueKind.Unknown:
                break;
            case RegistryValueKind.String:
                break;
            case RegistryValueKind.ExpandString:
                break;
            case RegistryValueKind.MultiString:
                break;
            case RegistryValueKind.QWord:
                break;
            default:
                Debug.WriteLine($"Unknown registry value kind: {type}");
                break;
        }
    }

    public override void SetVRChatRegistry(string json)
    {
        CreateVRChatRegistryFolder();
        Span<double> spanDouble = stackalloc double[1];
        Dictionary<string, Dictionary<string, object>> dict = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, object>>>(json)
            ?? throw new InvalidDataException("VRChat registry JSON must be an object of registry entries.");

        foreach (KeyValuePair<string, Dictionary<string, object>> item in dict)
        {
            var data = (JsonElement)item.Value["data"];
            if (!int.TryParse(item.Value["type"].ToString(), System.Globalization.CultureInfo.InvariantCulture, out int type))
            {
                throw new InvalidDataException("Unknown type: " + item.Value["type"]);
            }

            if (data.ValueKind == JsonValueKind.Number)
            {
                if (type == 100)
                {
                    spanDouble[0] = data.Deserialize<double>();
                    long valueLong = MemoryMarshal.Cast<double, long>(spanDouble)[0];
                    const int DataLength = sizeof(long);
                    byte[] dataBytes = new byte[DataLength];
                    Buffer.BlockCopy(BitConverter.GetBytes(valueLong), 0, dataBytes, 0, DataLength);
                    SetVRChatRegistryKey(item.Key, dataBytes);
                    continue;
                }

                if (int.TryParse(data.ToString(), System.Globalization.CultureInfo.InvariantCulture, out int intValue))
                {
                    SetVRChatRegistryKey(item.Key, intValue, type);
                    continue;
                }

                throw new InvalidDataException("Unknown number type: " + item.Key);
            }

            SetVRChatRegistryKey(item.Key, data, type);
        }
    }

    public override bool HasVRChatRegistryFolder()
    {
        using RegistryKey? regKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\VRChat\VRChat");
        return regKey != null;
    }

    private void CreateVRChatRegistryFolder()
    {
        if (HasVRChatRegistryFolder())
        {
            return;
        }

        using RegistryKey key = Registry.CurrentUser.CreateSubKey(@"SOFTWARE\VRChat\VRChat") ?? throw new InvalidOperationException("Error creating registry key.");
    }

    public override void DeleteVRChatRegistryFolder()
    {
        using RegistryKey? regKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\VRChat\VRChat");
        if (regKey == null)
        {
            return;
        }

        Registry.CurrentUser.DeleteSubKeyTree(@"SOFTWARE\VRChat\VRChat");
    }

    public override string ReadVrcRegJsonFile(string filepath)
    {
        if (!File.Exists(filepath))
        {
            return string.Empty;
        }

        string json = File.ReadAllText(filepath);
        return json;
    }
}
