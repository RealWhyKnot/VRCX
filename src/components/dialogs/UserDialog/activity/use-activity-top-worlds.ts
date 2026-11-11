import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { storeToRefs } from "pinia";

import { worldRequest } from "../../../../api/world";
import { showWorldDialog } from "../../../../coordinators/world-coordinator";
import { timeToText } from "../../../../shared/utils/base/format";
import type { useActivityStore } from "../../../../stores/activity";
import type { UserDialogState } from "../../../../stores/user-state";
import type { useWorldStore } from "../../../../stores/world";

type ActivityTopWorld = {
  worldId: string | null;
  worldName: string | null;
  visitCount: number | null;
  totalTime: number;
};
type TopWorldsSection = {
  userId: string;
  rangeDays: number;
  sortBy: string;
  period: string;
};

type ActivityTopWorldsDeps = {
  activityStore: ReturnType<typeof useActivityStore>;
  worldStore: ReturnType<typeof useWorldStore>;
  userDialog: Ref<UserDialogState>;
  isSelf: ComputedRef<boolean>;
  currentHomeWorldId: ComputedRef<string>;
  topWorldsSortBy: Ref<string>;
  excludeHomeWorldEnabled: Ref<boolean>;
};

const TOP_WORLDS_LOADING_DELAY = 150;

export function useActivityTopWorlds({
  activityStore,
  worldStore,
  userDialog,
  isSelf,
  currentHomeWorldId,
  topWorldsSortBy,
  excludeHomeWorldEnabled,
}: ActivityTopWorldsDeps) {
  const { userActivity } = storeToRefs(activityStore);

  const topWorldsLoading = ref(false);
  const topWorldsLoadingVisible = ref(false);
  const topWorlds = ref<ActivityTopWorld[]>([]);
  let topWorldsLoadingTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingWorldThumbnailFetches = new Set<string>();
  const sortedTopWorlds = computed(() => topWorlds.value);

  function scheduleTopWorldsLoading(requestId: number) {
    clearTimeout(topWorldsLoadingTimer);
    topWorldsLoadingTimer = setTimeout(() => {
      topWorldsLoadingTimer = undefined;
      if (requestId === userActivity.value.activeTopWorldsRequestId) {
        topWorldsLoadingVisible.value = true;
      }
    }, TOP_WORLDS_LOADING_DELAY);
  }

  function finishTopWorldsLoading(requestId: number) {
    if (requestId !== userActivity.value.activeTopWorldsRequestId) {
      return;
    }
    clearTimeout(topWorldsLoadingTimer);
    topWorldsLoadingTimer = undefined;
    topWorldsLoadingVisible.value = false;
    topWorldsLoading.value = false;
  }

  async function loadTopWorldsSection({ userId, rangeDays, sortBy, period }: TopWorldsSection) {
    const requestId = ++userActivity.value.activeTopWorldsRequestId;
    topWorldsLoading.value = true;
    scheduleTopWorldsLoading(requestId);

    try {
      const result = await activityStore.loadTopWorldsView({
        userId,
        rangeDays,
        limit: 5,
        sortBy,
        excludeWorldId: excludeHomeWorldEnabled.value ? currentHomeWorldId.value : "",
      });
      if (
        requestId !== userActivity.value.activeTopWorldsRequestId ||
        userDialog.value.id !== userId ||
        topWorldsSortBy.value !== sortBy ||
        userDialog.value.activityPeriodDays !== period
      ) {
        return;
      }

      topWorlds.value = result;
      fetchMissingTopWorldThumbnails(topWorlds.value).catch((err: unknown) => {
        console.error(err);
      });
    } finally {
      finishTopWorldsLoading(requestId);
    }
  }

  async function refreshTopWorldsOnly() {
    const userId = userDialog.value.id;
    if (!isSelf.value || !userId) {
      return;
    }

    const rangeDays = Number(userDialog.value.activityPeriodDays) === 0 ? 3650 : Number(userDialog.value.activityPeriodDays) || 30;
    await loadTopWorldsSection({
      userId,
      rangeDays,
      sortBy: topWorldsSortBy.value,
      period: userDialog.value.activityPeriodDays,
    });
  }

  async function fetchMissingTopWorldThumbnails(worlds: ActivityTopWorld[]) {
    const missingWorldIds = worlds
      .map((world) => world.worldId)
      .filter((worldId): worldId is string => {
        if (!worldId || pendingWorldThumbnailFetches.has(worldId)) {
          return false;
        }
        return !worldStore.cachedWorlds.get(worldId)?.thumbnailImageUrl;
      });

    if (missingWorldIds.length === 0) {
      return;
    }

    const fetches = missingWorldIds.map(async (worldId) => {
      pendingWorldThumbnailFetches.add(worldId);
      try {
        await worldRequest.getWorld({ worldId });
      } finally {
        pendingWorldThumbnailFetches.delete(worldId);
      }
    });

    await Promise.allSettled(fetches);
    topWorlds.value = [...topWorlds.value];
  }

  function getWorldThumbnail(worldId: string | null) {
    const cached = worldId === null ? undefined : worldStore.cachedWorlds.get(worldId);
    if (!cached?.thumbnailImageUrl) {
      return null;
    }
    return cached.thumbnailImageUrl.replace("256", "128");
  }

  function openWorld(worldId: string | null) {
    if (worldId) {
      showWorldDialog(worldId);
    }
  }

  function formatWorldTime(ms: number) {
    if (!ms || ms <= 0) {
      return "0m";
    }
    return timeToText(ms);
  }

  function getTopWorldBarWidth(value: number) {
    if (sortedTopWorlds.value.length === 0) {
      return "0%";
    }
    const key = topWorldsSortBy.value === "count" ? "visitCount" : "totalTime";
    const maxVal = Math.max(...sortedTopWorlds.value.map((world) => world[key] ?? 0), 0);
    if (maxVal <= 0) {
      return "0%";
    }
    return `${Math.max((value / maxVal) * 100, 8)}%`;
  }

  function resetTopWorldsState() {
    topWorldsLoading.value = false;
    topWorldsLoadingVisible.value = false;
    topWorlds.value = [];
    clearTimeout(topWorldsLoadingTimer);
    topWorldsLoadingTimer = undefined;
  }

  function clearTopWorldsLoadingTimer() {
    clearTimeout(topWorldsLoadingTimer);
  }

  return {
    topWorlds,
    topWorldsLoading,
    topWorldsLoadingVisible,
    sortedTopWorlds,
    loadTopWorldsSection,
    refreshTopWorldsOnly,
    resetTopWorldsState,
    clearTopWorldsLoadingTimer,
    getWorldThumbnail,
    openWorld,
    formatWorldTime,
    getTopWorldBarWidth,
  };
}
