using System.Reflection;
using CefSharp.JavascriptBinding;

namespace VRCX.Cef;

internal sealed class BridgeNameConverter : IJavascriptNameConverter
{
    private const string AsyncSuffix = "Async";

    public string ConvertToJavascript(MemberInfo memberInfo)
    {
        string name = memberInfo.Name;
        bool isAsyncMethod = memberInfo is MethodInfo && name.Length > AsyncSuffix.Length && name.EndsWith(AsyncSuffix, StringComparison.Ordinal);
        return isAsyncMethod ? name[..^AsyncSuffix.Length] : name;
    }

    public string ConvertReturnedObjectPropertyAndFieldToNameJavascript(MemberInfo memberInfo) => memberInfo.Name;
}
