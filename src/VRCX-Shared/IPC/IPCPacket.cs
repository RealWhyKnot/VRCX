namespace VRCX.IPC;

internal sealed class IPCPacket
{
    public string? Type { get; set; }
    public string? Data { get; set; }
    public string? MsgType { get; set; }
}
