import { electronInterop } from "../ipc-electron/interop-api.ts";
import { configRepository } from "../services/config.ts";
import { VrcxJsonStorage } from "../services/json-storage.ts";

export async function initInteropApi(isVrOverlay = false) {
  if (isVrOverlay) {
    if (isHostWindows) {
      await CefSharp.BindObjectAsync("AppApiVr");
    } else {
      Object.assign(window, { AppApiVr: electronInterop.bridge("AppApiVrElectron") });
    }
  } else {
    if (isHostWindows) {
      await CefSharp.BindObjectAsync("AppApi", "WebApi", "VRCXStorage", "DatabaseApi", "LogWatcher", "Discord", "AssetBundleManager");
    } else {
      Object.assign(window, {
        AppApi: electronInterop.bridge("AppApiElectron"),
        WebApi: electronInterop.bridge("WebApi"),
        VRCXStorage: electronInterop.bridge("VRCXStorage"),
        DatabaseApi: electronInterop.bridge("DatabaseApi"),
        LogWatcher: electronInterop.bridge("LogWatcher"),
        Discord: electronInterop.bridge("Discord"),
        AssetBundleManager: electronInterop.bridge("AssetBundleManager"),
        AppApiVrElectron: electronInterop.bridge("AppApiVrElectron"),
      });
    }

    await configRepository.init();
    new VrcxJsonStorage(VRCXStorage);

    AppApi.SetUserAgent().catch((error: unknown) => {
      console.error("Failed to set user agent", error);
    });
  }
}
