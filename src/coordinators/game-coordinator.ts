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
import { useUpdateLoopStore } from "../stores/update-loop";
import { useUserStore } from "../stores/user";
import { useVrStore } from "../stores/vr";
import { useWorldStore } from "../stores/world";

import { configRepository } from "../services/config";

import * as workerTimers from "worker-timers";

export async function runGameRunningChangedFlow(isGameRunning) {
  const userStore = useUserStore();
  const instanceStore = useInstanceStore();
  const updateLoopStore = useUpdateLoopStore();
  const gameLogStore = useGameLogStore();
  const vrStore = useVrStore();
  const gameStore = useGameStore();

  if (isGameRunning) {
    userStore.markCurrentUserGameStarted();
  } else {
    await configRepository.setBool("isGameNoVR", gameStore.isGameNoVR);

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
  workerTimers.setTimeout(() => runCheckVRChatDebugLoggingFlow(), 60000);
  updateLoopStore.setNextDiscordUpdate(0);
}

export async function runUpdateIsGameRunningFlow(isGameRunningArg, isSteamVRRunningArg) {
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

export function runUpdateIsHmdAfkFlow(isHmdAfkArg) {
  const gameStore = useGameStore();

  if (isHmdAfkArg !== gameStore.isHmdAfk) {
    gameStore.setIsHmdAfk(isHmdAfkArg);
    console.log("isHmdAfk", isHmdAfkArg);
  }
}

function runAutoVRChatCacheManagementFlow() {
  const advancedSettingsStore = useAdvancedSettingsStore();

  if (advancedSettingsStore.autoSweepVRChatCache) {
    runSweepVRChatCacheFlow();
  }
}

export async function runSweepVRChatCacheFlow() {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();

  try {
    const output = await AssetBundleManager.SweepCache();
    console.log("SweepCache", output);
  } catch (e) {
    console.error("SweepCache failed", e);
  }
  if (advancedSettingsStore.isVRChatConfigDialogVisible) {
    gameStore.getVRChatCacheSize();
  }
}

export async function runDeleteVRChatCacheFlow(ref) {
  const gameStore = useGameStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();

  await _deleteVRChatCache(ref);
  gameStore.getVRChatCacheSize();
  worldStore.updateVRChatWorldCache();
  avatarStore.updateVRChatAvatarCache();
}

export function runCheckIfGameCrashedFlow() {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const locationStore = useLocationStore();
  const gameStore = useGameStore();

  if (!advancedSettingsStore.relaunchVRChatAfterCrash) {
    return;
  }
  const { location } = locationStore.lastLocation;
  AppApi.VrcClosedGracefully().then((result) => {
    if (result || !isRealInstance(location)) {
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
    workerTimers.setTimeout(() => runRestartCrashedGameFlow(location), restartDelay);
  });
}

async function runRestartCrashedGameFlow(location) {
  const gameStore = useGameStore();
  const notificationStore = useNotificationStore();
  const gameLogStore = useGameLogStore();
  const launchStore = useLaunchStore();

  if (!gameStore.isGameNoVR && !gameStore.isSteamVRRunning) {
    console.log("SteamVR isn't running, not relaunching VRChat");
    return;
  }
  AppApi.FocusWindow();
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
  launchStore.launchGame(location, "", gameStore.isGameNoVR);
}

export async function runCheckVRChatDebugLoggingFlow() {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const modalStore = useModalStore();

  if (advancedSettingsStore.gameLogDisabled) {
    return;
  }
  try {
    const loggingEnabled = await gameStore.getVRChatRegistryKey("LOGGING_ENABLED");
    if (loggingEnabled === null || typeof loggingEnabled === "undefined") {
      return;
    }
    if (parseInt(String(loggingEnabled), 10) === 1) {
      return;
    }
    const result = await AppApi.SetVRChatRegistryKey("LOGGING_ENABLED", "1", 4);
    if (!result) {
      modalStore.alert({
        description:
          "VRCX has noticed VRChat debug logging is disabled. VRCX requires debug logging in order to function correctly. Please enable debug logging in VRChat quick menu settings > debug > enable debug logging, then rejoin the instance or restart VRChat.",
        title: "Enable debug logging",
      });
      console.error("Failed to enable debug logging", result);
      return;
    }
    modalStore.alert({
      description:
        "VRCX has noticed VRChat debug logging is disabled and automatically re-enabled it. VRCX requires debug logging in order to function correctly.",
      title: "Enabled debug logging",
    });
    console.log("Enabled debug logging");
  } catch (e) {
    console.error(e);
  }
}
