using System.Collections.Concurrent;

namespace VRCX.Overlay;

internal abstract class VRCXVRInterface
{
    public bool IsHmdAfk { get; set; }
    public abstract void Init();
    public abstract void Shutdown();
    public abstract void Refresh();
    public abstract void Restart();
    public abstract void SetActive(bool active, bool hmdOverlay, bool wristOverlay, bool menuButton, int overlayHand);
    public abstract bool IsActive();
    public abstract string[][] GetDevices();
    public abstract void ExecuteVrOverlayFunction(string functionName, string json);
    public abstract ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue();
}
