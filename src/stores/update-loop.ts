import { defineStore } from "pinia";
import { watch } from "vue";

import { database } from "../services/database";
import { groupRequest } from "../api/group";
import { runRefreshFriendsListFlow } from "../coordinators/friend-sync-coordinator";
import { runUpdateIsGameRunningFlow } from "../coordinators/game-coordinator";
import { addGameLogEvent } from "../coordinators/game-log-coordinator";
import { runRefreshPlayerModerationsFlow } from "../coordinators/moderation-coordinator";
import { clearVRCXCache } from "../coordinators/vrcx-coordinator";
import { useAuthStore } from "./auth";
import { useDiscordPresenceSettingsStore } from "./settings/discord-presence";
import { useFriendStore } from "./friend";
import { handleGroupUserInstances } from "../coordinators/group-membership-coordinator";
import { getCurrentUser, updateAutoStateChange } from "../coordinators/user-coordinator";
import { useNotificationStore } from "./notification";
import { useUserStore } from "./user";
import { useVRCXUpdaterStore } from "./vrcx-updater";
import { useVrStore } from "./vr";
import { useVrcxStore } from "./vrcx";
import { logFailure } from "./log-failure";
import { watchState } from "../services/watch-state";

import * as workerTimers from "worker-timers";

export const useUpdateLoopStore = defineStore("UpdateLoop", () => {
  const authStore = useAuthStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const vrcxStore = useVrcxStore();
  const discordPresenceSettingsStore = useDiscordPresenceSettingsStore();
  const vrcxUpdaterStore = useVRCXUpdaterStore();
  const vrStore = useVrStore();
  const notificationStore = useNotificationStore();
  const state = {
    nextCurrentUserRefresh: 300,
    nextFriendsRefresh: 3600,
    nextGroupInstanceRefresh: 0,
    nextAppUpdateCheck: 3600,
    ipcTimeout: 0,
    nextClearVRCXCacheCheck: 86400,
    nextDiscordUpdate: 0,
    nextAutoStateChange: 0,
    nextGetLogCheck: 0,
    nextGameRunningCheck: 0,
    nextDatabaseOptimize: 3600,
    nextBundleCheck: 60,
  };

  watch(
    () => watchState.isLoggedIn,
    () => {
      state.nextCurrentUserRefresh = 300;
      state.nextFriendsRefresh = 3600;
      state.nextGroupInstanceRefresh = 0;
      state.nextBundleCheck = 60;
    },
    { flush: "sync" }
  );

  const nextGroupInstanceRefresh = state.nextGroupInstanceRefresh;

  const nextCurrentUserRefresh = state.nextCurrentUserRefresh;

  const nextDiscordUpdate = state.nextDiscordUpdate;

  const ipcTimeout = state.ipcTimeout;

  async function updateLoop() {
    try {
      if (watchState.isLoggedIn) {
        if (--state.nextCurrentUserRefresh <= 0) {
          state.nextCurrentUserRefresh = 300;
          void getCurrentUser().catch(logFailure("Refreshing current user failed:"));
        }
        if (--state.nextFriendsRefresh <= 0) {
          state.nextFriendsRefresh = 3600;
          void runRefreshFriendsListFlow().catch(logFailure("Refreshing friends list failed:"));
          void authStore.updateStoredUser(userStore.currentUser).catch(logFailure("Updating stored user failed:"));
          if (userStore.currentUser.last_activity && new Date(userStore.currentUser.last_activity) > new Date(Date.now() - 3600 * 1000)) {
            void runRefreshPlayerModerationsFlow().catch(logFailure("Refreshing player moderations failed:"));
            void userStore.getAllProductPurchases().catch(logFailure("Loading product purchases failed:"));
          }
        }
        if (--state.nextGroupInstanceRefresh <= 0) {
          if (watchState.isFriendsLoaded) {
            state.nextGroupInstanceRefresh = 300;
            const args = await groupRequest.getUsersGroupInstances();
            void handleGroupUserInstances({ json: { ...args.json, instances: args.json.instances ?? [] } }).catch(
              logFailure("Handling group instances failed:")
            );
          }
          void AppApi.CheckGameRunning().catch(logFailure("Checking game running failed:"));
        }
        if (--state.nextAppUpdateCheck <= 0) {
          state.nextAppUpdateCheck = 3600;
          if (vrcxUpdaterStore.autoUpdateVRCX !== "Off") {
            void vrcxUpdaterStore.checkForVRCXUpdate().catch(logFailure("Checking for VRCX update failed:"));
          }
          void vrcxStore.tryAutoBackupVrcRegistry().catch(logFailure("Backing up VRC registry failed:"));
        }
        if (--state.ipcTimeout <= 0) {
          vrcxStore.setIpcEnabled(false);
        }
        if (--state.nextClearVRCXCacheCheck <= 0 && vrcxStore.clearVRCXCacheFrequency > 0) {
          state.nextClearVRCXCacheCheck = vrcxStore.clearVRCXCacheFrequency / 2;
          clearVRCXCache();
        }
        if (--state.nextDiscordUpdate <= 0) {
          state.nextDiscordUpdate = 3;
          if (discordPresenceSettingsStore.discordActive) {
            void discordPresenceSettingsStore.updateDiscord().catch(logFailure("Updating Discord presence failed:"));
          }
        }
        if (--state.nextAutoStateChange <= 0) {
          state.nextAutoStateChange = 3;
          updateAutoStateChange();
        }
        if (isHostLinux && --state.nextGetLogCheck <= 0) {
          state.nextGetLogCheck = 0.5;
          const logLines = await LogWatcher.GetLogLines();
          if (Array.isArray(logLines)) {
            await Promise.all(logLines.map((logLine) => addGameLogEvent(logLine)));
          }
        }
        if (isHostLinux && --state.nextGameRunningCheck <= 0) {
          state.nextGameRunningCheck = 1;
          await runUpdateIsGameRunningFlow(await AppApi.IsGameRunning(), await AppApi.IsSteamVRRunning());
          vrStore.vrInit();
        }
        if (--state.nextDatabaseOptimize <= 0) {
          state.nextDatabaseOptimize = 86400;
          database.optimize().catch(console.error);
        }
        if (--state.nextBundleCheck <= 0) {
          state.nextBundleCheck = 10800;
          void notificationStore.checkInventoryBundles().catch(logFailure("Checking inventory bundles failed:"));
          void notificationStore.checkFreeStoreItems().catch(logFailure("Checking free store items failed:"));
        }
      }
    } catch (err) {
      friendStore.setIsRefreshFriendsLoading(false);
      console.error(err);
    }
    workerTimers.setTimeout(() => updateLoop(), 1000);
  }

  function setNextClearVRCXCacheCheck(value: number) {
    state.nextClearVRCXCacheCheck = value;
  }

  function setNextGroupInstanceRefresh(value: number) {
    state.nextGroupInstanceRefresh = value;
  }

  function setNextDiscordUpdate(value: number) {
    state.nextDiscordUpdate = value;
  }

  function setIpcTimeout(value: number) {
    state.ipcTimeout = value;
  }

  function setNextCurrentUserRefresh(value: number) {
    state.nextCurrentUserRefresh = value;
  }

  return {
    nextGroupInstanceRefresh,
    nextCurrentUserRefresh,
    nextDiscordUpdate,
    ipcTimeout,
    updateLoop,
    setIpcTimeout,
    setNextCurrentUserRefresh,
    setNextDiscordUpdate,
    setNextGroupInstanceRefresh,
    setNextClearVRCXCacheCheck,
  };
});
