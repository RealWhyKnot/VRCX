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
    private const int ProcessCommandLineInformation = 60;

    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeString
    {
        public ushort Length;
        public ushort MaximumLength;
        public IntPtr Buffer;
    }

    [LibraryImport("ntdll.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial int NtQueryInformationProcess(IntPtr processHandle, int informationClass, IntPtr information, int length, out int returnLength);

    [LibraryImport("shell32.dll", StringMarshalling = StringMarshalling.Utf16)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial IntPtr CommandLineToArgvW(string commandLine, out int argumentCount);

    [LibraryImport("kernel32.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static partial IntPtr LocalFree(IntPtr memory);

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

    internal static string[]? GetProcessArguments(int processId)
    {
        IntPtr process = OpenProcess(ProcessQueryLimitedInformation, bInheritHandle: false, processId);
        if (process == IntPtr.Zero)
        {
            return null;
        }

        IntPtr buffer = IntPtr.Zero;
        try
        {
            NtQueryInformationProcess(process, ProcessCommandLineInformation, IntPtr.Zero, 0, out int length);
            int headerSize = Marshal.SizeOf<UnicodeString>();
            if (length < headerSize)
            {
                return null;
            }

            buffer = Marshal.AllocHGlobal(length);
            if (NtQueryInformationProcess(process, ProcessCommandLineInformation, buffer, length, out _) != 0)
            {
                return null;
            }

            UnicodeString commandLine = Marshal.PtrToStructure<UnicodeString>(buffer);
            long offset = commandLine.Buffer.ToInt64() - buffer.ToInt64();
            return commandLine.Length == 0 || commandLine.Length % sizeof(char) != 0 ||
                offset < headerSize || offset > length - commandLine.Length
                ? null
                : SplitCommandLine(Marshal.PtrToStringUni(commandLine.Buffer, commandLine.Length / sizeof(char)));
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
            CloseHandle(process);
        }
    }

    private static string[]? SplitCommandLine(string commandLine)
    {
        if (string.IsNullOrWhiteSpace(commandLine))
        {
            return null;
        }

        IntPtr argv = CommandLineToArgvW(commandLine, out int count);
        if (argv == IntPtr.Zero)
        {
            return null;
        }

        try
        {
            string[] arguments = new string[count];
            for (int i = 0; i < count; i++)
            {
                arguments[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(argv, i * IntPtr.Size)) ?? string.Empty;
            }

            return arguments;
        }
        finally
        {
            LocalFree(argv);
        }
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
