<template>
  <div class="friend-view x-container">
    <div v-if="settingsReady" class="friend-view-toolbar">
      <Tabs v-model="activeSegment" class="friend-view-tabs">
        <TabsList>
          <TabsTrigger v-for="option in segmentedOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div class="friend-view-actions">
        <InputGroupSearch v-model="searchTerm" class="friend-view-search" :placeholder="t('view.friends_locations.search_placeholder')" />
        <TooltipWrapper :content="t('view.charts.instance_activity.settings.header')" side="top">
          <div>
            <Popover>
              <PopoverTrigger as-child>
                <Button class="rounded-full mr-2" size="icon" variant="ghost" :aria-label="t('view.charts.instance_activity.settings.header')">
                  <Settings />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" class="w-87.5">
                <div class="friend-view-settings">
                  <Field orientation="horizontal" class="friend-view-settings-row">
                    <FieldLabel class="friend-view-settings-label">{{ t("view.friends_locations.separate_same_instance_friends") }}</FieldLabel>
                    <FieldContent class="items-end">
                      <Switch v-model="showSameInstance" />
                    </FieldContent>
                  </Field>
                  <Field orientation="horizontal" class="friend-view-settings-row">
                    <FieldLabel class="friend-view-settings-label">{{ t("view.settings.appearance.appearance.show_cosmetics") }}</FieldLabel>
                    <FieldContent class="items-end">
                      <Switch v-model="showCosmetics" />
                    </FieldContent>
                  </Field>
                  <Field orientation="horizontal" class="friend-view-settings-row">
                    <FieldLabel class="friend-view-settings-label">
                      {{ t("view.friends_locations.scale") }}
                    </FieldLabel>
                    <FieldContent>
                      <div class="friend-view-scale-control">
                        <span class="friend-view-scale-value">{{ cardScalePercentLabel }}&nbsp;</span>
                        <Slider v-model="cardScaleValue" class="friend-view-slider" :min="0.6" :max="1.0" :step="0.01" />
                      </div>
                    </FieldContent>
                  </Field>
                  <Field orientation="horizontal" class="friend-view-settings-row">
                    <FieldLabel class="friend-view-settings-label">
                      {{ t("view.friends_locations.spacing") }}
                    </FieldLabel>
                    <FieldContent>
                      <div class="friend-view-scale-control">
                        <span class="friend-view-scale-value">{{ cardSpacingPercentLabel }}&nbsp;</span>
                        <Slider v-model="cardSpacingValue" class="friend-view-slider" :min="0.25" :max="1.0" :step="0.05" />
                      </div>
                    </FieldContent>
                  </Field>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </TooltipWrapper>
      </div>
    </div>
    <div v-else class="friend-view-toolbar friend-view-toolbar-loading">
      <span class="friend-view-loading-text">{{ t("view.friends_locations.loading_more") }}</span>
    </div>
    <div v-if="settingsReady" ref="scrollbarRef" class="friend-view-scroll">
      <div v-if="virtualRows.length" class="friend-view-virtual" :style="virtualContainerStyle">
        <template v-for="item in virtualItems" :key="String(item.virtualItem.key)">
          <div
            v-if="item.row"
            :ref="measureRow"
            class="friend-view-virtual-row [transform:translateY(var(--virtual-row-start))]"
            :class="`friend-view-virtual-row-${item.row.type}`"
            :data-index="item.virtualItem.index"
            :style="{ '--virtual-row-start': `${item.virtualItem.start}px` }"
          >
            <template v-if="item.row.type === 'header'">
              <header class="friend-view-instance-header">
                <Location class="text-xs inline" :location="getRowInstanceId(item.row)" />
                <span class="friend-view-instance-count">({{ getRowCount(item.row) }})</span>
              </header>
            </template>

            <template v-else-if="item.row.type === 'group-header'">
              <div
                class="flex cursor-pointer select-none items-center gap-1.5 px-1 py-1.5 text-[13px] font-semibold hover:opacity-80"
                @click="toggleGroupCollapse(item.row.groupKey)"
              >
                <ChevronDown class="size-4 shrink-0 transition-transform duration-200 ease-in-out" :class="{ '-rotate-90': item.row.collapsed }" />
                <span class="flex-none">{{ item.row.label }}</span>
                <span class="text-xs font-normal opacity-70">({{ item.row.count }})</span>
              </div>
            </template>

            <template v-else-if="item.row.type === 'divider'">
              <div class="friend-view-divider"><span class="friend-view-divider-text"></span></div>
            </template>

            <template v-else>
              <div class="friend-view-row">
                <FriendLocationCard
                  v-for="card in getRowItems(item.row)"
                  :key="card.key"
                  :friend="card.friend"
                  :card-scale="cardScale"
                  :card-spacing="cardSpacing"
                  :show-cosmetics="showCosmetics"
                  :display-instance-info="card.displayInstanceInfo"
                />
              </div>
            </template>
          </div>
        </template>
      </div>
      <div v-else class="friend-view-empty">
        <DataTableEmpty type="nomatch" />
      </div>
    </div>
    <div v-else class="friend-view-initial-loading">
      <Loader2 class="friend-view-loading-icon" :size="22" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Location from "@/components/Location.vue";
import { useResizeObserver } from "@vueuse/core";
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from "vue";
import { ChevronDown, Loader2, Settings } from "lucide-vue-next";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import { useI18n } from "vue-i18n";

import Popover from "../../components/ui/popover/Popover.vue";
import PopoverContent from "../../components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "../../components/ui/popover/PopoverTrigger.vue";
import Slider from "../../components/ui/slider/Slider.vue";
import Switch from "../../components/ui/switch/Switch.vue";
import { debounce } from "../../shared/utils/common";

import FriendLocationCard from "./components/FriendsLocationsCard.vue";
import { configRepository } from "../../services/config.ts";
import { useFriendsLocationsGrid } from "./composables/use-friends-locations-grid";
import { useFriendsLocationsLists } from "./composables/use-friends-locations-lists";

const { t } = useI18n();

const SEGMENTED_BASE_OPTIONS = [
  { label: t("view.friends_locations.online"), value: "online" },
  { label: t("view.friends_locations.favorite"), value: "favorite" },
  { label: t("view.friends_locations.same_instance"), value: "same-instance" },
  { label: t("view.friends_locations.active"), value: "active" },
  { label: t("view.friends_locations.offline"), value: "offline" },
];

const segmentedOptions = computed(() =>
  showSameInstance.value ? SEGMENTED_BASE_OPTIONS : SEGMENTED_BASE_OPTIONS.filter((option) => option.value !== "same-instance")
);

const cardScale = ref(1);
const cardScaleSlider = ref(1);
const cardSpacingBase = ref(1);
const applyCardScale = debounce((value: number) => {
  cardScale.value = value;
  configRepository.setString("VRCX_FriendLocationCardScale", value.toString()).catch(logFriendsLocationsError);
}, 500);
const persistCardSpacing = debounce((value: number) => {
  configRepository.setString("VRCX_FriendLocationCardSpacing", value.toString()).catch(logFriendsLocationsError);
}, 500);

const cardSpacing = computed({
  get: () => cardSpacingBase.value,
  set: (value: number) => {
    cardSpacingBase.value = value;
    persistCardSpacing(value);
  },
});

const cardScalePercentLabel = computed(() => `${Math.round(cardScaleSlider.value * 100)}%`);
const cardSpacingPercentLabel = computed(() => `${Math.round(cardSpacing.value * 100)}%`);
const cardScaleValue = computed({
  get: () => [cardScaleSlider.value],
  set: (value: number[]) => {
    const next = value[0];
    if (typeof next === "number") {
      cardScaleSlider.value = next;
      applyCardScale(next);
    }
  },
});
const cardSpacingValue = computed({
  get: () => [cardSpacing.value],
  set: (value: number[]) => {
    const next = value[0];
    if (typeof next === "number") {
      cardSpacing.value = next;
    }
  },
});

const showSameInstanceBase = ref(false);
const showCosmeticsBase = ref(true);

const showSameInstance = computed({
  get: () => showSameInstanceBase.value,
  set: (isEnabled: boolean) => {
    showSameInstanceBase.value = isEnabled;
    configRepository.setBool("VRCX_FriendLocationShowSameInstance", isEnabled).catch(logFriendsLocationsError);
  },
});

const showCosmetics = computed({
  get: () => showCosmeticsBase.value,
  set: (isEnabled: boolean) => {
    showCosmeticsBase.value = isEnabled;
    configRepository.setBool("VRCX_FriendLocationShowCosmetics", isEnabled).catch(logFriendsLocationsError);
  },
});

const settingsReady = ref(false);

const activeSegment = ref("online");
const searchTerm = ref("");

const scrollbarRef = ref<HTMLElement>();
const gridWidth = ref(0);
let isMeasureScheduled = false;
let hasPendingGridWidthUpdate = false;

function logFriendsLocationsError(error: unknown) {
  console.error(error);
}

const updateGridWidth = () => {
  const wrap = scrollbarRef.value;
  if (!wrap) {
    return;
  }

  gridWidth.value = wrap.clientWidth;
};

const setupResizeHandling = () => {
  const wrap = scrollbarRef.value;
  if (!wrap) {
    return;
  }

  updateGridWidth();
};

useResizeObserver(scrollbarRef, (entries) => {
  const [entry] = entries;
  gridWidth.value = entry?.contentRect.width ?? scrollbarRef.value?.clientWidth ?? 0;
});

const friendsLists = useFriendsLocationsLists({ activeSegment, searchTerm, showSameInstance });
const { filteredFriends, toggleGroupCollapse } = friendsLists;

const { virtualizer, virtualRows, virtualItems, virtualContainerStyle, measureRow, getRowItems, getRowInstanceId, getRowCount } = useFriendsLocationsGrid({
  cardScale,
  cardSpacing,
  gridWidth,
  scrollbarRef,
  lists: friendsLists,
});

const scheduleVirtualMeasure = ({ updateGridWidth: shouldUpdateGridWidth = false }: { updateGridWidth?: boolean } = {}) => {
  hasPendingGridWidthUpdate = hasPendingGridWidthUpdate || shouldUpdateGridWidth;
  if (isMeasureScheduled) {
    return;
  }

  isMeasureScheduled = true;
  nextTick().then(() => {
    isMeasureScheduled = false;

    if (hasPendingGridWidthUpdate) {
      hasPendingGridWidthUpdate = false;
      updateGridWidth();
    }

    virtualizer.value.measure();
  }, logFriendsLocationsError);
};

watch([searchTerm, activeSegment], () => {
  scheduleVirtualMeasure({ updateGridWidth: true });
});

watch(showSameInstance, (isEnabled) => {
  if (!settingsReady.value) {
    return;
  }
  if (!isEnabled && activeSegment.value === "same-instance") {
    activeSegment.value = "online";
  }

  scheduleVirtualMeasure({ updateGridWidth: true });
});

watch(
  () => filteredFriends.value.length,
  () => {
    scheduleVirtualMeasure({ updateGridWidth: true });
  }
);

watch([cardScale, cardSpacing], () => {
  if (!settingsReady.value) {
    return;
  }
  scheduleVirtualMeasure({ updateGridWidth: true });
});

watch(virtualRows, () => {
  scheduleVirtualMeasure();
});

onMounted(() => {
  nextTick().then(() => {
    setupResizeHandling();
    scheduleVirtualMeasure({ updateGridWidth: true });
  }, logFriendsLocationsError);
});

async function loadInitialSettings() {
  try {
    const [storedScale, storedSpacing, isStoredShowSameInstance, isStoredShowCosmetics] = await Promise.all([
      configRepository.getString("VRCX_FriendLocationCardScale", "1"),
      configRepository.getString("VRCX_FriendLocationCardSpacing", "1"),
      configRepository.getBool("VRCX_FriendLocationShowSameInstance", null),
      configRepository.getBool("VRCX_FriendLocationShowCosmetics", true),
    ]);

    const parsedScale = Number(storedScale);
    if (!Number.isNaN(parsedScale) && parsedScale > 0) {
      cardScale.value = Math.max(0.6, parsedScale);
      cardScaleSlider.value = cardScale.value;
    }

    const parsedSpacing = Number(storedSpacing);
    if (!Number.isNaN(parsedSpacing) && parsedSpacing > 0) {
      cardSpacingBase.value = parsedSpacing;
    }

    if (isStoredShowSameInstance !== null) {
      showSameInstanceBase.value = isStoredShowSameInstance;
    }
    showCosmeticsBase.value = isStoredShowCosmetics;
  } catch (error) {
    console.error("Failed to load Friend Location preferences", error);
  } finally {
    settingsReady.value = true;
    nextTick().then(() => {
      setupResizeHandling();
      scheduleVirtualMeasure({ updateGridWidth: true });
    }, logFriendsLocationsError);
  }
}

onBeforeMount(() => {
  loadInitialSettings().catch(logFriendsLocationsError);
});
</script>

<style scoped>
.friend-view {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 16px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.friend-view.x-container {
  overflow: hidden;
}

.friend-view-toolbar {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 8px 2px 0;
}

.friend-view-tabs {
  gap: 0;
}

.friend-view-toolbar-loading {
  justify-content: flex-end;
  font-size: 0.8125rem;
  font-weight: 500;
}

.friend-view-settings {
  display: grid;
  gap: 12px;
}

.friend-view-loading-text {
  padding-right: 12px;
}

.friend-view-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.friend-view-virtual {
  width: 100%;
  padding: 2px;
  box-sizing: border-box;
  position: relative;
}

.friend-view-virtual-row {
  width: 100%;
  box-sizing: border-box;
  position: absolute;
  left: 0;
  top: 0;
  padding-bottom: calc(var(--friend-card-gap, 14px) - 4px);
}

.friend-view-virtual-row-header {
  padding: 4px 8px;
  padding-bottom: calc(var(--friend-card-gap, 14px) - 4px);
}

.friend-view-virtual-row-divider {
  padding: 16px 4px;
  padding-bottom: calc(var(--friend-card-gap, 14px) - 4px);
}

.friend-view-virtual-row-cards {
  padding: 2px;
  padding-bottom: calc(var(--friend-card-gap, 14px) - 4px);
}

.friend-view-row {
  display: grid;
  grid-template-columns: repeat(var(--friend-grid-columns, 1), minmax(var(--friend-card-min-width, 200px), var(--friend-card-target-width, 1fr)));
  gap: var(--friend-card-gap, 14px);
  justify-content: start;
  padding: 2px;
  box-sizing: border-box;
}

.friend-view-settings-label {
  font-size: 0.8125rem;
  font-weight: 500;
  margin-right: 8px;
}

.friend-view-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.friend-view-scale-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}

.friend-view-scale-value {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 42px;
  text-align: right;
}

.friend-view-slider {
  width: 160px;
  margin-right: 12px;
}

.friend-view-search {
  width: 240px;
  flex: 1;
}

.friend-view-scroll {
  overflow: auto;
  min-height: 0;
  height: 100%;
}

.friend-view-initial-loading {
  display: grid;
  place-items: center;
  min-height: 240px;
}

.friend-view-instance-header {
  display: flex;
  align-items: center;
  padding: 4px 2px;
  font-weight: 600;
  font-size: 0.8125rem;
}

.friend-view-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.friend-view-divider::before,
.friend-view-divider::after {
  content: "";
  flex: 1;
  height: 1px;
}

.friend-view-divider-text {
  flex: none;
}

.friend-view-instance-count {
  font-size: 0.75rem;
}

.friend-view-virtual-row-group-header {
  padding: 2px;
  padding-bottom: calc(var(--friend-card-gap, 14px) - 8px);
}

.friend-view-empty {
  display: grid;
  place-items: center;
  min-height: 240px;
  font-size: 0.9375rem;
  letter-spacing: 0.5px;
}

.friend-view-loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
