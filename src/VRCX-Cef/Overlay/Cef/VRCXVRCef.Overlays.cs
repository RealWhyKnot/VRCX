using System.Collections.Concurrent;
using System.Numerics;
using CefSharp;
using Valve.VR;

namespace VRCX.Overlay.Cef;

internal sealed partial class VRCXVRCef
{
    private EVROverlayError ProcessWristOverlay(CVROverlay overlay, bool dashboardVisible)
    {
        EVROverlayError err;

        if (_wristOverlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX1", ref _wristOverlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                _wristOverlayVisible = false;
                err = CreateDefaultOverlay(overlay, "VRCX1", ref _wristOverlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        if (_overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
        {
            err = ApplyWristTransform(overlay);
            if (err != EVROverlayError.None)
            {
                return err;
            }
        }

        if (!dashboardVisible &&
            DateTime.UtcNow.CompareTo(_nextOverlayUpdate) <= 0)
        {
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 0.5f,
                vMin = 0f,
                vMax = (float)WRIST_SIZE / TOTAL_HEIGHT,
            };
            return ShowSharedTexture(overlay, _wristOverlayHandle, ref _wristOverlayVisible, bounds);
        }

        return _wristOverlayVisible ? HideOverlay(overlay, _wristOverlayHandle, ref _wristOverlayVisible) : EVROverlayError.None;
    }

    private EVROverlayError ApplyWristTransform(CVROverlay overlay)
    {
        var m = Matrix4x4.CreateScale(0.25f);
        m *= Matrix4x4.CreateRotationX(Rotation[0]);
        m *= Matrix4x4.CreateRotationY(Rotation[1]);
        m *= Matrix4x4.CreateRotationZ(Rotation[2]);
        m *= Matrix4x4.CreateTranslation(new Vector3(Translation[0], Translation[1], Translation[2]));
        HmdMatrix34_t transform = ToHmdMatrix34(m);
        return overlay.SetOverlayTransformTrackedDeviceRelative(_wristOverlayHandle, _overlayIndex, ref transform);
    }

    private EVROverlayError ProcessHmdOverlay(CVROverlay overlay, bool dashboardVisible)
    {
        EVROverlayError err;

        if (_hmdOverlayHandle == 0)
        {
            err = overlay.FindOverlay("VRCX2", ref _hmdOverlayHandle);
            if (err != EVROverlayError.None)
            {
                if (err != EVROverlayError.UnknownOverlay)
                {
                    return err;
                }

                _hmdOverlayVisible = false;
                err = CreateDefaultOverlay(overlay, "VRCX2", ref _hmdOverlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                var m = Matrix4x4.CreateScale(1f);
                m *= Matrix4x4.CreateTranslation(0, -0.3f, -1.5f);
                HmdMatrix34_t transform = ToHmdMatrix34(m);
                err = overlay.SetOverlayTransformTrackedDeviceRelative(_hmdOverlayHandle, OpenVR.k_unTrackedDeviceIndex_Hmd, ref transform);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }
        }

        if (!dashboardVisible)
        {
            var bounds = new VRTextureBounds_t
            {
                uMin = 0f,
                uMax = 1f,
                vMin = (float)(TOTAL_HEIGHT - HMD_HEIGHT) / TOTAL_HEIGHT,
                vMax = 1f,
            };
            return ShowSharedTexture(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible, bounds);
        }

        return _hmdOverlayVisible ? HideOverlay(overlay, _hmdOverlayHandle, ref _hmdOverlayVisible) : EVROverlayError.None;
    }

    private static EVROverlayError CreateDefaultOverlay(CVROverlay overlay, string name, ref ulong handle)
    {
        EVROverlayError err = overlay.CreateOverlay(name, name, ref handle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        err = overlay.SetOverlayAlpha(handle, 0.9f);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        err = overlay.SetOverlayWidthInMeters(handle, 1f);
        return err != EVROverlayError.None
            ? err
            : overlay.SetOverlayInputMethod(handle, VROverlayInputMethod.None);
    }

    private EVROverlayError ShowSharedTexture(CVROverlay overlay, ulong handle, ref bool visible, VRTextureBounds_t bounds)
    {
        EVROverlayError err;
        unsafe
        {
            var texture = new Texture_t
            {
                handle = (IntPtr)_sharedTexture.Handle,
            };
            err = overlay.SetOverlayTexture(handle, ref texture);
        }

        overlay.SetOverlayTextureBounds(handle, ref bounds);

        if (!visible)
        {
            err = overlay.ShowOverlay(handle);
            visible = true;
        }

        return err;
    }

    private static EVROverlayError HideOverlay(CVROverlay overlay, ulong handle, ref bool visible)
    {
        EVROverlayError err = overlay.HideOverlay(handle);
        if (err != EVROverlayError.None)
        {
            return err;
        }

        visible = false;
        return EVROverlayError.None;
    }

    private static HmdMatrix34_t ToHmdMatrix34(Matrix4x4 m) => new()
    {
        m0 = m.M11,
        m1 = m.M21,
        m2 = m.M31,
        m3 = m.M41,
        m4 = m.M12,
        m5 = m.M22,
        m6 = m.M32,
        m7 = m.M42,
        m8 = m.M13,
        m9 = m.M23,
        m10 = m.M33,
        m11 = m.M43,
    };

    public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue() => throw new NotSupportedException("GetExecuteVrOverlayFunctionQueue is not implemented in VRCXVRCef.");

    public override void ExecuteVrOverlayFunction(string functionName, string json)
    {
        OffScreenBrowser? overlay = SharedOverlay;
        if (overlay == null || overlay.IsLoading || !overlay.CanExecuteJavascriptInMainFrame)
        {
            return;
        }

        overlay.ExecuteScriptAsync($"$vr.{functionName}", json);
    }
}
