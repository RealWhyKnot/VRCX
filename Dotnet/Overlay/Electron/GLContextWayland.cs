using System.Runtime.InteropServices;

namespace VRCX.Overlay.Electron;

public static partial class GLContextWayland
{
    [LibraryImport("libwayland-client.so.0", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr wl_display_connect(string? name);

    [LibraryImport("libwayland-client.so.0", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial void wl_display_disconnect(IntPtr display);

    [LibraryImport("libwayland-client.so.0", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int wl_display_roundtrip(IntPtr display);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr eglGetDisplay(IntPtr display_id);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglInitialize(IntPtr display, out int major, out int minor);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglTerminate(IntPtr display);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglChooseConfig(IntPtr display, int[] attrib_list, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 3)] IntPtr[] configs, int config_size, out int num_config);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr eglCreatePbufferSurface(IntPtr display, IntPtr config, int[] attrib_list);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr eglCreateContext(IntPtr display, IntPtr config, IntPtr share_context, int[] attrib_list);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglMakeCurrent(IntPtr display, IntPtr draw, IntPtr read, IntPtr context);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglDestroySurface(IntPtr display, IntPtr surface);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool eglDestroyContext(IntPtr display, IntPtr context);

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial int eglGetError();

    [LibraryImport("libEGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr eglQueryString(IntPtr display, int name);

    [LibraryImport("libGL.so.1", StringMarshalling = StringMarshalling.Utf8)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static partial IntPtr glGetString(int name);

    private const int EGL_SURFACE_TYPE = 0x3033;
    private const int EGL_PBUFFER_BIT = 0x0001;
    private const int EGL_RENDERABLE_TYPE = 0x3040;
    private const int EGL_OPENGL_BIT = 0x0008;
    private const int EGL_RED_SIZE = 0x3024;
    private const int EGL_GREEN_SIZE = 0x3023;
    private const int EGL_BLUE_SIZE = 0x3022;
    private const int EGL_ALPHA_SIZE = 0x3021;
    private const int EGL_DEPTH_SIZE = 0x3025;
    private const int EGL_NONE = 0x3038;
    private const int EGL_WIDTH = 0x3057;
    private const int EGL_HEIGHT = 0x3056;
    private static IntPtr WaylandDisplay;
    private static IntPtr EglDisplay;
    private static IntPtr EglContext;
    private static IntPtr EglSurface;

    public static bool Initialise()
    {
        try
        {
            WaylandDisplay = wl_display_connect(name: null);
            if (WaylandDisplay == IntPtr.Zero)
            {
                Console.WriteLine("Failed to connect to Wayland display");
                return false;
            }

            _ = wl_display_roundtrip(WaylandDisplay);

            EglDisplay = eglGetDisplay(WaylandDisplay);
            if (EglDisplay == IntPtr.Zero)
            {
                Console.WriteLine("Failed to get EGL display");
                return false;
            }

            if (!eglInitialize(EglDisplay, out int major, out int minor))
            {
                Console.WriteLine($"Failed to initialize EGL. Error: 0x{eglGetError():X}");
                return false;
            }

            Console.WriteLine($"EGL version: {major}.{minor}");
            return CreateEglContext();
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException)
        {
            Console.WriteLine($"Failed to initialize OpenGL context: {ex.Message}");
            return false;
        }
    }

    private static bool CreateEglContext()
    {
        int[] configAttribs =
        [
            EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
            EGL_RENDERABLE_TYPE, EGL_OPENGL_BIT,
            EGL_RED_SIZE, 8,
            EGL_GREEN_SIZE, 8,
            EGL_BLUE_SIZE, 8,
            EGL_ALPHA_SIZE, 8,
            EGL_DEPTH_SIZE, 24,
            EGL_NONE,
        ];

        IntPtr[] configs = new IntPtr[10];
        if (!eglChooseConfig(EglDisplay, configAttribs, configs, 10, out int numConfigs) || numConfigs == 0)
        {
            Console.WriteLine($"Failed to choose EGL config. Error: 0x{eglGetError():X}");
            return false;
        }

        Console.WriteLine($"Found {numConfigs} EGL configs");
        IntPtr config = configs[0];

        int[] pbufferAttribs =
        [
            EGL_WIDTH, 1,
            EGL_HEIGHT, 1,
            EGL_NONE,
        ];

        EglSurface = eglCreatePbufferSurface(EglDisplay, config, pbufferAttribs);
        if (EglSurface == IntPtr.Zero)
        {
            Console.WriteLine($"Failed to create EGL pbuffer surface. Error: 0x{eglGetError():X}");
            return false;
        }

        int[] contextAttribs = [EGL_NONE];
        EglContext = eglCreateContext(EglDisplay, config, IntPtr.Zero, contextAttribs);
        if (EglContext == IntPtr.Zero)
        {
            Console.WriteLine($"Failed to create EGL context. Error: 0x{eglGetError():X}");
            return false;
        }

        if (!eglMakeCurrent(EglDisplay, EglSurface, EglSurface, EglContext))
        {
            Console.WriteLine($"Failed to make EGL context current. Error: 0x{eglGetError():X}");
            return false;
        }

        Console.WriteLine("OpenGL context created successfully (Wayland/EGL offscreen)");
        return true;
    }

    public static void Cleanup()
    {
        if (EglDisplay != IntPtr.Zero)
        {
            if (EglContext != IntPtr.Zero)
            {
                _ = eglMakeCurrent(EglDisplay, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
                _ = eglDestroyContext(EglDisplay, EglContext);
            }

            if (EglSurface != IntPtr.Zero)
            {
                _ = eglDestroySurface(EglDisplay, EglSurface);
            }

            _ = eglTerminate(EglDisplay);
        }

        if (WaylandDisplay != IntPtr.Zero)
        {
            wl_display_disconnect(WaylandDisplay);
        }

        WaylandDisplay = IntPtr.Zero;
        EglDisplay = IntPtr.Zero;
        EglContext = IntPtr.Zero;
        EglSurface = IntPtr.Zero;
    }
}
