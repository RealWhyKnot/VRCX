using System.Collections.Concurrent;
using System.IO.Pipes;

namespace VRCX.IPC;

internal sealed class IPCServer
{
    public static readonly ConcurrentDictionary<IPCClient, byte> Clients = new();

    public static void Init() => new IPCServer().CreateIPCServer();

    public static void Send(IPCPacket ipcPacket)
    {
        foreach (KeyValuePair<IPCClient, byte> client in Clients)
        {
            client.Key?.Send(ipcPacket);
        }
    }

    public static string GetIpcName()
    {
        int hash = 0;
        foreach (char c in Environment.UserName)
        {
            hash += c;
        }
        return $"vrcx-ipc-{hash}";
    }

    public void CreateIPCServer()
    {
        var ipcClient = new IPCClient(new(GetIpcName(), PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances, PipeTransmissionMode.Byte, PipeOptions.Asynchronous));
        ipcClient.BeginAccept(DoAccept);
    }

    private void DoAccept(IAsyncResult asyncResult)
    {
        if (asyncResult.AsyncState is not IPCClient ipcClient)
        {
            return;
        }

        try
        {
            ipcClient.EndAccept(asyncResult);
        }
        catch (Exception e) when (e is IOException or ObjectDisposedException or InvalidOperationException or ArgumentException)
        {
            Console.WriteLine(e);
        }

        Clients.TryAdd(ipcClient, 0);
        ipcClient.BeginRead();
        CreateIPCServer();
    }
}
