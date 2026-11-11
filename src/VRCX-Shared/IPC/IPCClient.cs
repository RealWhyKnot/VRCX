using System.Globalization;
using System.IO.Pipes;
using System.Text;
using Newtonsoft.Json;

#if !LINUX
using CefSharp;
using VRCX.Cef;
#endif

namespace VRCX.IPC;

internal sealed class IPCClient
{
    private static readonly UTF8Encoding NoBomEncoding = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false);
    private readonly NamedPipeServerStream _ipcServer;
    private readonly byte[] _recvBuffer = new byte[1024 * 8];
    private readonly byte[] _packetBuffer = new byte[1024 * 1024];
    private readonly JsonSerializer _serializer = new();
    private string _currentPacket = string.Empty;

    public IPCClient(NamedPipeServerStream ipcServer)
    {
        _serializer.Culture = CultureInfo.InvariantCulture;
        _serializer.Formatting = Formatting.None;

        _ipcServer = ipcServer;
    }

    public void BeginAccept(AsyncCallback callback) => _ipcServer.BeginWaitForConnection(callback, this);

    public void EndAccept(IAsyncResult asyncResult) => _ipcServer.EndWaitForConnection(asyncResult);

    public void BeginRead() => _ipcServer.BeginRead(_recvBuffer, 0, _recvBuffer.Length, OnRead, _ipcServer);

    public void Send(IPCPacket ipcPacket)
    {
        try
        {
            using var memoryStream = new MemoryStream(_packetBuffer);
            using (var streamWriter = new StreamWriter(memoryStream, NoBomEncoding, 65535, leaveOpen: true))
            using (var writer = new JsonTextWriter(streamWriter))
            {
                _serializer.Serialize(writer, ipcPacket);
                streamWriter.Write((char)0x00);
                streamWriter.Flush();
            }

            int length = (int)memoryStream.Position;
            _ipcServer?.BeginWrite(_packetBuffer, 0, length, OnSend, state: null);
        }
        catch (Exception e) when (e is IOException or ObjectDisposedException or InvalidOperationException or NotSupportedException or JsonException)
        {
            IPCServer.Clients.TryRemove(this, out _);
        }
    }

    private void OnRead(IAsyncResult asyncResult)
    {
        try
        {
            int bytesRead = _ipcServer.EndRead(asyncResult);

            if (bytesRead <= 0)
            {
                IPCServer.Clients.TryRemove(this, out _);
                _ipcServer.Close();
                return;
            }

            _currentPacket += Encoding.UTF8.GetString(_recvBuffer, 0, bytesRead);

            if (_currentPacket[^1] == (char)0x00)
            {
                string[] packets = _currentPacket.Split((char)0x00);

                foreach (string packet in packets)
                {
                    if (string.IsNullOrEmpty(packet))
                    {
                        continue;
                    }

#if !LINUX
                    if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading && MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
                    {
                        MainForm.Instance.Browser.ExecuteScriptAsync("window?.$pinia?.vrcx.ipcEvent", packet);
                    }
#endif
                }

                _currentPacket = string.Empty;
            }
        }
        catch (Exception e) when (e is IOException or ObjectDisposedException or InvalidOperationException or ArgumentException)
        {
            Console.WriteLine(e);
        }

        BeginRead();
    }

    public static void OnSend(IAsyncResult asyncResult)
    {
        var ipcClient = (NamedPipeClientStream?)asyncResult.AsyncState;
        ipcClient?.EndWrite(asyncResult);
    }

    public static void Close(IAsyncResult asyncResult)
    {
        var ipcClient = (NamedPipeClientStream?)asyncResult.AsyncState;
        ipcClient?.EndWrite(asyncResult);
        ipcClient?.Close();
    }
}
