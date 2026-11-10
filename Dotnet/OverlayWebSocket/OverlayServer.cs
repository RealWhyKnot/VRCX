using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using CefSharp;
using NLog;

namespace VRCX;

internal sealed class OverlayServer
{
    public static OverlayServer Instance { get; private set; }

    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    private static readonly Lock SendLock = new();
    private static readonly ConcurrentDictionary<WebSocket, byte> ConnectedWebSockets = new();
    private static CancellationTokenSource _cancellationToken;

    private static OverlayVars _overlayVars;

    static OverlayServer()
    {
        Instance = new OverlayServer();
    }

    public async Task InitAsync()
    {
        if (_cancellationToken != null && _cancellationToken.IsCancellationRequested)
        {
            return;
        }

        _cancellationToken = new CancellationTokenSource();
        try
        {
            var listener = new HttpListener();
            listener.Prefixes.Add("http://127.0.0.1:34582/");
            listener.Start();
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Overlay IPC server started");
            while (_cancellationToken != null && !_cancellationToken.IsCancellationRequested)
            {
                HttpListenerContext listenerContext = await listener.GetContextAsync();
                if (listenerContext.Request.IsWebSocketRequest)
                {
                    ProcessRequestAsync(listenerContext);
                }
                else
                {
                    listenerContext.Response.StatusCode = 400;
                    listenerContext.Response.Close();
                }
            }
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
        }
    }

    public async Task ExitAsync()
    {
        if (_cancellationToken == null || _cancellationToken.IsCancellationRequested)
        {
            return;
        }

        foreach (WebSocket webSocket in ConnectedWebSockets.Keys)
        {
            if (webSocket == null || webSocket.State != WebSocketState.Open)
            {
                continue;
            }

            try
            {
                await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server shutting down", CancellationToken.None);
            }
            catch (Exception e)
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
            }
        }
        await _cancellationToken.CancelAsync();
        ConnectedWebSockets.Clear();
        _cancellationToken = null;
    }

    private async Task ProcessRequestAsync(HttpListenerContext listenerContext)
    {
        WebSocketContext webSocketContext;
        try
        {
            webSocketContext = await listenerContext.AcceptWebSocketAsync(subProtocol: null);
        }
        catch (Exception e)
        {
            listenerContext.Response.StatusCode = 500;
            listenerContext.Response.Close();
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
            return;
        }

        WebSocket webSocket = webSocketContext.WebSocket;
        try
        {
            ConnectedWebSockets.TryAdd(webSocket, 0);
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Overlay IPC connected, count: {0}", ConnectedWebSockets.Count);
            byte[] receiveBuffer = new byte[1024 * 5];
            while (webSocket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult receiveResult = await webSocket.ReceiveAsync(new ArraySegment<byte>(receiveBuffer), CancellationToken.None);
                switch (receiveResult.MessageType)
                {
                    case WebSocketMessageType.Text:
                        string text = Encoding.UTF8.GetString(receiveBuffer, 0, receiveResult.Count);
                        OverlayMessage? message = JsonSerializer.Deserialize<OverlayMessage>(text);
                        HandleMessageAsync(message);
                        continue;

                    case WebSocketMessageType.Close:
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
                        break;

                    case WebSocketMessageType.Binary:
                    default:
                        await webSocket.CloseAsync(WebSocketCloseStatus.InvalidMessageType, "Invalid message type", CancellationToken.None);
                        break;
                }
            }
        }
        catch (Exception e)
        {
            Logger.Error(System.Globalization.CultureInfo.InvariantCulture, e);
        }
        finally
        {
            webSocket.Dispose();
            ConnectedWebSockets.TryRemove(webSocket, out _);
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Overlay IPC disconnected, count: {0}", ConnectedWebSockets.Count);
        }
    }

    private Task HandleMessageAsync(OverlayMessage message)
    {
        Logger.Trace(System.Globalization.CultureInfo.InvariantCulture, $"Overlay IPC message received: {message.Type}");
        switch (message.Type)
        {
            case OverlayMessageType.OverlayConnected:
                var helloMessage = new OverlayMessage
                {
                    Type = OverlayMessageType.UpdateVars,
                    OverlayVars = _overlayVars,
                };
                SendMessage(helloMessage);
                if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading &&
                    MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
                {
                    MainForm.Instance.Browser.ExecuteScriptAsync("window?.$pinia?.vr.vrInit();");
                }

                break;

            case OverlayMessageType.IsHmdAfk:
                bool isHmdAfk = string.Equals(message.Data, "true", StringComparison.OrdinalIgnoreCase);
                if (MainForm.Instance?.Browser != null && !MainForm.Instance.Browser.IsLoading && MainForm.Instance.Browser.CanExecuteJavascriptInMainFrame)
                {
                    MainForm.Instance.Browser.ExecuteScriptAsync("window?.$bridge?.updateIsHmdAfk", isHmdAfk);
                }

                break;

            case OverlayMessageType.JsFunctionCall:
            case OverlayMessageType.UpdateVars:
            default:
                throw new ArgumentOutOfRangeException();
        }

        return Task.CompletedTask;
    }

    public void SendMessage(OverlayMessage message)
    {
        lock (SendLock)
        {
            var buffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message)));
            ICollection<WebSocket> connectedWebSockets = ConnectedWebSockets.Keys;
            Logger.Trace(System.Globalization.CultureInfo.InvariantCulture, $"Sending message to overlay Clients: {connectedWebSockets.Count}, IPC: {message.Type}");
            foreach (WebSocket webSocket in connectedWebSockets)
            {
                if (webSocket == null || webSocket.State != WebSocketState.Open)
                {
                    continue;
                }

                webSocket.SendAsync(buffer, WebSocketMessageType.Text, endOfMessage: true, CancellationToken.None);
            }
        }
    }

    public void UpdateVars(OverlayVars overlayVars)
    {
        _overlayVars = overlayVars;
        if (!IsConnected() && (overlayVars.Active || Program.LaunchDebug))
        {
            OverlayManager.StartOverlay();
            return;
        }

        var helloMessage = new OverlayMessage
        {
            Type = OverlayMessageType.UpdateVars,
            OverlayVars = overlayVars,
        };
        SendMessage(helloMessage);
    }

    public static bool IsConnected() => ConnectedWebSockets.Keys.Any(webSocket => webSocket != null && webSocket.State == WebSocketState.Open);
}
