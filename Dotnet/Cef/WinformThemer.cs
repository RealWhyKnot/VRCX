using System.Runtime.InteropServices;

namespace VRCX;




internal static class WinformThemer
{




    public const uint FLASHW_ALL = 3;




    public const uint FLASHW_TIMERNOFG = 12;




    private static int currentTheme = -1;







    public static void SetGlobalTheme(int theme)
    {
        if (currentTheme == theme)
        {
            return;
        }

        currentTheme = theme;


        var forms = new List<Form>();
        foreach (Form form in Application.OpenForms)
        {
            forms.Add(form);
        }

        SetThemeToGlobal(forms);
    }






    public static int GetGlobalTheme() => currentTheme;





    public static void SetThemeToGlobal(Form form) => SetThemeToGlobal([form]);





    public static void SetThemeToGlobal(List<Form> forms)
    {
        MainForm.Instance.Invoke(new Action(() =>
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
        int whiteColor = 0xFFFFFF;
        int blackColor = 0x000000;
        int greyColor = 0x2B2B2B;

        int isDark = currentTheme > 0 ? 1 : 0;
        if (PInvoke.DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref isDark, sizeof(int)) != 0)
        {
            PInvoke.DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref isDark, sizeof(int));
        }

        if (currentTheme == 2)
        {
            PInvoke.DwmSetWindowAttribute(handle, DWMWA_CAPTION_COLOR, ref blackColor, sizeof(int));
        }
        else if (currentTheme == 1)
        {
            PInvoke.DwmSetWindowAttribute(handle, DWMWA_CAPTION_COLOR, ref greyColor, sizeof(int));
        }
        else
        {
            PInvoke.DwmSetWindowAttribute(handle, DWMWA_CAPTION_COLOR, ref whiteColor, sizeof(int));
        }
    }

    public static void DoFunny()
    {
        foreach (Form form in Application.OpenForms)
        {
            PInvoke.SetWindowLong(form.Handle, -20, 0x00C00000);

        }
    }

    private static FLASHWINFO Create_FLASHWINFO(IntPtr handle, uint flags, uint count, uint timeout)
    {
        var fi = new FLASHWINFO();
        fi.cbSize = Convert.ToUInt32(Marshal.SizeOf(fi));
        fi.hwnd = handle;
        fi.dwFlags = flags;
        fi.uCount = count;
        fi.dwTimeout = timeout;
        return fi;
    }






    public static bool Flash(Form form)
    {
        FLASHWINFO fi = Create_FLASHWINFO(form.Handle, FLASHW_ALL | FLASHW_TIMERNOFG, uint.MaxValue, 0);
        return PInvoke.FlashWindowEx(ref fi);
    }

    internal static class PInvoke
    {
        [DllImport("DwmApi")]
        internal static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

        [DllImport("DwmApi")]
        internal static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, IntPtr pvAttribute, int cbAttribute);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        internal static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool FlashWindowEx(ref FLASHWINFO pwfi);
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct FLASHWINFO
    {



        public uint cbSize;




        public IntPtr hwnd;




        public uint dwFlags;




        public uint uCount;





        public uint dwTimeout;
    }
}
