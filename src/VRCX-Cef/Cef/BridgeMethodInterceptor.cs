using System.Reflection;
using CefSharp.ModelBinding;

namespace VRCX.Cef;

internal sealed class BridgeMethodInterceptor : IMethodInterceptor
{
    private readonly ILookup<string, ParameterInfo[]> _parametersByMethod;

    public BridgeMethodInterceptor(Type boundType)
    {
        _parametersByMethod = boundType
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .ToLookup(method => method.Name, method => method.GetParameters(), StringComparer.Ordinal);
    }

    public object Intercept(Func<object[], object> method, object[] parameters, string methodName)
    {
        ParameterInfo[]? expected = _parametersByMethod[methodName].FirstOrDefault(candidate => candidate.Length >= parameters.Length);
        if (expected is not null)
        {
            for (int index = 0; index < parameters.Length; index++)
            {
                Type? elementType = expected[index].ParameterType.GetElementType();
                if (parameters[index] is null && expected[index].ParameterType.IsArray && elementType is not null)
                {
                    parameters[index] = Array.CreateInstance(elementType, 0);
                }
            }
        }

        return method(parameters);
    }
}
