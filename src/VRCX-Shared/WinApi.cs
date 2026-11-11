using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Microsoft.Win32;

namespace VRCX;

internal static partial class WinApi
{
    private static readonly List<(List<string>, string, string)> CpuErrorMessages =
    [
        (["Intel", "Core", "-13"], "VRCX has detected that you're using a 13th or 14th generation Intel CPU.\nThese CPUs are known to have issues which can lead to crashes.\nThis crash was unlikely caused by VRCX itself, therefore limited support can be offered.\nWould you like to open a link with more information?", "https://alderongames.com/intel-crashes"),
        (["Intel", "Core", "-14"], "VRCX has detected that you're using a 13th or 14th generation Intel CPU.\nThese CPUs are known to have issues which can lead to crashes.\nThis crash was unlikely caused by VRCX itself, therefore limited support can be offered.\nWould you like to open a link with more information?", "https://alderongames.com/intel-crashes"),
    ];

    private const int ProcessQueryLimitedInformation = 0x1000;

    [LibraryImport("kernel32.dll", SetLastError = false)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial void RtlCopyMemory(IntPtr destination, IntPtr source, uint length);

    [LibraryImport("shell32.dll", StringMarshalling = StringMarshalling.Utf16)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial int SHParseDisplayName(string pszName, IntPtr pbc, out IntPtr ppidl, uint sfgaoIn, out uint psfgaoOut);

    [LibraryImport("shell32.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial IntPtr SHOpenFolderAndSelectItems(IntPtr pidlFolder, uint cidl, IntPtr[] apidl, uint dwFlags);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    public static partial IntPtr OpenProcess(int dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, int dwProcessId);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [LibraryImport("kernel32.dll", SetLastError = true)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool CloseHandle(IntPtr hObject);

    internal static bool HasProcessExited(int processId)
    {
        IntPtr hProcess = OpenProcess(ProcessQueryLimitedInformation, bInheritHandle: false, processId);
        if (hProcess == IntPtr.Zero)
        {
            return true;
        }

        bool exited;

        try
        {
            if (!GetExitCodeProcess(hProcess, out uint exitCode))
            {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }

            exited = exitCode != 259;
        }
        finally
        {
            CloseHandle(hProcess);
        }

        return exited;
    }

    [SupportedOSPlatform("windows")]
    internal static string? GetCpuName() => Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0\")?.GetValue("ProcessorNameString")?.ToString();

    [SupportedOSPlatform("windows")]
    internal static (string, string)? GetCpuErrorMessage()
    {
        string? cpuName = GetCpuName();
        if (cpuName == null)
        {
            return null;
        }

        foreach ((List<string>, string, string) errorInfo in CpuErrorMessages)
        {
            if (errorInfo.Item1.All(cpuName.Contains))
            {
                return (errorInfo.Item2, errorInfo.Item3);
            }
        }

        return null;
    }
}
