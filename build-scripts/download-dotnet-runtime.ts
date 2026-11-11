import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { getArchAndPlatform } from "./utils.ts";
import { pipeline } from "node:stream/promises";
import { unlink, copyFile, rename } from "node:fs/promises";

const DOTNET_VERSION = "10.0.8";
const DOTNET_RUNTIME_DIR = path.join(import.meta.dirname, "..", "build", "Electron", "dotnet-runtime");

const DOTNET_CACHE_DIR = path.join(os.homedir(), ".cache", "vrcx-build", "dotnet-cache");

async function downloadFile(url, targetPath) {
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download, url: ${url} status code: ${response.status}`);
    }

    const fileStream = fs.createWriteStream(tempPath);

    await pipeline(response.body, fileStream);

    await rename(tempPath, targetPath);
  } catch (error) {
    const error2 = error;
    console.error("Error downloading file:", error2.message);

    try {
      await unlink(tempPath);
    } catch (error) {
      const unlinkError = error;
      if (unlinkError.code !== "ENOENT") {
        console.error("Error cleaning up temporary file:", unlinkError);
      }
    }

    throw error;
  }
}

async function extractTarGz(tarGzPath, extractDir) {
  return new Promise((resolve, reject) => {
    const tar = spawnSync("tar", ["-xzf", tarGzPath, "-C", extractDir, "--strip-components=1"], {
      stdio: "inherit",
      windowsHide: true,
    });

    if (tar.status === 0) {
      resolve(undefined);
    } else {
      reject(new Error(`tar extraction failed with status ${tar.status}`));
    }
  });
}

async function extractZip(zipPath, extractDir) {
  return new Promise((resolve, reject) => {
    const tar = spawnSync("tar", ["-xf", zipPath, "-C", extractDir], {
      stdio: "inherit",
      windowsHide: true,
    });

    if (tar.status === 0) {
      resolve(undefined);
    } else {
      reject(new Error(`zip extraction failed with status ${tar.status}`));
    }
  });
}

async function downloadDotnetRuntime(arch, platform) {
  if (!arch || !platform) {
    throw new Error("Architecture and platform must be specified");
  }

  let dotnetPlatform;
  if (platform === "linux") {
    dotnetPlatform = "linux";
  } else if (platform === "darwin") {
    dotnetPlatform = "osx";
  } else if (platform === "win32") {
    dotnetPlatform = "win";
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  if (!fs.existsSync(DOTNET_CACHE_DIR)) {
    fs.mkdirSync(DOTNET_CACHE_DIR, { recursive: true });
  }

  if (!fs.existsSync(DOTNET_RUNTIME_DIR)) {
    fs.mkdirSync(DOTNET_RUNTIME_DIR, { recursive: true });
  }

  const archiveExt = dotnetPlatform === "win" ? "zip" : "tar.gz";
  const fileName = `dotnet-runtime-${DOTNET_VERSION}-${dotnetPlatform}-${arch}.${archiveExt}`;
  const archivePath = path.join(DOTNET_RUNTIME_DIR, fileName);
  const dotnetRuntimeUrl = `https://builds.dotnet.microsoft.com/dotnet/Runtime/${DOTNET_VERSION}/${fileName}`;
  const cacheFilePath = path.join(DOTNET_CACHE_DIR, fileName);

  if (!fs.existsSync(cacheFilePath)) {
    console.log(`Downloading .NET ${DOTNET_VERSION}-${dotnetPlatform}-${arch} runtime...`);
    await downloadFile(dotnetRuntimeUrl, cacheFilePath);
    console.log(`Downloaded ${dotnetRuntimeUrl} to ${cacheFilePath}`);
  } else {
    console.log(`Using cached .NET runtime at ${cacheFilePath}`);
  }

  await copyFile(cacheFilePath, archivePath);
  console.log(`Copied ${cacheFilePath} to ${archivePath}`);

  const tempExtractDir = path.join(DOTNET_RUNTIME_DIR, "temp");
  if (!fs.existsSync(tempExtractDir)) {
    fs.mkdirSync(tempExtractDir, { recursive: true });
  }

  console.log("Extracting .NET runtime...");
  if (archiveExt === "zip") {
    await extractZip(archivePath, tempExtractDir);
  } else {
    await extractTarGz(archivePath, tempExtractDir);
  }
  console.log("Extraction completed");

  fs.unlinkSync(archivePath);
  console.log("Cleanup completed");

  const extractedDotnet = path.join(tempExtractDir, "dotnet");
  if (fs.existsSync(extractedDotnet)) {
    fs.chmodSync(extractedDotnet, 0o755);
  }

  const files = fs.readdirSync(tempExtractDir);
  for (const file of files) {
    const sourcePath = path.join(tempExtractDir, file);
    const targetPath = path.join(DOTNET_RUNTIME_DIR, file);

    if (fs.existsSync(targetPath)) {
      if (fs.lstatSync(sourcePath).isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }

    fs.renameSync(sourcePath, targetPath);
  }

  fs.rmSync(tempExtractDir, { recursive: true, force: true });

  console.log(`.NET runtime downloaded and extracted to: ${DOTNET_RUNTIME_DIR}`);
}

const { arch, platform } = getArchAndPlatform();
downloadDotnetRuntime(arch, platform);
