import "hazardous";

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { BrowserWindow, app, nativeTheme } from "electron";

import type { AppContext } from "./app-context.ts";
import { installVRCX } from "./app-install.ts";
import { toInitializable, toProgramElectron, toVrcxStorage } from "./dotnet-objects.ts";
import { dotnetSetup } from "./dotnet-setup.ts";
import { registerIpcHandlers } from "./ipc-handlers.ts";
import { InteropApi } from "./interop-api.ts";
import { createWindow, sendSystemTheme } from "./main-window.ts";
import { disposeOverlay } from "./overlay.ts";
import { getElectronUserDataPath, getHomePath, getRid, getVersion, tryCopyFromWinePrefix } from "./paths.ts";
import { createTray, destroyTray } from "./tray.ts";

dotnetSetup();

const VRCX_URI_PREFIX = "vrcx";
const rootDir = app.getAppPath();
const nodeRequire = createRequire(path.join(rootDir, "package.json"));

const args = process.argv.slice(1);
const isInstallDisabled = args.includes("--no-install");
const isDesktopDisabled = args.includes("--no-desktop");
const isStartupLaunch = args.includes("--startup");
const isHotReload = args.includes("--hot-reload");
const isUpdaterDisabled = args.includes("--no-updater") || fs.existsSync(path.join(rootDir, ".no-updater"));
if (app.isPackaged && process.defaultApp && process.platform !== "win32") {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(VRCX_URI_PREFIX, process.execPath, [path.resolve(process.argv[1] ?? "")]);
  } else {
    app.setAsDefaultProtocolClient(VRCX_URI_PREFIX);
  }
}

const version = getVersion(rootDir);
const homePath = getHomePath();
tryCopyFromWinePrefix(homePath);
const userDataPath = getElectronUserDataPath();
console.log("Electron userData path:", userDataPath);
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath("userData", userDataPath);

if (app.isPackaged) {
  nodeRequire(path.join(rootDir, "build/Electron/VRCX-Electron.cjs"));
} else {
  nodeRequire(path.join(rootDir, `build/Electron/${getRid()}/VRCX-Electron.cjs`));
}

const interopApi = new InteropApi(nodeRequire("node-api-dotnet/net10.0"));

const programElectron = toProgramElectron(interopApi.getDotNetClass("ProgramElectron"));
programElectron.preInit(version, args);
const storage = toVrcxStorage(interopApi.getDotNetObject("VRCXStorage"));
storage.load();
programElectron.init();
toInitializable(interopApi.getDotNetObject("SQLiteDatabase"), "SQLiteDatabase").init();
toInitializable(interopApi.getDotNetObject("AppApiElectron"), "AppApiElectron").init();
toInitializable(interopApi.getDotNetObject("Discord"), "Discord").init();
toInitializable(interopApi.getDotNetObject("WebApi"), "WebApi").init();
toInitializable(interopApi.getDotNetObject("LogWatcher"), "LogWatcher").init();

toInitializable(interopApi.getDotNetObject("AppApiVrElectron"), "AppApiVrElectron").init();

const ctx: AppContext = {
  rootDir,
  version,
  homePath,
  args,
  isStartupLaunch,
  isHotReload,
  isInstallDisabled,
  isDesktopDisabled,
  isUpdaterDisabled,
  hasAskedToMoveAppImage: storage.get("VRCX_HasAskedToMoveAppImage") === "true",
  storage,
  interop: interopApi,
  state: {
    mainWindow: undefined,
    overlayWindow: undefined,
    isOverlayActive: false,
    appIsQuitting: false,
    appImagePath: process.env["APPIMAGE"],
    tray: null,
    trayIcon: null,
    trayIconNotify: null,
    activeNotification: null,
  },
};

registerIpcHandlers(ctx);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
const stripVrcxPrefixRegex = new RegExp("^" + VRCX_URI_PREFIX + "://");

if (!hasSingleInstanceLock) {
  console.log("Another instance is already running. Exiting.");
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine, _workingDirectory) => {
    const mainWindow = ctx.state.mainWindow;
    if (mainWindow && commandLine.length >= 2) {
      try {
        mainWindow.webContents.send("launch-command", (commandLine.pop() ?? "").trim().replace(stripVrcxPrefixRegex, ""));
      } catch (err) {
        console.error("Error processing second-instance command:", err);
      }
    }
  });

  app.on("open-url", (_event, url) => {
    const mainWindow = ctx.state.mainWindow;
    if (mainWindow && url) {
      mainWindow.webContents.send("launch-command", url.replace(stripVrcxPrefixRegex, ""));
    }
  });
}

nativeTheme.on("updated", () => {
  sendSystemTheme(ctx);
});

app
  .whenReady()
  .then(() => {
    createWindow(ctx);
    createTray(ctx);
    installVRCX(ctx);

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(ctx);
      } else {
        const mainWindow = ctx.state.mainWindow;
        if (mainWindow && !mainWindow.isVisible()) {
          mainWindow.show();
        }
      }
    });
  })
  .catch((err: unknown) => {
    console.error("Error starting VRCX:", err);
  });

app.on("before-quit", function () {
  ctx.state.appIsQuitting = true;
  disposeOverlay(ctx);
  destroyTray(ctx);

  app.exit(0);
});

app.on("window-all-closed", function () {
  disposeOverlay(ctx);

  if (process.platform !== "darwin") {
    app.quit();
  }
});
