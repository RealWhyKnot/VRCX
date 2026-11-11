using System.Globalization;
namespace VRCX.Overlay.Electron;

public sealed class AppApiVrElectron : AppApiVr
{
    public override void Init()
    {
    }

    public override void VrInit()
    {
    }

    public override IList<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue()
    {
        var list = new List<KeyValuePair<string, string>>();
        while (Program.VRCXVRInstance.GetExecuteVrOverlayFunctionQueue().TryDequeue(out KeyValuePair<string, string> item))
        {
            list.Add(item);
        }
        return list;
    }

    public override void ToggleSystemMonitor(bool enabled) => SystemMonitorElectron.Instance.Start(enabled);

    public override float CpuUsage() => SystemMonitorElectron.Instance.CpuUsage;

    public override string[][] GetVRDevices() => Program.VRCXVRInstance.GetDevices();

    public override double GetUptime() => SystemMonitorElectron.Instance.UpTime;

    public override string CurrentCulture() => CultureInfo.CurrentCulture.ToString();

    public override string CustomVrScript()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "customvr.js");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }
}
