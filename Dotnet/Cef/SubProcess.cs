using System.Reflection;
using CefSharp.Internals;

namespace VRCX;

internal sealed class BrowserSubprocess
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
        Type? browserSubprocessExecutableType = browserSubprocessDll.GetType("CefSharp.BrowserSubprocess.BrowserSubprocessExecutable");
        _ = Activator.CreateInstance(browserSubprocessExecutableType);

        MethodInfo? mainMethod = browserSubprocessExecutableType.GetMethod("MainSelfHost", BindingFlags.Static | BindingFlags.Public);
        _ = mainMethod.GetParameters();

        object[] methodArgs = [args];
        while (true)
        {

            int exitCode;
            try
            {
                exitCode = (int)mainMethod.Invoke(null, methodArgs);
            }
            catch (Exception ex)
            {

                Console.WriteLine("Exception in BrowserSubprocess: " + ex);
                Thread.Sleep(1000);
                continue;
            }
            Environment.Exit(exitCode);
        }
    }
}

