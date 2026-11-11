namespace DBMerger;

internal sealed class Config
{
    public Config(string newDBPath, string oldDBPath, bool debug, bool importConfig)
    {
        NewDBPath = newDBPath;
        OldDBPath = oldDBPath;
        Debug = debug;
        ImportConfig = importConfig;
    }

    public string NewDBPath { get; }
    public string OldDBPath { get; }
    public bool Debug { get; }
    public bool ImportConfig { get; }
}
