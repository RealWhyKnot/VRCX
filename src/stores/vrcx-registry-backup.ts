import type { useI18n } from "vue-i18n";
import type { Ref } from "vue";

import { configRepository } from "../services/config";
import { isAutoBackup, logError, parseRegistryBackups } from "./vrcx-messages";
import type { useAdvancedSettingsStore } from "./settings/advanced";
import type { useModalStore } from "./modal";

export type CreateVrcxRegistryBackupDeps = {
  advancedSettingsStore: ReturnType<typeof useAdvancedSettingsStore>;
  modalStore: ReturnType<typeof useModalStore>;
  isRegistryBackupDialogVisible: Ref<boolean>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createVrcxRegistryBackup(deps: CreateVrcxRegistryBackupDeps) {
  const { advancedSettingsStore, modalStore, isRegistryBackupDialogVisible, t } = deps;

  async function backupVrcRegistry(name: string) {
    let regJson: unknown;
    try {
      regJson = JSON.parse(await AppApi.GetVRChatRegistryJson());
    } catch (e) {
      console.error("Failed to get VRChat registry for backup:", e);
      return;
    }
    const newBackup = {
      name,
      date: new Date().toJSON(),
      data: regJson,
    };
    const storedBackups = await configRepository.getString("VRCX_VRChatRegistryBackups");
    const backupsJson = storedBackups === null || storedBackups === "" ? JSON.stringify([]) : storedBackups;
    const backups = parseRegistryBackups(backupsJson);
    backups.push(newBackup);
    await configRepository.setString("VRCX_VRChatRegistryBackups", JSON.stringify(backups));
  }

  async function checkAutoBackupRestoreVrcRegistry() {
    if (!advancedSettingsStore.vrcRegistryAutoBackup || !advancedSettingsStore.vrcRegistryAskRestore) {
      return;
    }

    const hasVRChatRegistryFolder = await AppApi.HasVRChatRegistryFolder();
    if (!hasVRChatRegistryFolder) {
      const lastBackupDate = await configRepository.getString("VRCX_VRChatRegistryLastBackupDate");
      const lastRestoreCheck = await configRepository.getString("VRCX_VRChatRegistryLastRestoreCheck");
      if (!lastBackupDate || (lastRestoreCheck && lastBackupDate && lastRestoreCheck === lastBackupDate)) {
        return;
      }

      modalStore
        .alert({
          description: t("dialog.registry_backup.restore_prompt"),
          title: t("dialog.registry_backup.header"),
        })
        .catch(logError);
      showRegistryBackupDialog();
      await AppApi.FocusWindow();
      await configRepository.setString("VRCX_VRChatRegistryLastRestoreCheck", lastBackupDate);
    } else {
      await tryAutoBackupVrcRegistry();
    }
  }

  function showRegistryBackupDialog() {
    isRegistryBackupDialogVisible.value = true;
  }

  async function tryAutoBackupVrcRegistry() {
    if (!advancedSettingsStore.vrcRegistryAutoBackup) {
      return;
    }
    const date = new Date();
    const lastBackupDate = await configRepository.getString("VRCX_VRChatRegistryLastBackupDate");
    if (lastBackupDate) {
      const lastBackup = new Date(lastBackupDate);
      const diff = date.getTime() - lastBackup.getTime();
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (diffDays < 3) {
        return;
      }
    }
    const storedBackups = await configRepository.getString("VRCX_VRChatRegistryBackups");
    const backupsJson = storedBackups === null || storedBackups === "" ? JSON.stringify([]) : storedBackups;
    const backups = parseRegistryBackups(backupsJson);
    for (let i = backups.length - 1; i >= 0; i--) {
      const backup = backups[i];
      if (isAutoBackup(backup) && new Date(backup.date).getTime() < date.getTime() - 1209600000) {
        backups.splice(i, 1);
      }
    }
    await configRepository.setString("VRCX_VRChatRegistryBackups", JSON.stringify(backups));
    backupVrcRegistry("Auto Backup").catch(logError);
    await configRepository.setString("VRCX_VRChatRegistryLastBackupDate", date.toJSON());
  }

  return {
    backupVrcRegistry,
    checkAutoBackupRestoreVrcRegistry,
    showRegistryBackupDialog,
    tryAutoBackupVrcRegistry,
  };
}
