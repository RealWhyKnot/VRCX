import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { app, dialog } from "electron";

export function isDotNetInstalled(): boolean {
  let dotnetPath: string;

  if (process.env["DOTNET_ROOT"]) {
    const dotnetExe = process.platform === "win32" ? "dotnet.exe" : "dotnet";
    dotnetPath = path.join(process.env["DOTNET_ROOT"], dotnetExe);
    if (!fs.existsSync(dotnetPath)) {
      dotnetPath = "dotnet";
    }
  } else {
    dotnetPath = "dotnet";
  }

  console.log("Checking for .NET installation at:", dotnetPath);

  const result = spawnSync(dotnetPath, ["--list-runtimes"], {
    encoding: "utf-8",
    windowsHide: true,
  });
  if (result.error) {
    console.error("Error checking .NET runtimes:", result.error);
    return false;
  }
  return result.stdout.includes(".NETCore.App 10.0");
}

export function dotnetSetup(): void {
  const bundledDotNetPath = path.join(process.resourcesPath, "dotnet-runtime");
  if (fs.existsSync(bundledDotNetPath)) {
    process.env["DOTNET_ROOT"] = bundledDotNetPath;
    process.env["PATH"] = `${bundledDotNetPath}${path.delimiter}${process.env["PATH"]}`;
  } else if (process.platform === "darwin") {
    const dotnetPath = path.join("/usr/local/share/dotnet");
    const dotnetPathArm = path.join("/usr/local/share/dotnet/x64");
    if (fs.existsSync(dotnetPathArm)) {
      process.env["DOTNET_ROOT"] = dotnetPathArm;
      process.env["PATH"] = `${dotnetPathArm}${path.delimiter}${process.env["PATH"]}`;
    } else if (fs.existsSync(dotnetPath)) {
      process.env["DOTNET_ROOT"] = dotnetPath;
      process.env["PATH"] = `${dotnetPath}${path.delimiter}${process.env["PATH"]}`;
    }
  }

  if (!isDotNetInstalled()) {
    app
      .whenReady()
      .then(() => {
        dialog.showErrorBox("VRCX", 'Please install .NET 10.0 Runtime "dotnet-runtime-10.0" to run VRCX.');
        app.quit();
      })
      .catch((err: unknown) => {
        console.error("Error showing the .NET runtime dialog:", err);
      });
  }
}
