using System.Collections.Concurrent;
using System.IO.Pipes;

namespace VRCX;

internal sealed class IPCServer
{
    public static readonly IPCServer Instance;
    public static readonly ConcurrentDictionary<IPCClient, byte> Clients = new();

    static IPCServer()
    {
        Instance = new IPCServer();
    }

    public void Init() => new IPCServer().CreateIPCServer();

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
        var ipcServer = new NamedPipeServerStream(GetIpcName(), PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
        ipcServer.BeginWaitForConnection(DoAccept, ipcServer);
    }

    private void DoAccept(IAsyncResult asyncResult)
    {
        var ipcServer = (NamedPipeServerStream)asyncResult.AsyncState;

        try
        {
            ipcServer.EndWaitForConnection(asyncResult);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
        }

        var ipcClient = new IPCClient(ipcServer);
        Clients.TryAdd(ipcClient, 0);
        ipcClient.BeginRead();
        CreateIPCServer();
    }
}
