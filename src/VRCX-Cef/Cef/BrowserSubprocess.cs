using System.Reflection;
using CefSharp.Internals;

namespace VRCX.Cef;

internal static class BrowserSubprocess
{
    public static void Start()
    {
        string[] args = Environment.GetCommandLineArgs();
        string type = CommandLineArgsParser.GetArgumentValue(args, CefSharpArguments.SubProcessTypeArgument);

        if (string.IsNullOrEmpty(type))
        {
            return;
        }

        string browserSubprocessDllPath = Path.Join(AppDomain.CurrentDomain.BaseDirectory, "CefSharp.BrowserSubprocess.Core.dll");
        if (!File.Exists(browserSubprocessDllPath))
        {
            browserSubprocessDllPath = Path.Join(Path.GetDirectoryName(typeof(CefSharp.Core.BrowserSettings).Assembly.Location), "CefSharp.BrowserSubprocess.Core.dll");
        }

        Assembly browserSubprocessDll = System.Runtime.Loader.AssemblyLoadContext.Default.LoadFromAssemblyPath(browserSubprocessDllPath);
        Type browserSubprocessExecutableType = browserSubprocessDll.GetType("CefSharp.BrowserSubprocess.BrowserSubprocessExecutable")
            ?? throw new TypeLoadException($"CefSharp.BrowserSubprocess.BrowserSubprocessExecutable was not found in {browserSubprocessDllPath}");
        _ = Activator.CreateInstance(browserSubprocessExecutableType);

        MethodInfo mainMethod = browserSubprocessExecutableType.GetMethod("MainSelfHost", BindingFlags.Static | BindingFlags.Public)
            ?? throw new MissingMethodException("CefSharp.BrowserSubprocess.BrowserSubprocessExecutable.MainSelfHost");

        object[] methodArgs = [args];
        while (true)
        {
            int exitCode;
            try
            {
                exitCode = (int)(mainMethod.Invoke(null, methodArgs) ?? throw new InvalidOperationException("MainSelfHost returned no exit code"));
            }
            catch (TargetInvocationException ex)
            {
                Console.WriteLine("Exception in BrowserSubprocess: " + ex);
                Thread.Sleep(1000);
                continue;
            }

            Environment.Exit(exitCode);
        }
    }
}
