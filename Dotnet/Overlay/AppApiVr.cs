namespace VRCX.Overlay;

#if LINUX
public
#else
internal
#endif
abstract partial class AppApiVr
{
    public static AppApiVr? Instance { get; set; }
    public abstract void Init();
    public abstract void VrInit();
    public abstract void ToggleSystemMonitor(bool enabled);
    public abstract float CpuUsage();
    public abstract string[][] GetVRDevices();
    public abstract double GetUptime();
    public abstract string CurrentCulture();
    public abstract string CustomVrScript();
    public abstract IList<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue();
}
