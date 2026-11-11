import { toast } from "vue-sonner";
import type { useI18n } from "vue-i18n";
import type { Ref } from "vue";

import { database } from "../../services/database";
import { configRepository } from "../../services/config";
import { parseLeadingInt } from "../vrcx-messages";
import { logDialogFailure } from "./advanced-failure-logs";
import type { useVrcxStore } from "../vrcx";
import type { useVRCXUpdaterStore } from "../vrcx-updater";
import type { useModalStore } from "../modal";
import type { useUpdateLoopStore } from "../update-loop";

export type CreateAdvancedDataMaintenanceDeps = {
  vrcxStore: ReturnType<typeof useVrcxStore>;
  VRCXUpdaterStore: ReturnType<typeof useVRCXUpdaterStore>;
  modalStore: ReturnType<typeof useModalStore>;
  updateLoopStore: ReturnType<typeof useUpdateLoopStore>;
  sqliteTableSizes: Ref<{
    gps: number;
    status: number;
    bio: number;
    avatar: number;
    onlineOffline: number;
    friendLogHistory: number;
    notification: number;
    location: number;
    joinLeave: number;
    portalSpawn: number;
    videoPlay: number;
    event: number;
    external: number;
  }>;
  avatarAutoCleanup: Ref<string>;
  purgeInProgress: Ref<boolean>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createAdvancedDataMaintenance(deps: CreateAdvancedDataMaintenanceDeps) {
  const { vrcxStore, VRCXUpdaterStore, modalStore, updateLoopStore, sqliteTableSizes, avatarAutoCleanup, purgeInProgress, t } = deps;

  async function setAvatarAutoCleanup(value: string) {
    avatarAutoCleanup.value = value;
    await configRepository.setString("VRCX_avatarAutoCleanup", value);
  }

  async function purgeAvatarFeedData(days: number | null) {
    let cutoffDate: string | null = null;
    if (days !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoffDate = cutoff.toJSON();
    }

    purgeInProgress.value = true;

    const msgBox = toast.warning(t("view.settings.advanced.advanced.database_cleanup.purge_in_progress"), {
      duration: Infinity,
    });

    try {
      await database.purgeAvatarFeedData(cutoffDate);
      await database.vacuum();
      toast.dismiss(msgBox);
      toast.success(t("view.settings.advanced.advanced.database_cleanup.purge_complete"));

      await new Promise((resolve) => setTimeout(resolve, 1500));
      VRCXUpdaterStore.restartVRCX(false);
    } catch (err) {
      console.error(err);
      toast.dismiss(msgBox);
      toast.error(t("view.settings.advanced.advanced.database_cleanup.purge_failed", { error: err }));
    } finally {
      purgeInProgress.value = false;
    }
  }

  async function runAvatarAutoCleanup(userId: string) {
    const cleanupSetting = await configRepository.getString("VRCX_avatarAutoCleanup", "Off");
    if (cleanupSetting === "Off") return;

    const configKey = `VRCX_lastAvatarCleanupDate_${userId}`;
    const lastCleanupStr = await configRepository.getString(configKey, "");
    const now = new Date();

    if (lastCleanupStr) {
      const lastCleanup = new Date(lastCleanupStr);
      const daysSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastCleanup < 7) return;
    }

    const days = parseLeadingInt(cleanupSetting);
    if (Number.isNaN(days) || days <= 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toJSON();

    try {
      await database.purgeAvatarFeedData(cutoffDate);
      await configRepository.setString(configKey, now.toJSON());
      console.log(`Auto-cleaned avatar feed data older than ${days} days`);
    } catch (err) {
      console.error("Avatar auto-cleanup failed:", err);
    }
  }

  async function getSqliteTableSizes() {
    const [gps, status, bio, avatar, onlineOffline, friendLogHistory, notification, location, joinLeave, portalSpawn, videoPlay, event, external] =
      await Promise.all([
        database.getGpsTableSize(),
        database.getStatusTableSize(),
        database.getBioTableSize(),
        database.getAvatarTableSize(),
        database.getOnlineOfflineTableSize(),
        database.getFriendLogHistoryTableSize(),
        database.getNotificationTableSize(),
        database.getLocationTableSize(),
        database.getJoinLeaveTableSize(),
        database.getPortalSpawnTableSize(),
        database.getVideoPlayTableSize(),
        database.getEventTableSize(),
        database.getExternalTableSize(),
      ]);

    sqliteTableSizes.value = {
      gps,
      status,
      bio,
      avatar,
      onlineOffline,
      friendLogHistory,
      notification,
      location,
      joinLeave,
      portalSpawn,
      videoPlay,
      event,
      external,
    };
  }

  function promptAutoClearVRCXCacheFrequency() {
    void modalStore
      .prompt({
        title: t("prompt.auto_clear_cache.header"),
        description: t("prompt.auto_clear_cache.description"),
        confirmText: t("prompt.auto_clear_cache.ok"),
        cancelText: t("prompt.auto_clear_cache.cancel"),
        inputValue: (vrcxStore.clearVRCXCacheFrequency / 3600 / 2).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.auto_clear_cache.input_error"),
      })
      .then(async ({ ok, value }) => {
        if (!ok) return;
        const hours = parseLeadingInt(value);
        if (value && !Number.isNaN(hours)) {
          vrcxStore.setClearVRCXCacheFrequency(hours * 3600 * 2);
          updateLoopStore.setNextClearVRCXCacheCheck(vrcxStore.clearVRCXCacheFrequency / 2);
          await configRepository.setString("VRCX_clearVRCXCacheFrequency", vrcxStore.clearVRCXCacheFrequency.toString());
        }
      })
      .catch(logDialogFailure);
  }

  return {
    setAvatarAutoCleanup,
    purgeAvatarFeedData,
    runAvatarAutoCleanup,
    getSqliteTableSizes,
    promptAutoClearVRCXCacheFrequency,
  };
}
