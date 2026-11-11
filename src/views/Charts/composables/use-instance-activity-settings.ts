import { nextTick, ref } from "vue";
import type { Ref } from "vue";

import { configRepository } from "../../../services/config";

import type { ActivityDetailChart } from "../activity-types";

function logSettingsError(error: unknown) {
  console.error("Settings update failed:", error);
}

export function useInstanceActivitySettings() {
  const barWidth = ref(25);
  const isDetailVisible = ref(true);
  const isSoloInstanceVisible = ref(true);
  const isNoFriendInstanceVisible = ref(true);

  async function initializeSettings() {
    try {
      const [barWidthValue, isDetailVisibleValue, isSoloInstanceVisibleValue, isNoFriendInstanceVisibleValue] = await Promise.all([
        configRepository.getInt("VRCX_InstanceActivityBarWidth", 25),
        configRepository.getBool("VRCX_InstanceActivityDetailVisible", true),
        configRepository.getBool("VRCX_InstanceActivitySoloInstanceVisible", true),
        configRepository.getBool("VRCX_InstanceActivityNoFriendInstanceVisible", true),
      ]);

      barWidth.value = barWidthValue;
      isDetailVisible.value = isDetailVisibleValue;
      isSoloInstanceVisible.value = isSoloInstanceVisibleValue;
      isNoFriendInstanceVisible.value = isNoFriendInstanceVisibleValue;
    } catch (error) {
      console.error("Failed to initialize settings:", error);
    }
  }

  function changeBarWidth(value: number, onSettingsChange?: () => void) {
    barWidth.value = value;
    void configRepository
      .setInt("VRCX_InstanceActivityBarWidth", value)
      .finally(() => {
        if (onSettingsChange) onSettingsChange();
      })
      .catch(logSettingsError);
  }

  function changeIsDetailInstanceVisible(isVisible: boolean, onSettingsChange?: () => void) {
    isDetailVisible.value = isVisible;
    void configRepository
      .setBool("VRCX_InstanceActivityDetailVisible", isVisible)
      .finally(() => {
        if (onSettingsChange) onSettingsChange();
      })
      .catch(logSettingsError);
  }

  function changeIsSoloInstanceVisible(isVisible: boolean, onSettingsChange?: () => void) {
    isSoloInstanceVisible.value = isVisible;
    void configRepository
      .setBool("VRCX_InstanceActivitySoloInstanceVisible", isVisible)
      .finally(() => {
        if (onSettingsChange) onSettingsChange();
      })
      .catch(logSettingsError);
  }

  function changeIsNoFriendInstanceVisible(isVisible: boolean, onSettingsChange?: () => void) {
    isNoFriendInstanceVisible.value = isVisible;
    void configRepository
      .setBool("VRCX_InstanceActivityNoFriendInstanceVisible", isVisible)
      .finally(() => {
        if (onSettingsChange) onSettingsChange();
      })
      .catch(logSettingsError);
  }

  function handleChangeSettings(activityDetailChartRef: Ref<ActivityDetailChart[] | null>) {
    void nextTick(() => {
      if (activityDetailChartRef.value) {
        activityDetailChartRef.value.forEach((child) => {
          requestAnimationFrame(() => {
            if (child.echartsInstance) {
              child.initEcharts();
            }
          });
        });
      }
    }).catch(logSettingsError);
  }

  return {
    barWidth,
    isDetailVisible,
    isSoloInstanceVisible,
    isNoFriendInstanceVisible,

    initializeSettings,
    changeBarWidth,
    changeIsDetailInstanceVisible,
    changeIsSoloInstanceVisible,
    changeIsNoFriendInstanceVisible,
    handleChangeSettings,
  };
}
