import { reactive, ref } from "vue";
import { defineStore } from "pinia";

import { configRepository } from "../services/config.ts";

export const useGameStore = defineStore("Game", () => {
  const state = reactive<{ lastCrashedTime: Date | null }>({
    lastCrashedTime: null,
  });

  const VRChatUsedCacheSize = ref("");

  const VRChatTotalCacheSize = ref(0);

  const VRChatCacheSizeLoading = ref(false);

  const isGameRunning = ref(false);

  const isGameNoVR = ref<boolean | null>(true);

  const isSteamVRRunning = ref(false);

  const isHmdAfk = ref(false);

  const lastSessionDurationMs = ref(0);

  const lastOfflineAt = ref(0);

  async function init(): Promise<void> {
    isGameNoVR.value = await configRepository.getBool("isGameNoVR");
    const [savedMs, savedAt] = await Promise.all([
      configRepository.getString("VRCX_lastGameSessionMs", null),
      configRepository.getString("VRCX_lastGameOfflineAt", null),
    ]);
    if (savedMs) lastSessionDurationMs.value = Number(savedMs) || 0;
    if (savedAt) lastOfflineAt.value = Number(savedAt) || 0;
  }

  init().catch((err: unknown) => {
    console.error("Failed to load game store settings:", err);
  });

  function setIsGameRunning(isRunning: boolean): void {
    isGameRunning.value = isRunning;
  }

  function setIsGameNoVR(isNoVR: boolean): void {
    isGameNoVR.value = isNoVR;
  }

  function setIsSteamVRRunning(isRunning: boolean): void {
    isSteamVRRunning.value = isRunning;
  }

  function setIsHmdAfk(isAfk: boolean): void {
    isHmdAfk.value = isAfk;
  }

  function setLastSession(durationMs: number, offlineTimestamp: number): void {
    lastSessionDurationMs.value = durationMs;
    lastOfflineAt.value = offlineTimestamp;
  }

  function setLastCrashedTime(value: Date | null): void {
    state.lastCrashedTime = value;
  }

  async function getVRChatCacheSize(): Promise<void> {
    VRChatCacheSizeLoading.value = true;
    const totalCacheSize = 30;
    VRChatTotalCacheSize.value = totalCacheSize;
    const usedCacheSize = await AssetBundleManager.GetCacheSize();
    VRChatUsedCacheSize.value = (usedCacheSize / 1073741824).toFixed(2);
    VRChatCacheSizeLoading.value = false;
  }

  async function getVRChatRegistryKey(key: string): Promise<unknown> {
    if (isHostLinux) {
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
