using Newtonsoft.Json;

namespace VRCX;

public partial class AppApi
{
    public string ReadConfigFile()
    {
        string path = GetVRChatAppDataLocation();
        string configFile = Path.Join(path, "config.json");
        if (!Directory.Exists(path) || !File.Exists(configFile))
        {
            return string.Empty;
        }

        string json = File.ReadAllText(configFile);
        return json;
    }

    public string ReadConfigFileSafe()
    {
        try
        {
            string configFile = ReadConfigFile();
            if (string.IsNullOrEmpty(configFile))
            {
                return string.Empty;
            }

            dynamic? jObject = JsonConvert.DeserializeObject<dynamic>(configFile, JsonSerializerSettings);
            if (jObject == null)
            {
                return string.Empty;
            }

            return JsonConvert.SerializeObject(jObject, Formatting.Indented);
        }
        catch (Exception ex)
        {
            Logger.Warn(ex, "Failed to parse VRC config.json file");
            return string.Empty;
        }
    }

    public void WriteConfigFile(string json)
    {
        string path = GetVRChatAppDataLocation();
        Directory.CreateDirectory(path);
        string configFile = Path.Join(path, "config.json");
        File.WriteAllText(configFile, json);
    }
}
