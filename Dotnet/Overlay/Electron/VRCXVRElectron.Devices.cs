using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using Valve.VR;

namespace VRCX.Overlay.Electron;

internal sealed partial class VRCXVRElectron
{
    public override string[][] GetDevices()
    {
        _deviceListLock.EnterReadLock();
        try
        {
            return [.. _deviceList];
        }
        finally
        {
            _deviceListLock.ExitReadLock();
        }
    }

    private void ClearDeviceList()
    {
        _deviceListLock.EnterWriteLock();
        try
        {
            _deviceList.Clear();
        }
        finally
        {
            _deviceListLock.ExitWriteLock();
        }
    }

    private void AddDevice(string[] device)
    {
        _deviceListLock.EnterWriteLock();
        try
        {
            _deviceList.Add(device);
        }
        finally
        {
            _deviceListLock.ExitWriteLock();
        }
    }

    private void UpdateDevices(CVRSystem system, ref uint overlayIndex)
    {
        ClearDeviceList();

        var sb = new StringBuilder(256);
        var state = new VRControllerState_t();
        var poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];
        system.GetDeviceToAbsoluteTrackingPose(ETrackingUniverseOrigin.TrackingUniverseStanding, 0, poses);
        for (uint i = 0u; i < OpenVR.k_unMaxTrackedDeviceCount; ++i)
        {
            ETrackedDeviceClass devClass = system.GetTrackedDeviceClass(i);
            switch (devClass)
            {
                case ETrackedDeviceClass.HMD:
                    AddHeadset(system, i, poses[i]);
                    break;
                case ETrackedDeviceClass.Controller:
                case ETrackedDeviceClass.GenericTracker:
                case ETrackedDeviceClass.TrackingReference:
                    AddTrackedDevice(system, i, devClass, poses[i], sb, ref state, ref overlayIndex);
                    break;
                case ETrackedDeviceClass.Invalid:
                case ETrackedDeviceClass.DisplayRedirect:
                case ETrackedDeviceClass.Max:
                    break;
                default:
                    break;
            }
        }
    }

    private void AddHeadset(CVRSystem system, uint index, TrackedDevicePose_t pose)
    {
        var state = new VRControllerState_t();
        if (!system.GetControllerState(index, ref state, (uint)Marshal.SizeOf(state)))
        {
            return;
        }

        ETrackedPropertyError err = ETrackedPropertyError.TrackedProp_Success;
        float batteryPercentage = system.GetFloatTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            return;
        }

        string[] headset =
        [
            "headset",
            system.IsTrackedDeviceConnected(index) ? "connected" : "disconnected",
            "discharging",
            (batteryPercentage * 100).ToString(CultureInfo.InvariantCulture),
            pose.eTrackingResult.ToString(),
        ];
        AddDevice(headset);
    }

    private void AddTrackedDevice(CVRSystem system, uint index, ETrackedDeviceClass devClass, TrackedDevicePose_t pose, StringBuilder sb, ref VRControllerState_t state, ref uint overlayIndex)
    {
        ETrackedPropertyError err = ETrackedPropertyError.TrackedProp_Success;
        float batteryPercentage = system.GetFloatTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            batteryPercentage = 1f;
        }

        err = ETrackedPropertyError.TrackedProp_Success;
        bool isCharging = system.GetBoolTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_DeviceIsCharging_Bool, ref err);
        if (err != ETrackedPropertyError.TrackedProp_Success)
        {
            isCharging = false;
        }

        sb.Clear();
        system.GetStringTrackedDeviceProperty(index, ETrackedDeviceProperty.Prop_TrackingSystemName_String, sb, (uint)sb.Capacity, ref err);
        bool isOculus = sb.ToString().Contains("oculus", StringComparison.OrdinalIgnoreCase);

        ETrackedControllerRole role = system.GetControllerRoleForTrackedDeviceIndex(index);
        if (role is ETrackedControllerRole.LeftHand or ETrackedControllerRole.RightHand)
        {
            TrySelectOverlayController(system, index, role, isOculus, ref state, ref overlayIndex);
        }

        string[] item =
        [
            DeviceTypeName(devClass, role),
            system.IsTrackedDeviceConnected(index) ? "connected" : "disconnected",
            isCharging ? "charging" : "discharging",
            (batteryPercentage * 100).ToString(CultureInfo.InvariantCulture),
            pose.eTrackingResult.ToString(),
        ];
        AddDevice(item);
    }

    private void TrySelectOverlayController(CVRSystem system, uint index, ETrackedControllerRole role, bool isOculus, ref VRControllerState_t state, ref uint overlayIndex)
    {
        bool handSelected = _overlayHand == 0 ||
            (_overlayHand == 1 && role == ETrackedControllerRole.LeftHand) ||
            (_overlayHand == 2 && role == ETrackedControllerRole.RightHand);
        if (!handSelected)
        {
            return;
        }

        uint buttonMask = _menuButton ? 2u : isOculus ? 128u : 4u;
        if (!system.GetControllerState(index, ref state, (uint)Marshal.SizeOf(state)) ||
            (state.ulButtonPressed & buttonMask) == 0)
        {
            return;
        }

        _nextOverlayUpdate = DateTime.MinValue;
        if (role == ETrackedControllerRole.LeftHand)
        {
            Array.Copy(TranslationLeft, Translation, 3);
            Array.Copy(RotationLeft, Rotation, 3);
        }
        else
        {
            Array.Copy(TranslationRight, Translation, 3);
            Array.Copy(RotationRight, Rotation, 3);
        }

        overlayIndex = index;
    }

    private static string DeviceTypeName(ETrackedDeviceClass devClass, ETrackedControllerRole role) => devClass switch
    {
        ETrackedDeviceClass.Controller => role == ETrackedControllerRole.LeftHand
            ? "leftController"
            : role == ETrackedControllerRole.RightHand ? "rightController" : "controller",
        ETrackedDeviceClass.GenericTracker => "tracker",
        ETrackedDeviceClass.TrackingReference => "base",
        ETrackedDeviceClass.Invalid or ETrackedDeviceClass.HMD or ETrackedDeviceClass.DisplayRedirect or ETrackedDeviceClass.Max => string.Empty,
        _ => string.Empty,
    };
}
