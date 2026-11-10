using System.Globalization;
using VRCX.Overlay;

namespace VRCX;

internal sealed class AppApiVrCef : AppApiVr
{
    static AppApiVrCef()
    {
        Instance = new AppApiVrCef();
    }

    public override void Init()
    {

    }

    public override void VrInit()
    {

        var message = new OverlayMessage
        {
            Type = OverlayMessageType.OverlayConnected,
        };
        OverlayClient.SendMessage(message);
    }

    public override void ToggleSystemMonitor(bool enabled) => SystemMonitorCef.Instance.Start(enabled);





    public override float CpuUsage() => SystemMonitorCef.Instance.CpuUsage;






    public override string[][] GetVRDevices() => OverlayProgram.VRCXVRInstance.GetDevices();





    public override double GetUptime() => SystemMonitorCef.Instance.UpTime;





    public override string CurrentCulture() => CultureInfo.CurrentCulture.ToString();

    public override string CustomVrScript()
    {
        string filePath = Path.Join(Program.AppDataDirectory, "customvr.js");
        return File.Exists(filePath) ? File.ReadAllText(filePath) : string.Empty;
    }

    public override List<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => throw new NotImplementedException("GetExecuteVrOverlayFunctionQueue is not implemented in AppApiVrCef.");
}
