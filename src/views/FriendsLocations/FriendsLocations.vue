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
import { computed, nextTick, onBeforeMount, onMounted, reactive, ref, watch } from "vue";
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
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";

import Popover from "../../components/ui/popover/Popover.vue";
import PopoverContent from "../../components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "../../components/ui/popover/PopoverTrigger.vue";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFavoriteStore } from "../../stores/favorite";
import { useFriendStore } from "../../stores/friend";
import type { FriendContext } from "../../stores/friend-types";
import { useLocationStore } from "../../stores/location";
import Slider from "../../components/ui/slider/Slider.vue";
import Switch from "../../components/ui/switch/Switch.vue";
import { getFriendsLocations } from "../../shared/utils/location.ts";
import { debounce } from "../../shared/utils/common";
import { getFriendsSortFunction } from "../../shared/utils/friend";

import FriendLocationCard from "./components/FriendsLocationsCard.vue";
import { configRepository } from "../../services/config.ts";

type FriendEntry = {
  id: string;
  friend: FriendContext;
  instanceId: string | undefined;
  section?: "same-instance" | "online";
};

type SameInstanceGroup = {
  instanceId: string;
  friends: FriendContext[];
};

type CardItem = {
  key: string;
  friend: FriendContext;
  displayInstanceInfo: boolean;
};

type CardsRow = {
  type: "cards";
  key: string;
  items: CardItem[];
};

type VirtualRow =
  | { type: "header"; key: string; instanceId: string; count: number }
  | { type: "group-header"; key: string; label: string; count: number; groupKey: string; collapsed: boolean }
  | { type: "divider"; key: string }
  | CardsRow;

type GridLayoutOptions = {
  preferredColumns?: number;
  shouldForceStretch?: boolean;
  shouldDisableAutoStretch?: boolean;
  shouldMatchMaxColumnWidth?: boolean;
};

const { t } = useI18n();

const friendStore = useFriendStore();
const { onlineFriends, allFavoriteOnlineFriends, allFavoriteFriendIds, activeFriends, offlineFriends, friendsInSameInstance } = storeToRefs(friendStore);

const appearanceSettingsStore = useAppearanceSettingsStore();
const { isSidebarDivideByFriendGroup, sidebarFavoriteGroups, sidebarFavoriteGroupOrder, sidebarSortMethods } = storeToRefs(appearanceSettingsStore);

const favoriteStore = useFavoriteStore();
const { favoriteFriendGroups, groupedByGroupKeyFavoriteFriends, localFriendFavorites } = storeToRefs(favoriteStore);

const locationStore = useLocationStore();
const { lastLocation } = storeToRefs(locationStore);
const lastLocationSnapshot = computed(() => ({
  location: lastLocation.value.location,
  friendList: new Set(lastLocation.value.friendList.keys()),
}));

const collapsedGroups = reactive(new Set<string>());

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

const normalizedSearchTerm = computed(() => searchTerm.value.trim().toLowerCase());

const toEntries = (list: FriendContext[] | undefined, instanceId?: string): FriendEntry[] =>
  Array.isArray(list)
    ? list.map((friend) => ({
        id: friend.id,
        friend,
        instanceId,
      }))
    : [];

const getFriendIdentity = (friend: FriendContext) => friend.id;

const getEntryIdentity = (entry: FriendEntry) => entry.id;

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

const toLocationEntries = (friends: FriendContext[]) =>
  friends.map((friend) => ({
    id: friend.id,
    ref: friend.ref ?? {},
  }));

const sameInstanceGroups = computed<SameInstanceGroup[]>(() =>
  friendsInSameInstance.value.flatMap((friends, index) => {
    if (friends.length === 0) return [];
    const location = getFriendsLocations(toLocationEntries(friends), lastLocationSnapshot.value);
    const instanceId = location === undefined || location === "" ? `instance-${index + 1}` : location;
    return [{ instanceId, friends }];
  })
);

const sameInstanceEntries = computed(() => sameInstanceGroups.value.flatMap((group) => toEntries(group.friends, group.instanceId)));

const uniqueEntries = (entries: FriendEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.id;
    if (!key) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const displayedVipIds = computed(() => {
  const selectedGroups = sidebarFavoriteGroups.value;
  const hasFilter = selectedGroups.length > 0;
  if (!hasFilter) return allFavoriteFriendIds.value;

  const ids = new Set<string>();
  const remoteFriendsByGroup = groupedByGroupKeyFavoriteFriends.value;
  for (const key of selectedGroups) {
    if (key.startsWith("local:")) {
      const groupName = key.slice(6);
      const userIds = localFriendFavorites.value[groupName];
      if (userIds) {
        for (const id of userIds) ids.add(id);
      }
    } else if (remoteFriendsByGroup[key]) {
      for (const f of remoteFriendsByGroup[key]) ids.add(f.id);
    }
  }
  return ids;
});

const visibleFavoriteOnlineFriends = computed(() => {
  const selectedGroups = sidebarFavoriteGroups.value;
  if (selectedGroups.length === 0) {
    return allFavoriteOnlineFriends.value;
  }
  return allFavoriteOnlineFriends.value.filter((friend) => displayedVipIds.value.has(friend.id));
});

const onlineFriendsByGroupStatus = computed(() => {
  const selectedGroups = sidebarFavoriteGroups.value;
  if (selectedGroups.length === 0) {
    return onlineFriends.value.filter((f) => !allFavoriteFriendIds.value.has(f.id));
  }
  const selectedIds = displayedVipIds.value;
  const nonFavOnline = onlineFriends.value.filter((f) => !selectedIds.has(f.id));
  const existingIds = new Set(nonFavOnline.map((f) => f.id));
  const unselectedGroupFriends = allFavoriteOnlineFriends.value.filter((f) => !selectedIds.has(f.id) && !existingIds.has(f.id));
  return [...nonFavOnline, ...unselectedGroupFriends].sort(getFriendsSortFunction(sidebarSortMethods.value));
});

const vipFriendsDivideByGroup = computed(() => {
  const remoteFriendsByGroup = groupedByGroupKeyFavoriteFriends.value;
  const selectedGroups = sidebarFavoriteGroups.value;
  const hasFilter = selectedGroups.length > 0;

  const groups: { key: string; groupName: string; memberIds: Set<string> }[] = [];
  for (const key in remoteFriendsByGroup) {
    if (Object.hasOwn(remoteFriendsByGroup, key)) {
      if (hasFilter && !selectedGroups.includes(key)) continue;
      const groupName = favoriteFriendGroups.value.find((g) => g.key === key)?.displayName ?? "";
      const memberIds = new Set((remoteFriendsByGroup[key] ?? []).map((f) => f.id));
      groups.push({ key, groupName, memberIds });
    }
  }
  for (const groupName of Object.keys(localFriendFavorites.value)) {
    const selectedKey = `local:${groupName}`;
    if (hasFilter && !selectedGroups.includes(selectedKey)) continue;
    const userIds = localFriendFavorites.value[groupName];
    if (userIds?.length) {
      groups.push({ key: selectedKey, groupName, memberIds: new Set(userIds) });
    }
  }

  const result: { key: string; groupName: string; friends: FriendContext[] }[] = [];
  for (const { key, groupName, memberIds } of groups) {
    const filteredFriends = visibleFavoriteOnlineFriends.value.filter((friend) => memberIds.has(friend.id));
    if (filteredFriends.length > 0) {
      result.push({ key, groupName, friends: filteredFriends });
    }
  }

  const order = sidebarFavoriteGroupOrder.value;
  return result.sort((a, b) => {
    const idxA = order.indexOf(a.key);
    const idxB = order.indexOf(b.key);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.key.localeCompare(b.key);
  });
});

const searchableEntries = computed(() =>
  uniqueEntries([
    ...toEntries(allFavoriteOnlineFriends.value),
    ...toEntries(onlineFriends.value),
    ...toEntries(activeFriends.value),
    ...toEntries(offlineFriends.value),
  ])
);

function toggleGroupCollapse(groupKey: string) {
  if (collapsedGroups.has(groupKey)) {
    collapsedGroups.delete(groupKey);
  } else {
    collapsedGroups.add(groupKey);
  }
}

const filteredFriends = computed<FriendEntry[]>(() => {
  if (normalizedSearchTerm.value) {
    return searchableEntries.value.filter(({ friend }) => friend.name.toLowerCase().includes(normalizedSearchTerm.value));
  }

  switch (activeSegment.value) {
    case "online": {
      if (!showSameInstance.value) {
        const sameEntries = sameInstanceEntries.value.map((entry): FriendEntry => ({
          ...entry,
          section: "same-instance",
        }));

        const seenIds = new Set(sameEntries.map((entry) => entry.id));

        const remainingOnline = toEntries(onlineFriendsByGroupStatus.value)
          .filter((entry) => !entry.id || !seenIds.has(entry.id))
          .map((entry): FriendEntry => ({
            ...entry,
            section: "online",
          }));

        return [...sameEntries, ...remainingOnline];
      }

      return toEntries(onlineFriendsByGroupStatus.value);
    }
    case "favorite":
      return toEntries(visibleFavoriteOnlineFriends.value);
    case "same-instance":
      return sameInstanceEntries.value;
    case "active":
      return toEntries(activeFriends.value);
    case "offline":
      return toEntries(offlineFriends.value);
    default:
      return [];
  }
});

const isSameInstanceView = computed(() => showSameInstance.value && activeSegment.value === "same-instance" && !normalizedSearchTerm.value);

const shouldMergeSameInstance = computed(() => !showSameInstance.value && activeSegment.value === "online" && !normalizedSearchTerm.value);

const displayInstanceInfo = computed(() => activeSegment.value !== "active" && activeSegment.value !== "offline");

const buildSameInstanceGroups = (entries: FriendEntry[]): SameInstanceGroup[] => {
  const grouped = new Map<string, FriendContext[]>();

  for (const entry of entries) {
    const bucketId = entry.instanceId ?? entry.friend.ref?.location;
    if (!bucketId) {
      continue;
    }
    const bucket = grouped.get(bucketId);
    if (bucket) {
      bucket.push(entry.friend);
    } else {
      grouped.set(bucketId, [entry.friend]);
    }
  }

  return sameInstanceGroups.value
    .filter((group) => grouped.has(group.instanceId))
    .map((group) => ({
      instanceId: group.instanceId,
      friends: grouped.get(group.instanceId) ?? [],
    }));
};

const sameInstanceGroupsForVirtual = computed<SameInstanceGroup[]>(() => {
  if (!isSameInstanceView.value) {
    return [];
  }
  return buildSameInstanceGroups(filteredFriends.value);
});

const mergedEntriesBySection = computed(() => {
  const sameInstance: FriendEntry[] = [];
  const online: FriendEntry[] = [];
  if (!shouldMergeSameInstance.value) {
    return { sameInstance, online };
  }

  for (const entry of filteredFriends.value) {
    if (entry.section === "same-instance") {
      sameInstance.push(entry);
    } else {
      online.push(entry);
    }
  }

  return {
    sameInstance,
    online,
  };
});

const mergedSameInstanceEntries = computed(() => {
  return mergedEntriesBySection.value.sameInstance;
});

const mergedOnlineEntries = computed(() => {
  return mergedEntriesBySection.value.online;
});

const mergedSameInstanceGroups = computed<SameInstanceGroup[]>(() => {
  if (!shouldMergeSameInstance.value) {
    return [];
  }
  return buildSameInstanceGroups(mergedSameInstanceEntries.value);
});

const computeGridLayout = (count = 1, options: GridLayoutOptions = {}) => {
  const baseWidth = 220;
  const baseGap = 14;
  const scale = cardScale.value;
  const spacing = cardSpacing.value;
  const minWidth = baseWidth * scale;
  const gap = Math.max(6, (baseGap + (scale - 1) * 10) * spacing);
  const containerWidth = Math.max(gridWidth.value, 0);
  const itemCount = Math.max(count, 0);
  const safeCount = itemCount > 0 ? itemCount : 1;
  const maxColumns = Math.max(1, Math.floor((containerWidth + gap) / (minWidth + gap)) || 1);
  const { preferredColumns, shouldForceStretch = false, shouldDisableAutoStretch = false, shouldMatchMaxColumnWidth = false } = options;
  const requestedColumns = preferredColumns ? Math.max(1, Math.min(Math.round(preferredColumns), maxColumns)) : maxColumns;
  const columns = Math.max(1, Math.min(safeCount, requestedColumns));
  const shouldStretch = !shouldDisableAutoStretch && (shouldForceStretch || itemCount >= maxColumns);

  let cardWidth = minWidth;
  const maxColumnWidth = maxColumns > 0 ? (containerWidth - gap * (maxColumns - 1)) / maxColumns : minWidth;

  if (shouldStretch && columns > 0) {
    const columnsWidth = containerWidth - gap * (columns - 1);
    const rawWidth = columnsWidth > 0 ? columnsWidth / columns : minWidth;

    if (Number.isFinite(rawWidth) && rawWidth > 0) {
      cardWidth = Math.max(minWidth, rawWidth);
    }
  } else if (shouldMatchMaxColumnWidth && Number.isFinite(maxColumnWidth) && maxColumnWidth > 0) {
    cardWidth = Math.max(minWidth, maxColumnWidth);
  }

  return {
    minWidth,
    gap,
    columns,
    cardWidth,
  };
};

const gridStyle = computed(() => {
  return (count = 1, options: GridLayoutOptions = {}) => {
    const { minWidth, gap, cardWidth, columns } = computeGridLayout(count, options);
    return {
      "--friend-card-min-width": `${Math.round(minWidth)}px`,
      "--friend-card-gap": `${Math.round(gap)}px`,
      "--friend-card-target-width": `${Math.round(cardWidth)}px`,
      "--friend-grid-columns": `${columns}`,
      "--friend-card-spacing": cardSpacing.value.toFixed(2),
    };
  };
});

const chunkCardItems = (items: CardItem[], keyPrefix = "row"): CardsRow[] => {
  if (!items.length) {
    return [];
  }
  const { columns } = computeGridLayout(items.length, { shouldMatchMaxColumnWidth: true });
  const safeColumns = Math.max(1, columns);

  const rows: CardsRow[] = [];

  for (let index = 0; index < items.length; index += safeColumns) {
    rows.push({
      type: "cards",
      key: `${keyPrefix}:${index}`,
      items: items.slice(index, index + safeColumns),
    });
  }

  return rows;
};

const isFavoriteDivideByGroup = computed(() => isSidebarDivideByFriendGroup.value && activeSegment.value === "favorite" && !normalizedSearchTerm.value);

const virtualRows = computed(() => {
  const rows: VirtualRow[] = [];

  if (isSameInstanceView.value) {
    for (const group of sameInstanceGroupsForVirtual.value) {
      rows.push({
        type: "header",
        key: `h:${group.instanceId}`,
        instanceId: group.instanceId,
        count: group.friends.length,
      });

      if (group.friends.length) {
        const items = group.friends.map((friend): CardItem => ({
          key: `f:${getFriendIdentity(friend)}`,
          friend,
          displayInstanceInfo: displayInstanceInfo.value,
        }));
        rows.push(...chunkCardItems(items, `g:${group.instanceId}`));
      }
    }

    return rows;
  }

  if (shouldMergeSameInstance.value) {
    for (const group of mergedSameInstanceGroups.value) {
      rows.push({
        type: "header",
        key: `h:${group.instanceId}`,
        instanceId: group.instanceId,
        count: group.friends.length,
      });

      if (group.friends.length) {
        const items = group.friends.map((friend): CardItem => ({
          key: `f:${getFriendIdentity(friend)}`,
          friend,
          displayInstanceInfo: displayInstanceInfo.value,
        }));
        rows.push(...chunkCardItems(items, `mg:${group.instanceId}`));
      }
    }

    if (mergedSameInstanceGroups.value.length && mergedOnlineEntries.value.length) {
      rows.push({ type: "divider", key: "divider:merged" });
    }

    const online = mergedOnlineEntries.value;
    if (online.length) {
      const items = online.map((entry): CardItem => ({
        key: `e:${getEntryIdentity(entry)}`,
        friend: entry.friend,
        displayInstanceInfo: displayInstanceInfo.value,
      }));
      rows.push(...chunkCardItems(items, "o:merged"));
    }

    return rows;
  }

  if (isFavoriteDivideByGroup.value) {
    for (const group of vipFriendsDivideByGroup.value) {
      const isCollapsed = collapsedGroups.has(group.key);
      rows.push({
        type: "group-header",
        key: `gh:${group.key}`,
        label: group.groupName,
        count: group.friends.length,
        groupKey: group.key,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        const items = group.friends.map((friend): CardItem => ({
          key: `fg:${group.key}:${getFriendIdentity(friend)}`,
          friend,
          displayInstanceInfo: displayInstanceInfo.value,
        }));
        rows.push(...chunkCardItems(items, `vg:${group.key}`));
      }
    }
    return rows;
  }

  const entries = filteredFriends.value;
  if (entries.length) {
    const items = entries.map((entry): CardItem => ({
      key: `e:${getEntryIdentity(entry)}`,
      friend: entry.friend,
      displayInstanceInfo: displayInstanceInfo.value,
    }));
    rows.push(...chunkCardItems(items, "r:all"));
  }
  return rows;
});

const virtualListStyle = computed(() => {
  const styleFn = gridStyle.value;
  const total = filteredFriends.value.length;

  return {
    ...styleFn(total, { shouldMatchMaxColumnWidth: true }),
  };
});

const estimateRowSize = (row: VirtualRow | undefined) => {
  if (!row) {
    return 48;
  }
  if (row.type === "header") {
    return 32;
  }
  if (row.type === "group-header") {
    return 40;
  }
  if (row.type === "divider") {
    return 36;
  }

  const itemCount = row.items.length;
  const { columns, gap } = computeGridLayout(itemCount, { shouldMatchMaxColumnWidth: true });
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(itemCount / safeColumns));
  const scale = cardScale.value;
  const spacing = cardSpacing.value;
  const baseCardHeight = 150;
  const cardHeight = baseCardHeight * scale * spacing;
  const rowGap = Math.max(0, gap - 4);

  return rows * cardHeight + (rows - 1) * rowGap + 8;
};

const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualRows.value.length,
    getScrollElement: () => scrollbarRef.value ?? null,
    estimateSize: (index: number) => estimateRowSize(virtualRows.value[index]),
    overscan: 5,
  }))
);

const measureRow = (node: unknown) => {
  if (node instanceof Element) {
    virtualizer.value.measureElement(node);
  }
};

const virtualItems = computed(() =>
  virtualizer.value.getVirtualItems().map((virtualItem) => ({
    virtualItem,
    row: virtualRows.value[virtualItem.index],
  }))
);

const virtualContainerStyle = computed(() => ({
  ...virtualListStyle.value,
  height: `${virtualizer.value.getTotalSize()}px`,
}));

const getRowItems = (row: VirtualRow) => (row.type === "cards" ? row.items : []);
const getRowInstanceId = (row: VirtualRow) => (row.type === "header" ? row.instanceId : "");
const getRowCount = (row: VirtualRow) => (row.type === "header" ? row.count : 0);

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
