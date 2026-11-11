import { Notification, app, clipboard, dialog, ipcMain, nativeTheme } from "electron";
import type { NotificationConstructorOptions, OpenDialogOptions } from "electron";

import type { AppContext } from "./app-context.ts";
import { createOverlayWindowOffscreen, disposeOverlay, isOverlayWindowReady } from "./overlay.ts";
import { nonEmpty } from "./paths.ts";
import { sendSystemTheme } from "./main-window.ts";
import { destroyTray, setTrayIconNotification } from "./tray.ts";

const THEME_SOURCES = ["system", "light", "dark"] as const;
type ThemeSource = (typeof THEME_SOURCES)[number];

function isThemeSource(value: unknown): value is ThemeSource {
  return THEME_SOURCES.some((candidate) => candidate === value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function showOpenDialog(ctx: AppContext, options: OpenDialogOptions): Promise<string | null> {
  const mainWindow = ctx.state.mainWindow;
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0] ?? null;
  }
  return null;
}

export function registerIpcHandlers(ctx: AppContext): void {
  ipcMain.handle("callDotNetMethod", (_event, className: unknown, methodName: unknown, args: unknown) => {
    if (typeof className !== "string" || typeof methodName !== "string" || !Array.isArray(args)) {
      throw new Error("callDotNetMethod expects a class name, a method name and an argument array");
    }
    return ctx.interop.callMethod(className, methodName, args);
  });

  ipcMain.handle("dialog:openFile", () => {
    return showOpenDialog(ctx, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png"] }],
    });
  });

  ipcMain.handle("dialog:openDirectory", () => {
    return showOpenDialog(ctx, {
      properties: ["openDirectory"],
    });
  });

  ipcMain.handle("notification:showNotification", (_event, title: unknown, body: unknown, icon: unknown) => {
    if (ctx.state.activeNotification) {
      ctx.state.activeNotification.close();
    }

    const notificationOptions: NotificationConstructorOptions = {};
    const titleText = asOptionalString(title);
    const bodyText = asOptionalString(body);
    const iconText = asOptionalString(icon);
    if (titleText !== undefined) {
      notificationOptions.title = titleText;
    }
    if (bodyText !== undefined) {
      notificationOptions.body = bodyText;
    }
    if (iconText !== undefined) {
      notificationOptions.icon = iconText;
    }
    const notification = new Notification(notificationOptions);
    notification.on("close", () => {
      if (ctx.state.activeNotification === notification) {
        notification.removeAllListeners();
        ctx.state.activeNotification = null;
      }
    });
    ctx.state.activeNotification = notification;
    notification.show();
  });

  ipcMain.handle("app:restart", () => {
    if (process.platform === "linux") {
      const options = {
        execPath: nonEmpty(ctx.state.appImagePath) ?? process.execPath,
        args: process.argv.slice(1),
      };
      app.relaunch(options);
      destroyTray(ctx);
      app.exit(0);
    } else {
      app.relaunch();
      app.quit();
    }
  });

  ipcMain.handle("app:getOverlayWindow", () => {
    return isOverlayWindowReady(ctx);
  });

  ipcMain.handle("app:updateVr", (_event, isActive: unknown, hasHmdOverlay: unknown, hasWristOverlay: unknown) => {
    if (!isActive || (!hasHmdOverlay && !hasWristOverlay)) {
      disposeOverlay(ctx);
      return;
    }
    if (!ctx.state.overlayWindow) {
      try {
        createOverlayWindowOffscreen(ctx);
      } catch (err) {
        console.error("Error creating overlay windows:", err);
      }
    }
  });

  ipcMain.handle("app:getArch", () => {
    return process.arch;
  });

  ipcMain.handle("app:getClipboardText", () => {
    return clipboard.readText();
  });

  ipcMain.handle("app:getNoUpdater", () => {
    return ctx.isUpdaterDisabled;
  });

  ipcMain.handle("app:setTrayIconNotification", (_event, notify: unknown) => {
    setTrayIconNotification(ctx, notify);
  });

  ipcMain.handle("app:setThemeSource", (_event, source: unknown) => {
    if (!isThemeSource(source)) {
      return;
    }
    nativeTheme.themeSource = source;
    sendSystemTheme(ctx);
  });
}
