using System.Runtime.InteropServices;

namespace VRCX.Overlay.Electron;

public static partial class GLContextX11
{
    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr XOpenDisplay(IntPtr display);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XDefaultScreen(IntPtr display);

    [LibraryImport("libGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr glXChooseVisual(IntPtr display, int screen, int[] attribList);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr XCreateSimpleWindow(IntPtr display, IntPtr parent, int x, int y, uint width, uint height, uint border_width, ulong border, ulong background);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XMapWindow(IntPtr display, IntPtr window);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XUnmapWindow(IntPtr display, IntPtr window);

    [LibraryImport("libGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr glXCreateContext(IntPtr display, IntPtr visual, IntPtr shareList, [MarshalAs(UnmanagedType.Bool)] bool direct);

    [LibraryImport("libGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool glXMakeCurrent(IntPtr display, IntPtr drawable, IntPtr context);

    [LibraryImport("libGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial void glXDestroyContext(IntPtr display, IntPtr context);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XDestroyWindow(IntPtr display, IntPtr window);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XCloseDisplay(IntPtr display);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XFlush(IntPtr display);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr XRootWindow(IntPtr display, int screen);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XStoreName(IntPtr display, IntPtr window, string window_name);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XChangeWindowAttributes(IntPtr display, IntPtr window, ulong valuemask, ref XSetWindowAttributes attributes);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XMoveWindow(IntPtr display, IntPtr window, int x, int y);

    [LibraryImport("libX11.so.6", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int XResizeWindow(IntPtr display, IntPtr window, uint width, uint height);

    [StructLayout(LayoutKind.Sequential)]
    private struct XSetWindowAttributes
    {
        public IntPtr BackgroundPixmap;
        public ulong BackgroundPixel;
        public IntPtr BorderPixmap;
        public ulong BorderPixel;
        public int BitGravity;
        public int WinGravity;
        public int BackingStore;
        public ulong BackingPlanes;
        public ulong BackingPixel;
        public int SaveUnder;
        public long EventMask;
        public long DoNotPropagateMask;
        public int OverrideRedirect;
        public IntPtr Colormap;
        public IntPtr Cursor;
    }

    private const ulong CWOverrideRedirect = 0x00000200;
    private const ulong CWBackPixel = 0x00000002;
    private const ulong CWBorderPixel = 0x00000008;

    private static IntPtr Display;
    private static IntPtr Window;
    private static IntPtr Context;

    public static bool Initialise()
    {
        try
        {
            Display = XOpenDisplay(IntPtr.Zero);
            if (Display == IntPtr.Zero)
            {
                Console.WriteLine("No X11 display available");
                return false;
            }

            int screen = XDefaultScreen(Display);
            int[] attribs = [4, 1, 5, 1, 12, 1, 0];
            IntPtr visual = glXChooseVisual(Display, screen, attribs);
            if (visual == IntPtr.Zero)
            {
                Console.WriteLine("Failed to find a GLX visual");
                return false;
            }

            return CreateHiddenWindow(screen) && CreateGlContext(visual);
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException)
        {
            Console.WriteLine($"Failed to initialize OpenGL context: {ex.Message}");
            return false;
        }
    }

    private static bool CreateHiddenWindow(int screen)
    {
        IntPtr root = XRootWindow(Display, screen);
        Window = XCreateSimpleWindow(Display, root, -10000, -10000, 1, 1, 0, 0, 0);
        if (Window == IntPtr.Zero)
        {
            Console.WriteLine("Failed to create X11 window");
            return false;
        }

        var attrs = new XSetWindowAttributes
        {
            OverrideRedirect = 1,
            BackgroundPixel = 0,
            BorderPixel = 0,
        };

        _ = XChangeWindowAttributes(Display, Window, CWOverrideRedirect | CWBackPixel | CWBorderPixel, ref attrs);
        _ = XStoreName(Display, Window, "Hidden OpenGL Context");
        return true;
    }

    private static bool CreateGlContext(IntPtr visual)
    {
        Context = glXCreateContext(Display, visual, IntPtr.Zero, direct: true);
        if (Context == IntPtr.Zero)
        {
            Console.WriteLine("Failed to create GLX context");
            return false;
        }

        if (!glXMakeCurrent(Display, Window, Context))
        {
            Console.WriteLine("Failed to make GLX context current");
            return false;
        }

        _ = XFlush(Display);

        Console.WriteLine("OpenGL context created successfully (X11/GLX)");
        return true;
    }

    public static void Cleanup()
    {
        if (Display != IntPtr.Zero)
        {
            if (Context != IntPtr.Zero)
            {
                glXDestroyContext(Display, Context);
            }

            if (Window != IntPtr.Zero)
            {
                _ = XDestroyWindow(Display, Window);
            }

            _ = XCloseDisplay(Display);
            Display = IntPtr.Zero;
            Window = IntPtr.Zero;
            Context = IntPtr.Zero;
        }
    }
}
