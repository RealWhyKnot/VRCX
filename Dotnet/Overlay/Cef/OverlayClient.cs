using System.Net.WebSockets;
using System.Text.Json;
using NLog;
using VRCX.Overlay;
using Websocket.Client;

namespace VRCX;

internal static class OverlayClient
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    private static readonly Uri WebsocketUri = new("ws://127.0.0.1:34582");
    private static WebsocketClient? _websocketClient;

    public static bool Connected =>
        _websocketClient != null && _websocketClient.IsRunning;
    public static bool ConnectedAndActive =>
        Connected &&
        OverlayProgram.VRCXVRInstance.IsActive();

    public static Task InitAsync()
    {
        if (_websocketClient != null)
        {
            return Task.CompletedTask;
        }

        var clientFactory = new Func<ClientWebSocket>(() =>
        {
            var client = new ClientWebSocket();
            client.Options.KeepAliveInterval = TimeSpan.FromSeconds(5);
            client.Options.SetRequestHeader("user-agent", "VRCX Overlay Client");
            return client;
        });
        _websocketClient = new WebsocketClient(WebsocketUri, clientFactory)
        {
            Name = "VRCX Overlay Client",
            ReconnectTimeout = null,
            ErrorReconnectTimeout = TimeSpan.FromMilliseconds(300),
        };

        _websocketClient.ReconnectionHappened.Subscribe(info =>
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Connection happened, type: {0}", info?.Type.ToString());
            var message = new OverlayMessage
            {
                Type = OverlayMessageType.OverlayConnected,
                Data = "VRCX Overlay Client Connected",
            };
            _websocketClient.Send(JsonSerializer.Serialize(message));
        });
        _websocketClient.DisconnectionHappened.Subscribe(info =>
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Disconnection happened, type: {0}", info?.Type.ToString());
        });
        _websocketClient.MessageReceived.Subscribe(msg =>
        {
            try
            {
                OverlayMessage? message = JsonSerializer.Deserialize<OverlayMessage>(msg.Text!);
                HandleMessage(message);
            }
            catch (Exception e)
            {
                Logger.Error(e, "Error handling message");
            }
        });

        _websocketClient.Start();
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX overlay client initialized");
        return Task.CompletedTask;
    }

    private static void HandleMessage(OverlayMessage message)
    {
        Logger.Trace(System.Globalization.CultureInfo.InvariantCulture, "Message received: {0}", message.Type.ToString());
        switch (message.Type)
        {
            case OverlayMessageType.OverlayConnected:
                break;

            case OverlayMessageType.JsFunctionCall:
                OverlayProgram.VRCXVRInstance.ExecuteVrOverlayFunction(message.FunctionName, message.Data);
                break;

            case OverlayMessageType.UpdateVars:
                OverlayVars? overlayVars = message.OverlayVars;
                if (overlayVars == null)
                {
                    Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "UpdateVars is null");
                    return;
                }
                OverlayProgram.VRCXVRInstance.SetActive(overlayVars.Active, overlayVars.HmdOverlay, overlayVars.WristOverlay,
                    overlayVars.MenuButton, overlayVars.OverlayHand);
                break;
            case OverlayMessageType.IsHmdAfk:
                break;
            default:
                throw new ArgumentOutOfRangeException();
        }

    }

    public static Task ExitAsync()
    {
        if (_websocketClient == null)
        {
            return Task.CompletedTask;
        }

        _websocketClient.Stop(WebSocketCloseStatus.NormalClosure, "Exiting");
        _websocketClient.Dispose();
        _websocketClient = null;
        return Task.CompletedTask;
    }

    public static void SendMessage(OverlayMessage message)
    {
        if (_websocketClient == null || !_websocketClient.IsRunning)
        {
            return;
        }

        _websocketClient.Send(JsonSerializer.Serialize(message));
    }
}
