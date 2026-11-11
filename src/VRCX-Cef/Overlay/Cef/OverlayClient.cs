using System.Net.WebSockets;
using System.Text.Json;
using NLog;
using VRCX.OverlayWebSocket;
using Websocket.Client;

namespace VRCX.Overlay.Cef;

internal static class OverlayClient
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    private static readonly Uri WebsocketUri = new("ws://127.0.0.1:34582");
    private static WebsocketClient? WebsocketClientInstance;

    public static bool Connected =>
        WebsocketClientInstance != null && WebsocketClientInstance.IsRunning;
    public static bool ConnectedAndActive =>
        Connected &&
        OverlayProgram.RequireVrInstance().IsActive();

    public static void Init()
    {
        if (WebsocketClientInstance != null)
        {
            return;
        }

        var clientFactory = new Func<ClientWebSocket>(() =>
        {
            var client = new ClientWebSocket();
            client.Options.KeepAliveInterval = TimeSpan.FromSeconds(5);
            client.Options.SetRequestHeader("user-agent", "VRCX Overlay Client");
            return client;
        });
        WebsocketClientInstance = new WebsocketClient(WebsocketUri, clientFactory)
        {
            Name = "VRCX Overlay Client",
            ReconnectTimeout = null,
            ErrorReconnectTimeout = TimeSpan.FromMilliseconds(300),
        };

        WebsocketClientInstance.ReconnectionHappened.Subscribe(info =>
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Connection happened, type: {0}", info?.Type.ToString());
            var message = new OverlayMessage
            {
                Type = OverlayMessageType.OverlayConnected,
                Data = "VRCX Overlay Client Connected",
            };
            WebsocketClientInstance.Send(JsonSerializer.Serialize(message));
        });
        WebsocketClientInstance.DisconnectionHappened.Subscribe(info =>
        {
            Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "Disconnection happened, type: {0}", info?.Type.ToString());
        });
        WebsocketClientInstance.MessageReceived.Subscribe(msg =>
        {
            try
            {
                string text = msg.Text ?? throw new InvalidOperationException("Overlay message has no text");
                OverlayMessage message = JsonSerializer.Deserialize<OverlayMessage>(text) ?? throw new InvalidOperationException("Overlay message is empty");
                HandleMessage(message);
            }
            catch (Exception e) when (e is InvalidOperationException or JsonException or ArgumentException)
            {
                Logger.Error(System.Globalization.CultureInfo.InvariantCulture, $"Error handling message: {e}");
            }
        });

        _ = WebsocketClientInstance.Start();
        Logger.Info(System.Globalization.CultureInfo.InvariantCulture, "VRCX overlay client initialized");
    }

    private static void HandleMessage(OverlayMessage message)
    {
        Logger.Trace(System.Globalization.CultureInfo.InvariantCulture, "Message received: {0}", message.Type.ToString());
        switch (message.Type)
        {
            case OverlayMessageType.OverlayConnected:
                break;

            case OverlayMessageType.JsFunctionCall:
                string functionName = message.FunctionName ?? throw new InvalidOperationException("JsFunctionCall message has no function name");
                string data = message.Data ?? throw new InvalidOperationException("JsFunctionCall message has no data");
                OverlayProgram.RequireVrInstance().ExecuteVrOverlayFunction(functionName, data);
                break;

            case OverlayMessageType.UpdateVars:
                OverlayVars? overlayVars = message.OverlayVars;
                if (overlayVars == null)
                {
                    Logger.Error(System.Globalization.CultureInfo.InvariantCulture, "UpdateVars is null");
                    return;
                }
                OverlayProgram.RequireVrInstance().SetActive(overlayVars.Active, overlayVars.HmdOverlay, overlayVars.WristOverlay,
                    overlayVars.MenuButton, overlayVars.OverlayHand);
                break;
            case OverlayMessageType.IsHmdAfk:
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(message), message.Type, "Unsupported overlay message type");
        }
    }

    public static void Exit()
    {
        if (WebsocketClientInstance == null)
        {
            return;
        }

        _ = WebsocketClientInstance.Stop(WebSocketCloseStatus.NormalClosure, "Exiting");
        WebsocketClientInstance.Dispose();
        WebsocketClientInstance = null;
    }

    public static void SendMessage(OverlayMessage message)
    {
        if (WebsocketClientInstance == null || !WebsocketClientInstance.IsRunning)
        {
            return;
        }

        WebsocketClientInstance.Send(JsonSerializer.Serialize(message));
    }
}
