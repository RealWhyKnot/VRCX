import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { app, dialog } from "electron";

const OS_NAMES = new Map<string, string>([
  ["win32", "win"],
  ["darwin", "osx"],
  ["linux", "linux"],
  ["freebsd", "linux"],
  ["openbsd", "linux"],
]);

const ARCH_NAMES = new Map<string, string>([
  ["x64", "x64"],
  ["arm64", "arm64"],
]);

export function nonEmpty(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export function getRid(): string {
  const osName = OS_NAMES.get(os.platform());
  const arch = ARCH_NAMES.get(os.arch());
  if (osName === undefined || arch === undefined) {
    throw new Error(`Unsupported platform ${os.platform()}-${os.arch()}`);
  }
  return `${osName}-${arch}`;
}

export function getVRCXPath(): string {
  if (process.platform === "win32") {
    return path.join(requireEnv("APPDATA"), "VRCX");
  } else if (process.platform === "darwin") {
    return path.join(requireEnv("HOME"), "Library/Application Support/VRCX");
  }

  const configHome = nonEmpty(process.env["XDG_CONFIG_HOME"]) ?? path.join(requireEnv("HOME"), ".config");
  return path.join(configHome, "VRCX");
}

export function getElectronUserDataPath(): string {
  const electronUserData = "ElectronUserData";
  if (process.platform === "win32") {
    return path.join(getVRCXPath(), electronUserData);
  }
  if (process.platform === "darwin") {
    return path.join(requireEnv("HOME"), "Library/Caches/VRCX", electronUserData);
  }

  const cacheHome = nonEmpty(process.env["XDG_CACHE_HOME"]) ?? path.join(requireEnv("HOME"), ".cache");
  return path.join(cacheHome, "VRCX", electronUserData);
}

export function getHomePath(): string {
  const relativeHomePath = path.join(app.getPath("home"));
  try {
    const absoluteHomePath = fs.realpathSync(relativeHomePath);
    return absoluteHomePath;
  } catch (err) {
    console.error("Error resolving absolute home path:", err);
    return relativeHomePath;
  }
}

export function getVersion(rootDir: string): string {
  try {
    const versionFile = fs.readFileSync(path.join(rootDir, "Version"), "utf8").trim();

    const version = versionFile.split("-");
    const lastVersionPart = version[version.length - 1] ?? "";
    console.log("Version:", versionFile);
    if (version.length > 0 && lastVersionPart.length === 7) {
      return `VRCX (Linux) Nightly ${versionFile}`;
    } else {
      return `VRCX (Linux) ${versionFile}`;
    }
  } catch (err) {
    console.error("Error reading Version:", err);
    return "VRCX (Linux) Nightly Build";
  }
}

export function tryCopyFromWinePrefix(homePath: string): void {
  try {
    if (!fs.existsSync(getVRCXPath())) {
      const userName = nonEmpty(process.env["USER"]) ?? process.env["USERNAME"];
      if (userName === undefined) {
        throw new Error("Environment variable USER or USERNAME is not set");
      }
      const oldPath = path.join(homePath, ".local/share/vrcx/drive_c/users", userName, "AppData/Roaming/VRCX");
      const newPath = getVRCXPath();
      if (fs.existsSync(oldPath)) {
        fs.mkdirSync(newPath, { recursive: true });
        const files = fs.readdirSync(oldPath);
        for (const file of files) {
          const oldFilePath = path.join(oldPath, file);
          const newFilePath = path.join(newPath, file);
          if (fs.lstatSync(oldFilePath).isDirectory()) {
            continue;
          }
          fs.copyFileSync(oldFilePath, newFilePath);
        }
      }
    }
  } catch (err) {
    console.error("Error copying from wine prefix:", err);
    dialog.showErrorBox("VRCX", "Failed to copy database from wine prefix.");
  }
}
