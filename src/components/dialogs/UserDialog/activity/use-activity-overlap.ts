import { ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { storeToRefs } from "pinia";

import type { useActivityStore } from "../../../../stores/activity";
import type { OverlapViewSummary } from "../../../../stores/activity-types";
import type { CurrentUserState, UserDialogState } from "../../../../stores/user-state";
import type { HeatmapView } from "./activity-tab-types";

type ActivityOverlapDeps = {
  activityStore: ReturnType<typeof useActivityStore>;
  userDialog: Ref<UserDialogState>;
  currentUser: Ref<CurrentUserState>;
  isSelf: ComputedRef<boolean>;
  dayLabels: ComputedRef<string[]>;
  excludeHoursEnabled: Ref<boolean>;
  excludeStartHour: Ref<string>;
  excludeEndHour: Ref<string>;
};

const OVERLAP_LOADING_DELAY = 120;

export function useActivityOverlap({
  activityStore,
  userDialog,
  currentUser,
  isSelf,
  dayLabels,
  excludeHoursEnabled,
  excludeStartHour,
  excludeEndHour,
}: ActivityOverlapDeps) {
  const { userActivity } = storeToRefs(activityStore);

  const isOverlapLoading = ref(false);
  const isOverlapLoadingVisible = ref(false);
  const hasOverlapData = ref(false);
  const overlapPercent = ref(0);
  const bestOverlapTime = ref("");

  const overlapHeatmapView = ref<HeatmapView>({
    rawBuckets: [],
    normalizedBuckets: [],
  });

  let overlapLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  function clearOverlapLoadingTimer() {
    if (overlapLoadingTimer !== undefined) {
      clearTimeout(overlapLoadingTimer);
      overlapLoadingTimer = undefined;
    }
  }
  function beginOverlapLoading(requestId: number) {
    isOverlapLoading.value = true;
    isOverlapLoadingVisible.value = false;
    clearOverlapLoadingTimer();
    overlapLoadingTimer = setTimeout(() => {
      overlapLoadingTimer = undefined;
      if (requestId === userActivity.value.activeOverlapRequestId && isOverlapLoading.value) {
        isOverlapLoadingVisible.value = true;
      }
    }, OVERLAP_LOADING_DELAY);
  }

  function finishOverlapLoading(requestId: number) {
    if (requestId !== userActivity.value.activeOverlapRequestId) {
      return;
    }
    clearOverlapLoadingTimer();
    isOverlapLoading.value = false;
    isOverlapLoadingVisible.value = false;
  }
  function applyOverlapView(overlapView: OverlapViewSummary) {
    overlapHeatmapView.value = {
      rawBuckets: overlapView.rawBuckets,
      normalizedBuckets: overlapView.normalizedBuckets,
    };
    hasOverlapData.value = overlapView.hasOverlapData;
    overlapPercent.value = overlapView.overlapPercent;
    bestOverlapTime.value = overlapView.bestOverlapTime;
  }

  async function refreshOverlapOnly() {
    const userId = userDialog.value.id;
    if (!userId || isSelf.value) {
      return;
    }

    const requestId = ++userActivity.value.activeOverlapRequestId;
    beginOverlapLoading(requestId);

    try {
      const rangeDays = Number(userDialog.value.activityPeriodDays) === 0 ? 3650 : Number(userDialog.value.activityPeriodDays) || 30;
      const overlapView = await activityStore.loadOverlapView({
        currentUserId: currentUser.value.id,
        targetUserId: userId,
        rangeDays,
        dayLabels: dayLabels.value,
        forceRefresh: false,
        excludeHours: {
          enabled: excludeHoursEnabled.value,
          startHour: Number(excludeStartHour.value),
          endHour: Number(excludeEndHour.value),
        },
      });
      if (requestId !== userActivity.value.activeOverlapRequestId || userDialog.value.id !== userId) {
        return;
      }
      applyOverlapView(overlapView);
    } finally {
      finishOverlapLoading(requestId);
    }
  }

  function resetOverlapState() {
    hasOverlapData.value = false;
    overlapPercent.value = 0;
    bestOverlapTime.value = "";
    isOverlapLoading.value = false;
    isOverlapLoadingVisible.value = false;
    overlapHeatmapView.value = { rawBuckets: [], normalizedBuckets: [] };
    clearOverlapLoadingTimer();
  }

  return {
    isOverlapLoading,
    isOverlapLoadingVisible,
    hasOverlapData,
    overlapPercent,
    bestOverlapTime,
    overlapHeatmapView,
    beginOverlapLoading,
    finishOverlapLoading,
    applyOverlapView,
    resetOverlapState,
    clearOverlapLoadingTimer,
    refreshOverlapOnly,
  };
}
