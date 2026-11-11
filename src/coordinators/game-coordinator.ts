import { toast } from "vue-sonner";

import { deleteVRChatCache as _deleteVRChatCache } from "./cache-coordinator";
import { isRealInstance } from "../shared/utils/instance";
import { database } from "../services/database";
import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useAvatarStore } from "../stores/avatar";
import { addAvatarWearTime } from "./avatar-coordinator";
import { useGameLogStore } from "../stores/gameLog";
import { useGameStore } from "../stores/game";
import { useInstanceStore } from "../stores/instance";
import { useLaunchStore } from "../stores/launch";
import { useLocationStore } from "../stores/location";
import { runLastLocationResetFlow } from "./location-coordinator";
import { useModalStore } from "../stores/modal";
import { useNotificationStore } from "../stores/notification";
import { logError } from "../stores/notification/errors";
import { useUpdateLoopStore } from "../stores/update-loop";
import { useUserStore } from "../stores/user";
import { useVrStore } from "../stores/vr";
import { useWorldStore } from "../stores/world";

import { configRepository } from "../services/config";

import * as workerTimers from "worker-timers";

type CacheTarget = Parameters<typeof _deleteVRChatCache>[0];

export async function runGameRunningChangedFlow(isGameRunning: boolean): Promise<void> {
  const userStore = useUserStore();
  const instanceStore = useInstanceStore();
  const updateLoopStore = useUpdateLoopStore();
  const gameLogStore = useGameLogStore();
  const vrStore = useVrStore();
  const gameStore = useGameStore();

  if (isGameRunning) {
    userStore.markCurrentUserGameStarted();
  } else {
    await configRepository.setBool("isGameNoVR", gameStore.isGameNoVR === true);

    const sessionStart = userStore.currentUser.$online_for;
    const offlineAt = Date.now();
    if (sessionStart && sessionStart > 0) {
      const sessionDuration = offlineAt - sessionStart;

      gameStore.setLastSession(sessionDuration, offlineAt);
      await Promise.all([
        configRepository.setString("VRCX_lastGameSessionMs", String(sessionDuration)),
        configRepository.setString("VRCX_lastGameOfflineAt", String(offlineAt)),
      ]);
    }
    userStore.markCurrentUserGameStopped();
    instanceStore.removeAllQueuedInstances();
    runAutoVRChatCacheManagementFlow();
    runCheckIfGameCrashedFlow();
    updateLoopStore.setIpcTimeout(0);
    addAvatarWearTime(userStore.currentUser.currentAvatar);
  }

  await runLastLocationResetFlow();
  gameLogStore.clearNowPlaying();
  gameLogStore.resetNowPlayingProducers();
  vrStore.updateVRLastLocation();
  workerTimers.setTimeout(() => {
    runCheckVRChatDebugLoggingFlow().catch(logError);
  }, 60000);
  updateLoopStore.setNextDiscordUpdate(0);
}

export async function runUpdateIsGameRunningFlow(isGameRunningArg: boolean, isSteamVRRunningArg: boolean): Promise<void> {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const vrStore = useVrStore();

  if (advancedSettingsStore.gameLogDisabled) {
    return;
  }
  if (isGameRunningArg !== gameStore.isGameRunning) {
    gameStore.setIsGameRunning(isGameRunningArg);
    await runGameRunningChangedFlow(isGameRunningArg);
    console.log(new Date(), "isGameRunning", isGameRunningArg);
  }

  if (isSteamVRRunningArg !== gameStore.isSteamVRRunning) {
    gameStore.setIsSteamVRRunning(isSteamVRRunningArg);
    console.log("isSteamVRRunning:", isSteamVRRunningArg);
  }
  vrStore.updateOpenVR();
}

export function runUpdateIsHmdAfkFlow(isHmdAfkArg: boolean): void {
  const gameStore = useGameStore();

  if (isHmdAfkArg !== gameStore.isHmdAfk) {
    gameStore.setIsHmdAfk(isHmdAfkArg);
    console.log("isHmdAfk", isHmdAfkArg);
  }
}

function runAutoVRChatCacheManagementFlow(): void {
  const advancedSettingsStore = useAdvancedSettingsStore();

  if (advancedSettingsStore.autoSweepVRChatCache) {
    runSweepVRChatCacheFlow().catch(logError);
  }
}

export async function runSweepVRChatCacheFlow(): Promise<void> {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();

  try {
    const output = await AssetBundleManager.SweepCache();
    console.log("SweepCache", output);
  } catch (e) {
    console.error("SweepCache failed", e);
  }
  if (advancedSettingsStore.isVRChatConfigDialogVisible) {
    gameStore.getVRChatCacheSize().catch(logError);
  }
}

export async function runDeleteVRChatCacheFlow(ref: CacheTarget): Promise<void> {
  const gameStore = useGameStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();

  await _deleteVRChatCache(ref);
  gameStore.getVRChatCacheSize().catch(logError);
  worldStore.updateVRChatWorldCache();
  avatarStore.updateVRChatAvatarCache().catch(logError);
}

export function runCheckIfGameCrashedFlow(): void {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const locationStore = useLocationStore();
  const gameStore = useGameStore();

  if (!advancedSettingsStore.relaunchVRChatAfterCrash) {
    return;
  }
  const { location } = locationStore.lastLocation;
  AppApi.VrcClosedGracefully()
    .then((isClosedGracefully) => {
      if (isClosedGracefully || !isRealInstance(location)) {
        return;
      }

      if (gameStore.state.lastCrashedTime && new Date().getTime() - gameStore.state.lastCrashedTime.getTime() < 120_000) {
        console.log("VRChat was recently crashed, not relaunching");
        return;
      }
      gameStore.setLastCrashedTime(new Date());

      let restartDelay = 8000;
      if (gameStore.isGameNoVR) {
        restartDelay = 2000;
      }
      workerTimers.setTimeout(() => {
        runRestartCrashedGameFlow(location).catch(logError);
      }, restartDelay);
    })
    .catch(logError);
}

async function runRestartCrashedGameFlow(location: string): Promise<void> {
  const gameStore = useGameStore();
  const notificationStore = useNotificationStore();
  const gameLogStore = useGameLogStore();
  const launchStore = useLaunchStore();

  if (!gameStore.isGameNoVR && !gameStore.isSteamVRRunning) {
    console.log("SteamVR isn't running, not relaunching VRChat");
    return;
  }
  AppApi.FocusWindow().catch(logError);
  const message = "VRChat crashed, attempting to rejoin last instance";
  toast(message);
  const entry = {
    created_at: new Date().toJSON(),
    type: "Event",
    data: message,
  };
  notificationStore.queueGameLogNoty(entry);
  const persistedEntry = await database.addGamelogEventToDatabase(entry);
  if (persistedEntry) {
    gameLogStore.addGameLog(persistedEntry);
  }
  launchStore.launchGame(location, "", gameStore.isGameNoVR === true).catch(logError);
}

export async function runCheckVRChatDebugLoggingFlow(): Promise<void> {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const modalStore = useModalStore();

  if (advancedSettingsStore.gameLogDisabled) {
    return;
  }
  try {
    const loggingEnabled: unknown = await gameStore.getVRChatRegistryKey("LOGGING_ENABLED");
    if (loggingEnabled === null || typeof loggingEnabled === "undefined") {
      return;
    }
    if ((typeof loggingEnabled === "string" || typeof loggingEnabled === "number") && Number(loggingEnabled) === 1) {
      return;
    }
    const isRegistryKeySet = await AppApi.SetVRChatRegistryKey("LOGGING_ENABLED", "1", 4);
    if (!isRegistryKeySet) {
      modalStore
        .alert({
          description:
            "VRCX has noticed VRChat debug logging is disabled. VRCX requires debug logging in order to function correctly. Please enable debug logging in VRChat quick menu settings > debug > enable debug logging, then rejoin the instance or restart VRChat.",
          title: "Enable debug logging",
        })
        .catch(logError);
      console.error("Failed to enable debug logging", isRegistryKeySet);
      return;
    }
    modalStore
      .alert({
        description:
          "VRCX has noticed VRChat debug logging is disabled and automatically re-enabled it. VRCX requires debug logging in order to function correctly.",
        title: "Enabled debug logging",
      })
      .catch(logError);
    console.log("Enabled debug logging");
  } catch (e) {
    console.error(e);
  }
}
