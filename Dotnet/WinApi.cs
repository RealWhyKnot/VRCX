using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace VRCX;

internal static class WinApi
{
    private static readonly List<(List<string>, string, string)> CpuErrorMessages =
    [
        (["Intel", "Core", "-13"], "VRCX has detected that you're using a 13th or 14th generation Intel CPU.\nThese CPUs are known to have issues which can lead to crashes.\nThis crash was unlikely caused by VRCX itself, therefore limited support can be offered.\nWould you like to open a link with more information?", "https://alderongames.com/intel-crashes"),
        (["Intel", "Core", "-14"], "VRCX has detected that you're using a 13th or 14th generation Intel CPU.\nThese CPUs are known to have issues which can lead to crashes.\nThis crash was unlikely caused by VRCX itself, therefore limited support can be offered.\nWould you like to open a link with more information?", "https://alderongames.com/intel-crashes"),
    ];

    [DllImport("kernel32.dll", SetLastError = false)]
    public static extern void RtlCopyMemory(IntPtr destination, IntPtr source, uint length);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern int SHParseDisplayName([MarshalAs(UnmanagedType.LPWStr)] string pszName, IntPtr pbc, out IntPtr ppidl, uint sfgaoIn, out uint psfgaoOut);
    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SHOpenFolderAndSelectItems(IntPtr pidlFolder, uint cidl, IntPtr[] apidl, uint dwFlags);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);





    private const int PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;









    internal static bool HasProcessExited(int processId)
    {
        IntPtr hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, bInheritHandle: false, processId);
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

    internal static string GetCpuName() => Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0\")?.GetValue("ProcessorNameString").ToString() ?? null;

    internal static (string, string)? GetCpuErrorMessage()
    {
        string cpuName = GetCpuName();
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
