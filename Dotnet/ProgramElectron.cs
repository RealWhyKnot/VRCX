#if LINUX
namespace VRCX;

public static class ProgramElectron
{
    public static void PreInit(string version, string[] args) => Program.PreInit(version, args);

    public static void Init() => Program.Init();
}
#endif
