using System.Globalization;
using System.Text;
using Newtonsoft.Json;
using NLog;

namespace VRCX;

internal static class JsonFileSerializer
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public static void Serialize<T>(string path, T obj)
    {
        try
        {
            using FileStream file = File.Open(path, FileMode.Create, FileAccess.Write, FileShare.ReadWrite);
            using var stream = new StreamWriter(file, Encoding.UTF8);
            using var writer = new JsonTextWriter(stream);
            var serializer = JsonSerializer.CreateDefault();
            serializer.Formatting = Formatting.Indented;
            serializer.Serialize(writer, obj, typeof(T));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            Logger.Warn(exception, CultureInfo.InvariantCulture, "Could not save {0}.", path);
        }
    }

    public static bool Deserialize<T>(string path, ref T obj) where T : new()
    {
        try
        {
            using FileStream file = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var stream = new StreamReader(file, Encoding.UTF8);
            using var reader = new JsonTextReader(stream);
            T? o = JsonSerializer.CreateDefault().Deserialize<T>(reader);
            o ??= new T();
            obj = o;
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            Logger.Warn(exception, CultureInfo.InvariantCulture, "Could not read {0}.", path);
        }
        return false;
    }
}
