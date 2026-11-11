<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-2 rounded-xl bg-(--profile-card)">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <Button
          class="rounded-full"
          variant="ghost"
          size="icon-sm"
          :disabled="isLoading"
          :title="t('dialog.user.activity.refresh_hint')"
          @click="refreshData({ forceRefresh: true })"
        >
          <Spinner v-if="isLoading" />
          <RefreshCw v-else />
        </Button>
        <span v-if="filteredEventCount > 0" class="text-accent-foreground ml-1 text-sm">
          {{ t("dialog.user.activity.total_events", { count: filteredEventCount }) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-sm">{{ t("dialog.user.activity.period") }}</span>
        <Select v-model="userDialog.activityPeriodDays" :disabled="isLoading">
          <SelectTrigger size="sm" class="w-40" @click.stop>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-if="fullCacheReady" value="0">{{ t("dialog.user.activity.period_all") }}</SelectItem>
            <SelectItem v-if="fullCacheReady" value="365">{{ t("dialog.user.activity.period_365") }}</SelectItem>
            <SelectItem v-if="fullCacheReady" value="180">{{ t("dialog.user.activity.period_180") }}</SelectItem>
            <SelectItem value="90">{{ t("dialog.user.activity.period_90") }}</SelectItem>
            <SelectItem value="30">{{ t("dialog.user.activity.period_30") }}</SelectItem>
            <SelectItem value="7">{{ t("dialog.user.activity.period_7") }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div v-if="isSelf && !fullCacheReady" class="text-xs text-muted-foreground mb-1">
        {{ t("dialog.user.activity.building_cache") }}
      </div>

      <div v-if="peakDayText || peakTimeText" class="mt-2 mb-1 text-sm flex gap-4">
        <div v-if="peakDayText">
          <span class="text-muted-foreground">{{ t("dialog.user.activity.most_active_day") }}</span>
          <span class="font-medium ml-1">{{ peakDayText }}</span>
        </div>
        <div v-if="peakTimeText">
          <span class="text-muted-foreground">{{ t("dialog.user.activity.most_active_time") }}</span>
          <span class="font-medium ml-1">{{ peakTimeText }}</span>
        </div>
      </div>

      <div v-if="isLoading && filteredEventCount === 0" class="flex flex-col items-center justify-center flex-1 my-8 gap-2">
        <Spinner class="h-5 w-5" />
        <span class="text-sm text-muted-foreground">{{ t("dialog.user.activity.preparing_data") }}</span>
        <span class="text-xs text-muted-foreground">{{ t("dialog.user.activity.preparing_data_hint") }}</span>
      </div>

      <div v-if="!isLoading && filteredEventCount === 0" class="flex items-center justify-center flex-1 my-8">
        <span class="text-muted-foreground text-sm">{{ t("dialog.user.activity.no_data_in_period") }}</span>
      </div>

      <div v-show="filteredEventCount > 0" ref="activityChartRef" class="min-w-0 w-full h-[240px]" @contextmenu.prevent="onChartRightClick" />

      <DailyPlaytime v-if="isSelf" :sessions="cachedSessions" :range-days="currentRangeDays" />

      <div v-if="!isSelf" v-show="filteredEventCount > 0" class="mt-4 border-t border-border pt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ t("dialog.user.activity.overlap.header") }}</span>
            <Spinner v-if="isOverlapLoadingVisible" class="h-3.5 w-3.5" />
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <Switch :model-value="excludeHoursEnabled" class="scale-75" @update:model-value="onExcludeToggle" />
            <span class="text-sm text-muted-foreground whitespace-nowrap">
              {{ t("dialog.user.activity.overlap.exclude_hours") }}
            </span>
            <Select v-model="excludeStartHour" @update:model-value="onExcludeRangeChange">
              <SelectTrigger size="sm" class="w-[78px] h-6 text-sm px-2" @click.stop>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="hour in 24" :key="hour - 1" :value="String(hour - 1)"> {{ String(hour - 1).padStart(2, "0") }}:00 </SelectItem>
              </SelectContent>
            </Select>
            <span class="text-xs text-muted-foreground">–</span>
            <Select v-model="excludeEndHour" @update:model-value="onExcludeRangeChange">
              <SelectTrigger size="sm" class="w-[78px] h-6 text-sm px-2" @click.stop>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="hour in 24" :key="hour - 1" :value="String(hour - 1)"> {{ String(hour - 1).padStart(2, "0") }}:00 </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="!isOverlapLoadingVisible && hasOverlapData" class="flex flex-col gap-1 mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" :class="overlapPercent > 0 ? 'text-accent-foreground' : 'text-muted-foreground'"> {{ overlapPercent }}% </span>
            <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 w-(--overlap-width) bg-(--overlap-bar-colour)"
                :style="{
                  '--overlap-width': `${overlapPercent}%`,
                  '--overlap-bar-colour': isDarkMode ? 'hsl(260, 60%, 55%)' : 'hsl(260, 55%, 50%)',
                }"
              />
            </div>
          </div>
          <div v-if="bestOverlapTime" class="text-sm">
            <span class="text-muted-foreground">{{ t("dialog.user.activity.overlap.peak_overlap") }}</span>
            <span class="font-medium ml-1">{{ bestOverlapTime }}</span>
          </div>
        </div>

        <div
          v-show="hasOverlapData || isOverlapLoadingVisible"
          ref="overlapChartRef"
          class="min-w-0 w-full h-[240px]"
          @contextmenu.prevent="onOverlapChartRightClick"
        />

        <div v-if="!isOverlapLoading && !hasOverlapData" class="flex text-sm items-center justify-center text-muted-foreground my-8">
          {{ t("dialog.user.activity.overlap.no_data") }}
        </div>
      </div>

      <div v-if="isSelf && filteredEventCount > 0" class="mt-4 border-t border-border pt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">
              {{ t("dialog.user.activity.most_visited_worlds.header") }}
            </span>
            <Spinner v-if="topWorldsLoadingVisible" class="h-3.5 w-3.5" />
          </div>
          <div class="flex items-center gap-4">
            <div v-if="isSelf && currentHomeWorldId" class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Switch :model-value="excludeHomeWorldEnabled" class="scale-75" @update:model-value="onExcludeHomeWorldToggle" />
              <span class="whitespace-nowrap">
                {{ t("dialog.user.activity.most_visited_worlds.exclude_home_world") }}
              </span>
            </div>
            <div v-if="topWorlds.length > 0" class="flex items-center gap-2">
              <span class="text-muted-foreground text-sm">{{ t("common.sort_by") }}</span>
              <Select v-model="topWorldsSortBy" :disabled="topWorldsLoading">
                <SelectTrigger size="sm" class="w-32" @click.stop>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">{{ t("dialog.user.activity.most_visited_worlds.sort_by_time") }}</SelectItem>
                  <SelectItem value="count">{{ t("dialog.user.activity.most_visited_worlds.sort_by_count") }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div v-if="topWorldsLoadingVisible && topWorlds.length === 0" class="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Spinner class="h-4 w-4" />
          <span>{{ t("dialog.user.activity.most_visited_worlds.loading") }}</span>
        </div>
        <div v-else-if="topWorlds.length === 0 && !isLoading && !topWorldsLoading" class="text-sm text-muted-foreground py-2">
          {{ t("dialog.user.activity.no_data_in_period") }}
        </div>
        <div v-else class="flex flex-col gap-0.5">
          <button
            v-for="(world, index) in sortedTopWorlds"
            :key="world.worldId ?? index"
            type="button"
            class="group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50 cursor-pointer"
            :class="index === 0 ? 'bg-primary/4' : ''"
            @click="openWorld(world.worldId)"
          >
            <span class="mt-1 w-5 shrink-0 text-right font-mono text-xs font-bold" :class="index === 0 ? 'text-primary' : 'text-muted-foreground'">
              #{{ index + 1 }}
            </span>
            <Avatar class="rounded-sm size-8 mt-0.5 shrink-0">
              <AvatarImage
                v-if="getWorldThumbnail(world.worldId)"
                :src="getWorldThumbnail(world.worldId) ?? ''"
                loading="lazy"
                decoding="async"
                class="rounded-sm object-cover"
              />
              <AvatarFallback class="rounded-sm">
                <ImageIcon class="size-3.5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ world.worldName }}</span>
                <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {{
                    topWorldsSortBy === "time"
                      ? formatWorldTime(world.totalTime)
                      : t("dialog.user.activity.most_visited_worlds.visit_count_label", {
                          count: world.visitCount,
                        })
                  }}
                </span>
              </div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full" :class="isDarkMode ? 'bg-white/8' : 'bg-black/6'">
                <div
                  class="h-full rounded-full transition-all duration-500 w-(--top-world-width)"
                  :class="isDarkMode ? 'bg-white/45' : 'bg-black/25'"
                  :style="{
                    '--top-world-width': getTopWorldBarWidth(topWorldsSortBy === 'time' ? world.totalTime : (world.visitCount ?? 0)),
                  }"
                />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import Button from "@/components/ui/button/Button.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Switch from "@/components/ui/switch/Switch.vue";
import { Image as ImageIcon, RefreshCw } from "lucide-vue-next";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { configRepository } from "../../../services/config";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useActivityStore } from "../../../stores/activity";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useUserStore } from "../../../stores/user";
import { useWorldStore } from "../../../stores/world";
import { logError } from "../../../stores/notification/errors";
import type { ActivitySession } from "../../../types/activity";
import { useActivityCharts } from "./activity/use-activity-charts";
import { useActivityOverlap } from "./activity/use-activity-overlap";
import { useActivityTopWorlds } from "./activity/use-activity-top-worlds";
import type { HeatmapView } from "./activity/activity-tab-types";
import DailyPlaytime from "./activity/DailyPlaytime.vue";

const { t, locale } = useI18n();
const { userDialog, currentUser } = storeToRefs(useUserStore());
const { isDarkMode, weekStartsOn } = storeToRefs(useAppearanceSettingsStore());
const activityStore = useActivityStore();
const { fullCacheReady, userActivity } = storeToRefs(activityStore);
const worldStore = useWorldStore();

const isLoading = ref(false);
const currentRangeDays = ref(30);
const cachedSessions = ref<ActivitySession[]>([]);
const filteredEventCount = ref(0);
const peakDayText = ref("");
const peakTimeText = ref("");
const topWorldsSortBy = ref("count");
const excludeHomeWorldEnabled = ref(false);
const excludeHoursEnabled = ref(false);
const excludeStartHour = ref("1");
const excludeEndHour = ref("6");
const mainHeatmapView = ref<HeatmapView>({
  rawBuckets: [],
  normalizedBuckets: [],
});
const isRestoringSettings = ref(false);

const isSelf = computed(() => userDialog.value.id === currentUser.value.id);
const currentHomeWorldId = computed(() => {
  const homeLocation = currentUser.value.homeLocation;
  if (!homeLocation) {
    return "";
  }
  return parseLocation(homeLocation).worldId || homeLocation;
});
const dayLabels = computed<string[]>(() => [
  t("dialog.user.activity.days.sun"),
  t("dialog.user.activity.days.mon"),
  t("dialog.user.activity.days.tue"),
  t("dialog.user.activity.days.wed"),
  t("dialog.user.activity.days.thu"),
  t("dialog.user.activity.days.fri"),
  t("dialog.user.activity.days.sat"),
]);
const displayDayLabels = computed(() => {
  const start = weekStartsOn.value;
  return Array.from({ length: 7 }, (_, index) => dayLabels.value[(start + index) % 7] ?? "");
});
const hourLabels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const ACTIVITY_SELF_TOP_WORLDS_SORT_KEY = "VRCX_activitySelfTopWorldsSortBy";
const ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY = "VRCX_activitySelfExcludeHomeWorld";

const {
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
} = useActivityOverlap({
  activityStore,
  userDialog,
  currentUser,
  isSelf,
  dayLabels,
  excludeHoursEnabled,
  excludeStartHour,
  excludeEndHour,
});
const {
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
} = useActivityTopWorlds({
  activityStore,
  worldStore,
  userDialog,
  isSelf,
  currentHomeWorldId,
  topWorldsSortBy,
  excludeHomeWorldEnabled,
});
const activityChartRef = ref<HTMLDivElement | null>(null);
const overlapChartRef = ref<HTMLDivElement | null>(null);
const {
  renderActivityChart,
  rebuildCharts,
  scheduleOverlapChartRender,
  clearOverlapRenderTimer,
  onChartRightClick,
  onOverlapChartRightClick,
  clearEasterEggTimer,
  disposeCharts,
} = useActivityCharts({
  t,
  activityChartRef,
  overlapChartRef,
  isDarkMode,
  weekStartsOn,
  displayDayLabels,
  hourLabels,
  mainHeatmapView,
  filteredEventCount,
  overlapHeatmapView,
  hasOverlapData,
  isOverlapLoading,
});

async function applySettingsAndRefresh() {
  isRestoringSettings.value = true;
  const [sortBy, isExcludeHomeWorld, isOverlapExcludeEnabled, overlapExcludeStart, overlapExcludeEnd] = await Promise.all([
    configRepository.getString(ACTIVITY_SELF_TOP_WORLDS_SORT_KEY, "count"),
    configRepository.getBool(ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY, false),
    configRepository.getBool("VRCX_overlapExcludeEnabled", false),
    configRepository.getString("VRCX_overlapExcludeStart", "1"),
    configRepository.getString("VRCX_overlapExcludeEnd", "6"),
  ]);
  topWorldsSortBy.value = ["time", "count"].includes(sortBy) ? sortBy : "count";
  excludeHomeWorldEnabled.value = isExcludeHomeWorld;
  excludeHoursEnabled.value = isOverlapExcludeEnabled;
  excludeStartHour.value = overlapExcludeStart;
  excludeEndHour.value = overlapExcludeEnd;
  await nextTick();
  isRestoringSettings.value = false;
  await refreshData();
}

function resetActivityState() {
  isLoading.value = false;
  filteredEventCount.value = 0;
  peakDayText.value = "";
  peakTimeText.value = "";
  resetOverlapState();
  resetTopWorldsState();
  mainHeatmapView.value = { rawBuckets: [], normalizedBuckets: [] };
  clearOverlapRenderTimer();
}

async function refreshData({ silent = false, forceRefresh = false }: { silent?: boolean; forceRefresh?: boolean } = {}) {
  const userId = userDialog.value.id;
  if (!userId) {
    return;
  }

  const requestId = ++userActivity.value.activeRequestId;
  const overlapRequestId = ++userActivity.value.activeOverlapRequestId;
  if (!silent) {
    isLoading.value = true;
  }

  try {
    const rangeDays = Number(userDialog.value.activityPeriodDays) === 0 ? 3650 : Number(userDialog.value.activityPeriodDays) || 30;
    const activityView = await activityStore.loadActivityView({
      userId,
      isSelf: isSelf.value,
      rangeDays,
      dayLabels: dayLabels.value,
      forceRefresh,
    });
    if (requestId !== userActivity.value.activeRequestId || userDialog.value.id !== userId) {
      return;
    }

    filteredEventCount.value = activityView.filteredEventCount;
    peakDayText.value = activityView.peakDay;
    peakTimeText.value = activityView.peakTime;
    mainHeatmapView.value = {
      rawBuckets: activityView.rawBuckets,
      normalizedBuckets: activityView.normalizedBuckets,
    };
    userActivity.value.lastLoadedUserId = userId;

    if (isSelf.value) {
      currentRangeDays.value = rangeDays;
      const cache = await activityStore.getCache(userId, true);
      cachedSessions.value = cache.sessions;
    }

    if (isSelf.value) {
      await loadTopWorldsSection({
        userId,
        rangeDays,
        sortBy: topWorldsSortBy.value,
        period: userDialog.value.activityPeriodDays,
      });
      if (requestId !== userActivity.value.activeRequestId || userDialog.value.id !== userId) {
        return;
      }
      hasOverlapData.value = false;
      return;
    }

    beginOverlapLoading(overlapRequestId);
    const overlapView = await activityStore.loadOverlapView({
      currentUserId: currentUser.value.id,
      targetUserId: userId,
      rangeDays,
      dayLabels: dayLabels.value,
      forceRefresh,
      excludeHours: {
        enabled: excludeHoursEnabled.value,
        startHour: Number(excludeStartHour.value),
        endHour: Number(excludeEndHour.value),
      },
    });
    if (requestId !== userActivity.value.activeRequestId || userDialog.value.id !== userId) {
      return;
    }
    applyOverlapView(overlapView);
  } finally {
    if (requestId === userActivity.value.activeRequestId) {
      isLoading.value = false;
    }
    finishOverlapLoading(overlapRequestId);
  }
}

async function onPeriodChange(period: string) {
  userDialog.value.activityPeriodDays = period;
  await refreshData();
}

async function onExcludeToggle(isEnabled: boolean) {
  excludeHoursEnabled.value = isEnabled;
  await configRepository.setBool("VRCX_overlapExcludeEnabled", isEnabled);
  await refreshOverlapOnly();
}

async function onExcludeRangeChange() {
  await configRepository.setString("VRCX_overlapExcludeStart", excludeStartHour.value);
  await configRepository.setString("VRCX_overlapExcludeEnd", excludeEndHour.value);
  await refreshOverlapOnly();
}

async function onExcludeHomeWorldToggle(isEnabled: boolean) {
  excludeHomeWorldEnabled.value = isEnabled;
  await configRepository.setBool(ACTIVITY_SELF_EXCLUDE_HOME_WORLD_KEY, isEnabled);
  await refreshTopWorldsOnly();
}

async function loadOnlineFrequency(userId: string) {
  if (!userId || userDialog.value.id !== userId) {
    return;
  }
  if (userId !== userActivity.value.lastLoadedUserId) {
    resetActivityState();
  } else if (isLoading.value || filteredEventCount.value > 0) {
    return;
  }

  await applySettingsAndRefresh();
}

watch(
  () => userDialog.value.id,
  () => {
    rebuildCharts();
  }
);
watch([locale, isDarkMode, weekStartsOn], rebuildCharts);
watch(
  () => userDialog.value.activityPeriodDays,
  (period) => {
    if (isRestoringSettings.value) {
      return;
    }
    if (userDialog.value.visible && userDialog.value.activeTab === "Activity") {
      onPeriodChange(period).catch((err: unknown) => {
        console.error(err);
      });
    }
  }
);
watch(
  () => topWorldsSortBy.value,
  () => {
    if (isRestoringSettings.value) {
      return;
    }
    configRepository.setString(ACTIVITY_SELF_TOP_WORLDS_SORT_KEY, topWorldsSortBy.value).catch((err: unknown) => {
      console.error(err);
    });
    refreshTopWorldsOnly().catch((err: unknown) => {
      console.error(err);
    });
  }
);
watch(
  () => currentUser.value.homeLocation,
  () => {
    if (excludeHomeWorldEnabled.value) {
      refreshTopWorldsOnly().catch((err: unknown) => {
        console.error(err);
      });
    }
  }
);
watch(
  () => mainHeatmapView.value,
  () => {
    nextTick(() => renderActivityChart()).catch(logError);
  },
  { deep: true }
);
watch(
  () => overlapHeatmapView.value,
  () => {
    scheduleOverlapChartRender();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  clearEasterEggTimer();
  clearTopWorldsLoadingTimer();
  clearOverlapLoadingTimer();
  clearOverlapRenderTimer();
  disposeCharts();
});

defineExpose({
  loadOnlineFrequency,
});
</script>
