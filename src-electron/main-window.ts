import path from "node:path";

import { BrowserWindow, app, nativeTheme } from "electron";

import type { AppContext } from "./app-context.ts";

export function readNumberSetting(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
}

export function getCloseToTray(ctx: AppContext): boolean {
  if (process.platform === "darwin") {
    return true;
  }
  return ctx.storage.get("VRCX_CloseToTray") === "true";
}

export function sendSystemTheme(ctx: AppContext): void {
  const mainWindow = ctx.state.mainWindow;
  if (mainWindow && !mainWindow.isDestroyed() && nativeTheme.themeSource === "system") {
    mainWindow.webContents.send("systemThemeChanged", nativeTheme.shouldUseDarkColors);
  }
}

function applyWindowState(ctx: AppContext, mainWindow: BrowserWindow): void {
  if (ctx.storage.get("VRCX_StartAsMinimizedState") === "true" && ctx.isStartupLaunch) {
    if (getCloseToTray(ctx)) {
      mainWindow.hide();
      return;
    }
    mainWindow.minimize();
    return;
  }
  const windowState = readNumberSetting(ctx.storage.get("VRCX_WindowState"), -1);
  switch (windowState) {
    case -1:
      break;
    case 0:
      mainWindow.restore();
      break;
    case 1:
      mainWindow.minimize();
      break;
    case 2:
      mainWindow.maximize();
      break;
  }
}

export function createWindow(ctx: AppContext): void {
  console.log("Creating main window");

  if (ctx.state.mainWindow) {
    console.log("Main window already exists.");
  }

  app.commandLine.appendSwitch("enable-speech-dispatcher");

  const x = readNumberSetting(ctx.storage.get("VRCX_LocationX"), 0);
  const y = readNumberSetting(ctx.storage.get("VRCX_LocationY"), 0);
  const width = readNumberSetting(ctx.storage.get("VRCX_SizeWidth"), 1920);
  const height = readNumberSetting(ctx.storage.get("VRCX_SizeHeight"), 1080);
  const zoomLevel = readNumberSetting(ctx.storage.get("VRCX_ZoomLevel"), 0);
  const mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    icon: path.join(ctx.rootDir, "images/VRCX.png"),
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(ctx.rootDir, "build/main/preload.cjs"),
    },
  });
  ctx.state.mainWindow = mainWindow;
  applyWindowState(ctx, mainWindow);
  const indexPath = path.join(ctx.rootDir, "build/html/index.html");
  mainWindow.loadFile(indexPath).catch((err: unknown) => {
    console.error("Error loading main window page:", err);
  });
  if (ctx.isHotReload) {
    mainWindow.loadURL("http://localhost:9000/index.html").catch((err: unknown) => {
      console.error("Error loading dev main window page:", err);
    });
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomLevel(zoomLevel);
  });

  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.control && input.key === "=") {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1);
    }
    if (input.control && input.key === "-") {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1);
    }
  });

  mainWindow.webContents.on("zoom-changed", (_event, zoomDirection) => {
    let currentZoom = mainWindow.webContents.getZoomLevel();
    if (zoomDirection === "in") {
      mainWindow.webContents.setZoomLevel(++currentZoom);
    } else {
      mainWindow.webContents.setZoomLevel(--currentZoom);
    }
    ctx.storage.set("VRCX_ZoomLevel", currentZoom.toString());
  });
  mainWindow.webContents.setVisualZoomLevelLimits(1, 5).catch((err: unknown) => {
    console.error("Error setting zoom limits:", err);
  });

  mainWindow.on("close", (closeEvent) => {
    if (getCloseToTray(ctx) && !ctx.state.appIsQuitting) {
      closeEvent.preventDefault();
      mainWindow.hide();
    } else {
      app.quit();
    }
  });

  mainWindow.on("resize", () => {
    const [width, height] = mainWindow.getSize().map((size) => size.toString());
    mainWindow.webContents.send("setWindowSize", { width, height });
  });

  mainWindow.on("move", () => {
    const [x, y] = mainWindow.getPosition().map((coord) => coord.toString());
    mainWindow.webContents.send("setWindowPosition", { x, y });
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("setWindowState", "2");
  });

  mainWindow.on("minimize", () => {
    mainWindow.webContents.send("setWindowState", "1");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("setWindowState", "0");
  });

  mainWindow.on("restore", () => {
    mainWindow.webContents.send("setWindowState", "0");
  });

  mainWindow.on("focus", () => {
    mainWindow.webContents.send("onBrowserFocus");
  });

  mainWindow.on("blur", () => {
    mainWindow.webContents.send("onBrowserBlur");
  });
}
