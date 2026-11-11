import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { app, dialog } from "electron";
import type { MessageBoxOptions } from "electron";

import type { AppContext } from "./app-context.ts";
import { toUpdateClass } from "./dotnet-objects.ts";

function updateDesktopFile(ctx: AppContext, appImagePath: string): void {
  if (ctx.isDesktopDisabled) {
    console.log("Skipping desktop file creation.");
    return;
  }

  const applicationsDir = path.join(ctx.homePath, ".local/share/applications");
  const existingDesktopFilePath = path.join(applicationsDir, "VRCX.desktop");

  try {
    if (fs.existsSync(existingDesktopFilePath)) {
      const editResult = spawnSync("desktop-file-edit", ["--set-key=Exec", `--set-value=${appImagePath}`, existingDesktopFilePath]);

      if (editResult.error) {
        console.log("Error trying to update VRCX.desktop file: ", editResult.error.message);
      } else {
        console.log(`Updated desktop file: ${existingDesktopFilePath} to exec ${appImagePath}`);
      }
    } else {
      const exeDir = path.dirname(app.getPath("exe"));
      const packageAppImagePath = path.join(exeDir, "VRCX.desktop");

      const installResult = spawnSync("desktop-file-install", [
        "--set-key=Exec",
        `--set-value=${appImagePath}`,
        `--dir=${applicationsDir}`,
        "--rebuild-mime-info-cache",
        packageAppImagePath,
      ]);

      if (installResult.error) {
        console.log("Error trying to install VRCX.desktop file: ", installResult.error.message);
      } else {
        console.log(`Installed desktop file to: ${applicationsDir} using exec ${appImagePath}`);
      }
    }
  } catch (err) {
    console.error("Error creating desktop file:", err);
    dialog.showErrorBox("VRCX", "Failed to create desktop entry.");
    return;
  }
}

export function installVRCX(ctx: AppContext): void {
  console.log("Home path:", ctx.homePath);
  console.log("AppImage path:", ctx.state.appImagePath);
  const initialImagePath = ctx.state.appImagePath;
  if (!initialImagePath) {
    console.error("AppImage path is not available!");
    return;
  }
  if (ctx.isInstallDisabled) {
    toUpdateClass(ctx.interop.getDotNetClass("Update")).init(initialImagePath);
    console.log("Skipping installation.");
    return;
  }

  let appImagePath = initialImagePath;
  const currentName = path.basename(appImagePath);
  const expectedName = "VRCX.AppImage";
  if (currentName !== expectedName) {
    const newPath = path.join(path.dirname(appImagePath), expectedName);
    try {
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }
      fs.renameSync(appImagePath, newPath);
      console.log("AppImage renamed to:", newPath);
      appImagePath = newPath;
      ctx.state.appImagePath = newPath;
    } catch (err) {
      console.error(`Error renaming AppImage ${newPath}`, err);
      dialog.showErrorBox("VRCX", `Failed to rename AppImage ${newPath}`);
      return;
    }
  }

  const appImageHomePath = `${ctx.homePath}/Applications/VRCX.AppImage`;
  if (!ctx.hasAskedToMoveAppImage && appImagePath !== appImageHomePath) {
    const moveOptions: MessageBoxOptions = {
      type: "question",
      title: "VRCX",
      message: "Do you want to install VRCX?",
      detail: "VRCX will be moved to your ~/Applications folder.",
      buttons: ["No", "Yes"],
    };
    const mainWindow = ctx.state.mainWindow;
    const result = mainWindow ? dialog.showMessageBoxSync(mainWindow, moveOptions) : dialog.showMessageBoxSync(moveOptions);
    if (result === 0) {
      console.log("Cancel AppImage move to ~/Applications");

      ctx.storage.set("VRCX_HasAskedToMoveAppImage", "true");
      ctx.storage.save();
    }
    if (result === 1) {
      console.log("Moving AppImage to ~/Applications");
      try {
        const applicationsPath = path.join(ctx.homePath, "Applications");

        if (!fs.existsSync(applicationsPath)) {
          fs.mkdirSync(applicationsPath);
        }

        if (fs.existsSync(appImageHomePath)) {
          fs.unlinkSync(appImageHomePath);
        }
        fs.renameSync(appImagePath, appImageHomePath);
        appImagePath = appImageHomePath;
        ctx.state.appImagePath = appImageHomePath;
        console.log("AppImage moved to:", appImageHomePath);
        updateDesktopFile(ctx, appImagePath);
      } catch (err) {
        console.error(`Error moving AppImage ${appImageHomePath}`, err);
        dialog.showErrorBox("VRCX", `Failed to move AppImage ${appImageHomePath}`);
        return;
      }
    }
  }

  toUpdateClass(ctx.interop.getDotNetClass("Update")).init(appImagePath);
}
