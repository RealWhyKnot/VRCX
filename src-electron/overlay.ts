import fs from "node:fs";
import path from "node:path";

import { BrowserWindow } from "electron";

import type { AppContext } from "./app-context.ts";
import { readNumberSetting } from "./main-window.ts";

const OVERLAY_WRIST_FRAME_WIDTH = 512;
const OVERLAY_WRIST_FRAME_HEIGHT = 512;
const OVERLAY_HMD_FRAME_WIDTH = 1024;
const OVERLAY_HMD_FRAME_HEIGHT = 1024;
const OVERLAY_SHARED_HEIGHT = OVERLAY_WRIST_FRAME_HEIGHT + OVERLAY_HMD_FRAME_HEIGHT;
const OVERLAY_SHARED_WIDTH = Math.max(OVERLAY_WRIST_FRAME_WIDTH, OVERLAY_HMD_FRAME_WIDTH);
const OVERLAY_FRAME_SIZE = OVERLAY_SHARED_WIDTH * OVERLAY_SHARED_HEIGHT * 4;
const OVERLAY_SHM_PATH = "/dev/shm/vrcx_overlay";
const overlayFrameBuffer = Buffer.alloc(OVERLAY_FRAME_SIZE + 1);

function createOverlayWindowShm(): void {
  fs.writeFileSync(OVERLAY_SHM_PATH, Buffer.alloc(OVERLAY_FRAME_SIZE + 1));
}

function writeOverlayFrame(imageBuffer: Buffer): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(OVERLAY_SHM_PATH, "r+");
    overlayFrameBuffer[0] = 0;
    imageBuffer.copy(overlayFrameBuffer, 1, 0, OVERLAY_FRAME_SIZE);
    overlayFrameBuffer[0] = 1;
    fs.writeSync(fd, overlayFrameBuffer);
  } catch (err) {
    console.error("Error writing frame to shared memory:", err);
  } finally {
    if (typeof fd === "number") {
      fs.closeSync(fd);
    }
  }
}

export function createOverlayWindowOffscreen(ctx: AppContext): void {
  if (process.platform !== "linux") {
    console.error("Offscreen overlay is only supported on Linux.");
    return;
  }
  ctx.state.isOverlayActive = true;
  if (!fs.existsSync(OVERLAY_SHM_PATH)) {
    createOverlayWindowShm();
  }

  const x = readNumberSetting(ctx.storage.get("VRCX_LocationX"), 0);
  const y = readNumberSetting(ctx.storage.get("VRCX_LocationY"), 0);
  const width = OVERLAY_SHARED_WIDTH;
  const height = OVERLAY_SHARED_HEIGHT;

  const overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    icon: path.join(ctx.rootDir, "images/VRCX.png"),
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    show: false,
    webPreferences: {
      partition: "vrcx-vr-overlay",
      offscreen: true,
      preload: path.join(ctx.rootDir, "build/main/preload.cjs"),
    },
  });
  ctx.state.overlayWindow = overlayWindow;
  overlayWindow.webContents.setFrameRate(48);

  let fileUrl = `file://${path.join(ctx.rootDir, "build/html/vr.html")}`;
  if (ctx.isHotReload) {
    fileUrl = "http://localhost:9000/vr.html";
  }
  overlayWindow.loadURL(fileUrl, { userAgent: ctx.version }).catch((err: unknown) => {
    console.error("Error loading VR overlay page:", err);
  });

  overlayWindow.webContents.on("paint", (_event, _dirty, image) => {
    const buffer = image.toBitmap();

    writeOverlayFrame(buffer);
  });
}

export function disposeOverlay(ctx: AppContext): void {
  if (!ctx.state.isOverlayActive) {
    return;
  }
  const overlayWindow = ctx.state.overlayWindow;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const { webContents } = overlayWindow;
    if (!webContents.isDestroyed()) {
      webContents.removeAllListeners("paint");
      webContents.stopPainting();
    }
    overlayWindow.close();
  }
  ctx.state.overlayWindow = undefined;
  ctx.state.isOverlayActive = false;
  if (fs.existsSync(OVERLAY_SHM_PATH)) {
    fs.unlinkSync(OVERLAY_SHM_PATH);
  }
}

export function isOverlayWindowReady(ctx: AppContext): boolean {
  const overlayWindow = ctx.state.overlayWindow;
  if (!overlayWindow) {
    return false;
  }
  return !overlayWindow.webContents.isLoading() && overlayWindow.webContents.isPainting();
}
