import type { BrowserWindow, NativeImage, Notification, Tray } from "electron";

import type { InteropApi } from "./interop-api.ts";
import type { VrcxStorage } from "./dotnet-objects.ts";

export type RuntimeState = {
  mainWindow: BrowserWindow | undefined;
  overlayWindow: BrowserWindow | undefined;
  isOverlayActive: boolean;
  appIsQuitting: boolean;
  appImagePath: string | undefined;
  tray: Tray | null;
  trayIcon: NativeImage | string | null;
  trayIconNotify: NativeImage | string | null;
  activeNotification: Notification | null;
};

export type AppContext = {
  readonly rootDir: string;
  readonly version: string;
  readonly homePath: string;
  readonly args: string[];
  readonly isStartupLaunch: boolean;
  readonly isHotReload: boolean;
  readonly isInstallDisabled: boolean;
  readonly isDesktopDisabled: boolean;
  readonly isUpdaterDisabled: boolean;
  readonly hasAskedToMoveAppImage: boolean;
  readonly storage: VrcxStorage;
  readonly interop: InteropApi;
  readonly state: RuntimeState;
};
