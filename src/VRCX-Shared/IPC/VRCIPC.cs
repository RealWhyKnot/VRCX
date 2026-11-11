using System.IO.Pipes;
using System.Text;

namespace VRCX.IPC;

internal static class VRCIPC
{
    private const string PipeName = "VRChatURLLaunchPipe";
    public static async Task<bool> SendAsync(string message, CancellationToken cancellationToken = default)
    {
        using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
        await client.ConnectAsync(1000, cancellationToken).ConfigureAwait(false);
        byte[] bytes = Encoding.UTF8.GetBytes(message);
        await client.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
        byte[] result = new byte[1];
        await client.ReadExactlyAsync(result, cancellationToken).ConfigureAwait(false);
        return result[0] == 1;
    }
}
