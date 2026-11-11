import { toast } from "vue-sonner";
import type { useI18n } from "vue-i18n";
import type { Ref } from "vue";

import { logSaveFailure, logActionFailure, logDialogFailure } from "./advanced-failure-logs";
import type { useGameStore } from "../game";
import type { useModalStore } from "../modal";

export type CreateAdvancedUgcAndScreenshotsDeps = {
  gameStore: ReturnType<typeof useGameStore>;
  modalStore: ReturnType<typeof useModalStore>;
  state: { folderSelectorDialogVisible: boolean };
  cropInstancePrints: Ref<boolean>;
  ugcFolderPath: Ref<string>;
  isVRChatConfigDialogVisible: Ref<boolean>;
  setUGCFolderPath: (path: string | null | undefined) => Promise<void>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createAdvancedUgcAndScreenshots(deps: CreateAdvancedUgcAndScreenshotsDeps) {
  const { gameStore, modalStore, state, cropInstancePrints, ugcFolderPath, isVRChatConfigDialogVisible, setUGCFolderPath, t } = deps;

  function cropPrintsChanged() {
    if (!cropInstancePrints.value) return;
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_confirm"),
        cancelText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_cancel"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;
        const msgBox = toast.warning("Batch print cropping in progress...", {
          duration: Infinity,
          position: "bottom-right",
        });
        try {
          await AppApi.CropAllPrints(ugcFolderPath.value);
          toast.success("Batch print cropping complete");
        } catch (err) {
          console.error(err);
          toast.error(`Batch print cropping failed: ${String(err)}`);
        } finally {
          toast.dismiss(msgBox);
        }
      })
      .catch(logDialogFailure);
  }

  function askDeleteAllScreenshotMetadata() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.ask"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm_yes"),
        cancelText: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm_no"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        deleteAllScreenshotMetadata();
      })
      .catch(logDialogFailure);
  }

  function deleteAllScreenshotMetadata() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.delete_all_screenshot_metadata.confirm"),
        title: "",
        confirmText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_confirm"),
        cancelText: t("view.settings.advanced.advanced.save_instance_prints_to_file.crop_convert_old_cancel"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;
        const msgBox = toast.warning("Batch metadata removal in progress...", {
          duration: Infinity,
          position: "bottom-right",
        });
        try {
          await AppApi.DeleteAllScreenshotMetadata();
          toast.success("Batch metadata removal complete");
        } catch (err) {
          console.error(err);
          toast.error(`Batch metadata removal failed: ${String(err)}`);
        } finally {
          toast.dismiss(msgBox);
        }
      })
      .catch(logDialogFailure);
  }

  function resetUGCFolder() {
    void setUGCFolderPath("").catch(logSaveFailure);
  }

  async function openUGCFolder() {
    await AppApi.OpenUGCPhotosFolder(ugcFolderPath.value);
  }

  async function folderSelectorDialog(oldPath?: string | null) {
    if (state.folderSelectorDialogVisible) return;
    oldPath ??= "";

    state.folderSelectorDialogVisible = true;
    let newFolder: string;
    if (isHostWindows) {
      newFolder = await AppApi.OpenFolderSelectorDialog(oldPath);
    } else {
      newFolder = await window.electron.openDirectoryDialog();
    }

    state.folderSelectorDialogVisible = false;
    return newFolder;
  }

  async function openUGCFolderSelector() {
    const path = await folderSelectorDialog(ugcFolderPath.value);
    await setUGCFolderPath(path);
  }

  function showVRChatConfig(): Promise<void> {
    isVRChatConfigDialogVisible.value = true;
    if (!gameStore.VRChatUsedCacheSize) {
      void gameStore.getVRChatCacheSize().catch(logActionFailure);
    }
    return Promise.resolve();
  }

  return {
    cropPrintsChanged,
    askDeleteAllScreenshotMetadata,
    resetUGCFolder,
    openUGCFolder,
    folderSelectorDialog,
    openUGCFolderSelector,
    showVRChatConfig,
  };
}
