import path from "node:path";

import { Menu, Tray, app, nativeImage } from "electron";
import type { NativeImage } from "electron";

import type { AppContext } from "./app-context.ts";

export function destroyTray(ctx: AppContext): void {
  if (ctx.state.tray) {
    ctx.state.tray.destroy();
    ctx.state.tray = null;
  }
}

export function createTray(ctx: AppContext): void {
  const { rootDir, state } = ctx;
  let icon: NativeImage | string;
  let iconNotify: NativeImage | string;
  if (process.platform === "darwin" || process.platform === "linux") {
    const size = process.platform === "darwin" ? 16 : 64;
    icon = nativeImage.createFromPath(path.join(rootDir, "images/VRCX.png")).resize({ width: size, height: size });
    iconNotify = nativeImage.createFromPath(path.join(rootDir, "images/VRCX_notify.png")).resize({ width: size, height: size });
  } else {
    icon = path.join(rootDir, "images/VRCX.ico");
    iconNotify = path.join(rootDir, "images/VRCX_notify.ico");
  }
  state.trayIcon = icon;
  state.trayIconNotify = iconNotify;
  const tray = new Tray(icon);
  state.tray = tray;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      type: "normal",
      click: () => {
        state.mainWindow?.show();
      },
    },
    {
      label: "DevTools",
      type: "normal",
      click: () => {
        state.mainWindow?.webContents.openDevTools();
      },
    },
    {
      label: "Quit VRCX",
      type: "normal",
      click: () => {
        state.appIsQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip("VRCX");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    state.mainWindow?.show();
  });
}

export function setTrayIconNotification(ctx: AppContext, notify: unknown): void {
  const icon = notify ? ctx.state.trayIconNotify : ctx.state.trayIcon;
  if (ctx.state.tray && icon) {
    ctx.state.tray.setImage(icon);
  }
}
