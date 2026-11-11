import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

type ManagedListener = (event: IpcRendererEvent, ...args: unknown[]) => void;
type TypedListener<T extends unknown[]> = (event: IpcRendererEvent, ...args: T) => void;
type WindowPosition = { x: string; y: string };
type WindowSize = { width: string; height: string };
type WindowState = "0" | "1" | "2";
type ThemeSource = "system" | "light" | "dark";

const managedListeners = new Map<string, ManagedListener>();

const WINDOW_STATES = ["0", "1", "2"] as const;
const VALID_CHANNELS = ["launch-command"];

function registerManagedListener<T extends unknown[]>(
  channel: string,
  accepts: (args: unknown[]) => args is T,
  callback: TypedListener<T>,
  mapKey?: string
): () => void {
  const key = mapKey ?? channel;
  const existingListener = managedListeners.get(key);
  if (existingListener) {
    ipcRenderer.removeListener(channel, existingListener);
  }

  const listener: ManagedListener = (event, ...args) => {
    if (accepts(args)) {
      callback(event, ...args);
    }
  };
  managedListeners.set(key, listener);
  ipcRenderer.on(channel, listener);

  return () => {
    const currentListener = managedListeners.get(key);
    if (currentListener === listener) {
      ipcRenderer.removeListener(channel, listener);
      managedListeners.delete(key);
    }
  };
}

function acceptNoArgs(_args: unknown[]): _args is [] {
  return true;
}

function acceptAnyArgs(_args: unknown[]): _args is unknown[] {
  return true;
}

function isThemeChangedArgs(args: unknown[]): args is [boolean] {
  return typeof args[0] === "boolean";
}

function isWindowPosition(value: unknown): value is WindowPosition {
  return typeof value === "object" && value !== null && "x" in value && "y" in value && typeof value.x === "string" && typeof value.y === "string";
}

function isWindowPositionArgs(args: unknown[]): args is [WindowPosition] {
  return isWindowPosition(args[0]);
}

function isWindowSize(value: unknown): value is WindowSize {
  return (
    typeof value === "object" && value !== null && "width" in value && "height" in value && typeof value.width === "string" && typeof value.height === "string"
  );
}

function isWindowSizeArgs(args: unknown[]): args is [WindowSize] {
  return isWindowSize(args[0]);
}

function isWindowState(value: unknown): value is WindowState {
  return WINDOW_STATES.some((state) => state === value);
}

function isWindowStateArgs(args: unknown[]): args is [WindowState] {
  return isWindowState(args[0]);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

async function invokeChecked<T>(channel: string, isResult: (value: unknown) => value is T, ...args: unknown[]): Promise<T> {
  const result: unknown = await ipcRenderer.invoke(channel, ...args);
  if (!isResult(result)) {
    throw new Error(`${channel} returned an unexpected value`);
  }
  return result;
}

contextBridge.exposeInMainWorld("isHostLinux", true);
contextBridge.exposeInMainWorld("isHostWindows", false);

contextBridge.exposeInMainWorld("interopApi", {
  callDotNetMethod: (className: string, methodName: string, args: unknown[]) => {
    return ipcRenderer.invoke("callDotNetMethod", className, methodName, args);
  },
});

contextBridge.exposeInMainWorld("electron", {
  getArch: () => invokeChecked("app:getArch", isString),
  getClipboardText: () => invokeChecked("app:getClipboardText", isString),
  getNoUpdater: () => invokeChecked("app:getNoUpdater", isBoolean),
  setTrayIconNotification: (hasNotification: boolean) => invokeChecked("app:setTrayIconNotification", isUndefined, hasNotification),
  setThemeSource: (source: ThemeSource) => invokeChecked("app:setThemeSource", isUndefined, source),
  onSystemThemeChanged: (callback: TypedListener<[boolean]>) => registerManagedListener("systemThemeChanged", isThemeChangedArgs, callback),
  openFileDialog: () => invokeChecked("dialog:openFile", isNullableString),
  openDirectoryDialog: () => invokeChecked("dialog:openDirectory", isNullableString),
  onWindowPositionChanged: (callback: TypedListener<[WindowPosition]>) => registerManagedListener("setWindowPosition", isWindowPositionArgs, callback),
  onWindowSizeChanged: (callback: TypedListener<[WindowSize]>) => registerManagedListener("setWindowSize", isWindowSizeArgs, callback),
  onWindowStateChange: (callback: TypedListener<[WindowState]>) => registerManagedListener("setWindowState", isWindowStateArgs, callback),
  onBrowserFocus: (callback: TypedListener<[]>) => registerManagedListener("onBrowserFocus", acceptNoArgs, callback),
  onBrowserBlur: (callback: TypedListener<[]>) => registerManagedListener("onBrowserBlur", acceptNoArgs, callback),
  desktopNotification: (title: string, body?: string, icon?: string) => invokeChecked("notification:showNotification", isUndefined, title, body, icon),
  restartApp: () => invokeChecked("app:restart", isUndefined),
  getOverlayWindow: () => invokeChecked("app:getOverlayWindow", isBoolean),
  updateVr: (isActive: boolean, hasHmdOverlay: boolean, hasWristOverlay: boolean, hasMenuButton: boolean, overlayHand: number) =>
    invokeChecked("app:updateVr", isUndefined, isActive, hasHmdOverlay, hasWristOverlay, hasMenuButton, overlayHand),
  ipcRenderer: {
    on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined {
      if (VALID_CHANNELS.includes(channel)) {
        return registerManagedListener(channel, acceptAnyArgs, (_event, ...args) => func(...args), `ipcRenderer:${channel}`);
      }

      return undefined;
    },
  },
});
