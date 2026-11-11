import { interopApi } from "../ipc-electron/interop-api.js";
import { configRepository } from "../services/config.js";
import { VrcxJsonStorage } from "../services/json-storage.js";

export async function initInteropApi(isVrOverlay = false) {
  if (isVrOverlay) {
    if (WINDOWS) {
      await CefSharp.BindObjectAsync("AppApiVr");
    } else {
      window.AppApiVr = interopApi.AppApiVrElectron;
    }
  } else {
    if (WINDOWS) {
      await CefSharp.BindObjectAsync("AppApi", "WebApi", "VRCXStorage", "SQLite", "LogWatcher", "Discord", "AssetBundleManager");
    } else {
      window.AppApi = interopApi.AppApiElectron;
      window.WebApi = interopApi.WebApi;
      window.VRCXStorage = interopApi.VRCXStorage;
      window.SQLite = interopApi.SQLite;
      window.LogWatcher = interopApi.LogWatcher;
      window.Discord = interopApi.Discord;
      window.AssetBundleManager = interopApi.AssetBundleManager;
      window.AppApiVrElectron = interopApi.AppApiVrElectron;
    }

    await configRepository.init();
    new VrcxJsonStorage(VRCXStorage);

    AppApi.SetUserAgent();
  }
}
