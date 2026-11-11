using System.Runtime.InteropServices;

namespace VRCX.Cef;

internal static partial class WinformThemer
{
    public const uint FLASHW_ALL = 3;
    public const uint FLASHW_TIMERNOFG = 12;
    private static int CurrentTheme = -1;

    public static void SetGlobalTheme(int theme)
    {
        if (CurrentTheme == theme)
        {
            return;
        }

        CurrentTheme = theme;

        var forms = new List<Form>();
        foreach (Form form in Application.OpenForms)
        {
            forms.Add(form);
        }

        SetThemeToGlobal(forms);
    }

    public static int GetGlobalTheme() => CurrentTheme;

    public static void SetThemeToGlobal(Form form) => SetThemeToGlobal([form]);

    public static void SetThemeToGlobal(List<Form> forms)
    {
        MainForm.Instance?.Invoke(new Action(() =>
        {
            foreach (Form form in forms)
            {
                SetThemeToGlobal(form.Handle);

                form.Opacity = 0.99999;
                form.Opacity = 1;
            }
        }));
    }

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;

    private static void SetThemeToGlobal(IntPtr handle)
    {
        int isDark = CurrentTheme > 0 ? 1 : 0;
        if (PInvoke.DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref isDark, sizeof(int)) != 0)
        {
            _ = PInvoke.DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref isDark, sizeof(int));
        }

        int captionColor = CurrentTheme switch
        {
            2 => 0x000000,
            1 => 0x2B2B2B,
            _ => 0xFFFFFF,
        };
        _ = PInvoke.DwmSetWindowAttribute(handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));
    }

    public static void DoFunny()
    {
        foreach (Form form in Application.OpenForms)
        {
            _ = PInvoke.SetWindowLong(form.Handle, -20, 0x00C00000);
        }
    }

    private static FLASHWINFO CreateFlashWindowInfo(IntPtr handle, uint flags, uint count, uint timeout)
    {
        var fi = new FLASHWINFO();
        fi.CbSize = Convert.ToUInt32(Marshal.SizeOf(fi));
        fi.Hwnd = handle;
        fi.DwFlags = flags;
        fi.UCount = count;
        fi.DwTimeout = timeout;
        return fi;
    }

    public static bool Flash(Form form)
    {
        FLASHWINFO fi = CreateFlashWindowInfo(form.Handle, FLASHW_ALL | FLASHW_TIMERNOFG, uint.MaxValue, 0);
        return PInvoke.FlashWindowEx(ref fi);
    }

    internal static partial class PInvoke
    {
        [LibraryImport("DwmApi")]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        internal static partial int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

        [LibraryImport("DwmApi")]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        internal static partial int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, IntPtr pvAttribute, int cbAttribute);

        [LibraryImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        internal static partial int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        [LibraryImport("user32.dll", SetLastError = false)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static partial bool FlashWindowEx(ref FLASHWINFO pwfi);
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct FLASHWINFO
    {
        public uint CbSize;
        public IntPtr Hwnd;
        public uint DwFlags;
        public uint UCount;
        public uint DwTimeout;
    }
}
