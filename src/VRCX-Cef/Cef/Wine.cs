using System.Runtime.InteropServices;

namespace VRCX.Cef;

internal static partial class Wine
{
    [LibraryImport("ntdll.dll", EntryPoint = "wine_get_version")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial IntPtr GetVersion();

    public static bool GetIfWine()
    {
        try
        {
            return GetVersion() != IntPtr.Zero;
        }
        catch (EntryPointNotFoundException)
        {
            return false;
        }
    }
}
