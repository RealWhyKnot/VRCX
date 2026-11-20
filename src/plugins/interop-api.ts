import { electronInterop } from "../ipc-electron/interop-api.ts";
import { configRepository } from "../services/config.ts";
import { VrcxJsonStorage } from "../services/json-storage.ts";
import { unwrapBridgeArguments } from "../shared/utils/bridge-arguments.ts";

const appBridgeNames = ["AppApi", "WebApi", "VRCXStorage", "DatabaseApi", "LogWatcher", "Discord", "AssetBundleManager"] as const;
type CefBridgeName = (typeof appBridgeNames)[number] | "AppApiVr";
const wrappedCefMethods = new WeakSet<object>();

async function bindCefBridges(...names: CefBridgeName[]) {
  await CefSharp.BindObjectAsync(...names);

  for (const name of names) {
    const bridge = window[name];
    const methods: [string, unknown][] = Object.entries(bridge);
    for (const [methodName, method] of methods) {
      if (typeof method !== "function" || wrappedCefMethods.has(method)) {
        continue;
      }

      const wrappedMethod = new Proxy(method, {
        apply(target, receiver: unknown, args): unknown {
          return Reflect.apply(target, receiver, unwrapBridgeArguments(args));
        },
      });
      wrappedCefMethods.add(wrappedMethod);
      Object.assign(bridge, { [methodName]: wrappedMethod });
    }
  }
}

export async function initInteropApi(isVrOverlay = false) {
  if (isVrOverlay) {
    if (isHostWindows) {
      await bindCefBridges("AppApiVr");
    } else {
      Object.assign(window, { AppApiVr: electronInterop.bridge("AppApiVrElectron") });
    }
  } else {
    if (isHostWindows) {
      await bindCefBridges(...appBridgeNames);
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
