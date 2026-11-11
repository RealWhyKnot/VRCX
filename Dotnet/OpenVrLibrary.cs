using System.Reflection;
using System.Runtime.InteropServices;

namespace VRCX;

internal static class OpenVrLibrary
{
    private static int Registered;

    public static void Register()
    {
        if (Interlocked.Exchange(ref Registered, 1) == 1)
        {
            return;
        }

        NativeLibrary.SetDllImportResolver(typeof(OpenVrLibrary).Assembly, Resolve);
    }

    private static IntPtr Resolve(string libraryName, Assembly assembly, DllImportSearchPath? searchPath)
    {
        if (!string.Equals(libraryName, "openvr_api", StringComparison.Ordinal))
        {
            return IntPtr.Zero;
        }

        string directory = Path.GetDirectoryName(assembly.Location) is { Length: > 0 } assemblyDirectory ? assemblyDirectory : AppContext.BaseDirectory;
        string fileName = OperatingSystem.IsWindows() ? "openvr_api.dll" : "libopenvr_api.so";
        return NativeLibrary.TryLoad(Path.Join(directory, fileName), out IntPtr handle) ? handle : IntPtr.Zero;
    }
}
