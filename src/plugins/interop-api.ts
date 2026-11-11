import { interopApi } from "../ipc-electron/interop-api.ts";
import { configRepository } from "../services/config.ts";
import { VrcxJsonStorage } from "../services/json-storage.ts";

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
      window.SQLite = interopApi.SQLiteDatabase;
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
