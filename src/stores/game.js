import { reactive, ref } from "vue";
import { defineStore } from "pinia";

import configRepository from "../services/config.js";

export const useGameStore = defineStore("Game", () => {
  const state = reactive({
    lastCrashedTime: null,
  });

  const VRChatUsedCacheSize = ref("");

  const VRChatTotalCacheSize = ref(0);

  const VRChatCacheSizeLoading = ref(false);

  const isGameRunning = ref(false);

  const isGameNoVR = ref(true);

  const isSteamVRRunning = ref(false);

  const isHmdAfk = ref(false);

  const lastSessionDurationMs = ref(0);

  const lastOfflineAt = ref(0);

  async function init() {
    isGameNoVR.value = await configRepository.getBool("isGameNoVR");
    const [savedMs, savedAt] = await Promise.all([
      configRepository.getString("VRCX_lastGameSessionMs", null),
      configRepository.getString("VRCX_lastGameOfflineAt", null),
    ]);
    if (savedMs) lastSessionDurationMs.value = Number(savedMs) || 0;
    if (savedAt) lastOfflineAt.value = Number(savedAt) || 0;
  }

  init();

  function setIsGameRunning(value) {
    isGameRunning.value = value;
  }

  function setIsGameNoVR(value) {
    isGameNoVR.value = value;
  }

  function setIsSteamVRRunning(value) {
    isSteamVRRunning.value = value;
  }

  function setIsHmdAfk(value) {
    isHmdAfk.value = value;
  }

  function setLastSession(durationMs, offlineTimestamp) {
    lastSessionDurationMs.value = durationMs;
    lastOfflineAt.value = offlineTimestamp;
  }

  function setLastCrashedTime(value) {
    state.lastCrashedTime = value;
  }

  async function getVRChatCacheSize() {
    VRChatCacheSizeLoading.value = true;
    const totalCacheSize = 30;
    VRChatTotalCacheSize.value = totalCacheSize;
    const usedCacheSize = await AssetBundleManager.GetCacheSize();
    VRChatUsedCacheSize.value = (usedCacheSize / 1073741824).toFixed(2);
    VRChatCacheSizeLoading.value = false;
  }

  async function getVRChatRegistryKey(key) {
    if (LINUX) {
      return AppApi.GetVRChatRegistryKeyString(key);
    }
    return AppApi.GetVRChatRegistryKey(key);
  }

  return {
    state,

    VRChatUsedCacheSize,
    VRChatTotalCacheSize,
    VRChatCacheSizeLoading,
    isGameRunning,
    isGameNoVR,
    isSteamVRRunning,
    isHmdAfk,
    lastSessionDurationMs,
    lastOfflineAt,

    setIsGameRunning,
    setIsGameNoVR,
    setIsSteamVRRunning,
    setIsHmdAfk,
    setLastSession,
    setLastCrashedTime,
    getVRChatCacheSize,
    getVRChatRegistryKey,
  };
});
