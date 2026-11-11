<template>
  <div class="x-container">
    <div class="flex flex-col h-full min-h-0 pb-0">
      <FavoritesToolbar
        v-model:search-query="worldFavoriteSearch"
        v-model:search-mode="worldSearchMode"
        v-model:toolbar-menu-open="worldToolbarMenuOpen"
        v-model:card-scale-value="worldCardScaleValue"
        v-model:card-spacing-value="worldCardSpacingValue"
        :sort-value="worldSortValue"
        :extra-sort-options="worldExtraSortOptions"
        :search-placeholder="worldSearchPlaceholder"
        :search-mode-visible="true"
        :card-scale-percent="worldCardScalePercent"
        :card-scale-slider="worldCardScaleSlider"
        :card-spacing-percent="worldCardSpacingPercent"
        :card-spacing-slider="worldCardSpacingSlider"
        @update:sort-value="handleSortValueChange"
        @search="searchWorldFavorites"
        @import="handleWorldImportClick"
        @export="handleWorldExportClick"
      />
      <ResizablePanelGroup :ref="splitter.splitterGroupRef" direction="horizontal" class="flex-1 min-h-0 favorites-splitter" @layout="handleLayout">
        <ResizablePanel
          :ref="splitter.splitterPanelRef"
          :default-size="splitterDefaultSize"
          :min-size="splitterMinSize"
          :max-size="splitterMaxSize"
          :collapsed-size="0"
          collapsible
          :order="1"
        >
          <FavoritesWorldGroupSidebar
            v-model:new-local-group-name="newLocalGroupName"
            :has-search-input="hasSearchInput"
            :is-group-active="isGroupActive"
            :handle-group-click="handleGroupClick"
            :world-group-placeholders="worldGroupPlaceholders"
            :active-group-menu="activeGroupMenu"
            :remote-group-menu-key="remoteGroupMenuKey"
            :handle-group-menu-visible="handleGroupMenuVisible"
            :handle-visibility-selection="handleVisibilitySelection"
            :handle-remote-rename="handleRemoteRename"
            :handle-remote-clear="handleRemoteClear"
            :handle-refresh-favorites="handleRefreshFavorites"
            :is-refreshing-local-favorites="refreshingLocalFavorites"
            :refresh-local-world-favorites="refreshLocalWorldFavorites"
            :cancel-local-world-refresh="cancelLocalRefresh"
            :local-group-menu-key="localGroupMenuKey"
            :handle-local-rename="handleLocalRename"
            :handle-local-delete="handleLocalDelete"
            :is-creating-local-group="isCreatingLocalGroup"
            :start-local-group-creation="startLocalGroupCreation"
            :new-local-group-input="localGroups.newLocalGroupInput"
            :handle-local-group-creation-confirm="handleLocalGroupCreationConfirm"
            :cancel-local-group-creation="cancelLocalGroupCreation"
          />
        </ResizablePanel>
        <ResizableHandle @dragging="splitterSetDragging" />
        <ResizablePanel :order="2">
          <div class="flex flex-col h-full min-h-0 pl-[26px]">
            <FavoritesContentHeader
              v-model:edit-mode="worldEditMode"
              :edit-mode-disabled="isSearchActive"
              :edit-mode-visible="worldEditMode && !isSearchActive"
              :is-all-selected="isAllWorldsSelected"
              :has-selection="hasWorldSelection"
              @toggle-select-all="toggleSelectAllWorlds"
              @clear-selection="clearSelectedWorlds"
              @copy-selection="copySelectedWorlds"
              @bulk-unfavorite="showWorldBulkUnfavoriteSelectionConfirm"
            >
              <template #title>
                <span v-if="isSearchActive">{{ t("view.favorite.worlds.search") }}</span>
                <template v-else-if="activeRemoteGroup">
                  <span
                    >{{ activeRemoteGroup.displayName }} &nbsp;<small>{{ activeRemoteGroup.count }}/{{ activeRemoteGroup.capacity }}</small></span
                  >
                </template>
                <span v-else-if="activeLocalGroupName">
                  {{ activeLocalGroupName }}
                  <small>{{ activeLocalGroupCount }}</small>
                </span>
                <span v-else>No Group Selected</span>
              </template>
            </FavoritesContentHeader>
            <div :ref="worldCardScaling.containerRef" class="flex-1 min-h-0">
              <template v-if="isSearchActive">
                <div class="h-full pr-2 overflow-auto">
                  <template v-if="worldFavoriteSearchResults.length">
                    <div class="favorites-card-list" :style="worldFavoritesGridStyle(worldFavoriteSearchResults.length)">
                      <FavoritesWorldItem v-for="favorite in worldFavoriteSearchResults" :key="favorite.id" :favorite="favorite" is-local-favorite />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nomatch" />
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-if="activeRemoteGroup && isRemoteGroupSelected" class="h-full pr-2 overflow-auto">
                  <template v-if="currentRemoteFavorites.length">
                    <div class="favorites-card-list" :style="worldFavoritesGridStyle(currentRemoteFavorites.length)">
                      <FavoritesWorldItem
                        v-for="favorite in currentRemoteFavorites"
                        :key="favorite.id"
                        :group="activeRemoteGroup"
                        :favorite="favorite"
                        :edit-mode="worldEditMode"
                        :selected="selectedFavoriteWorlds.includes(favorite.id)"
                        @toggle-select="toggleWorldSelection(favorite.id, $event)"
                      />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
                <div
                  v-else-if="activeLocalGroupName && isLocalGroupSelected"
                  ref="localFavoritesViewportRef"
                  class="h-full pr-2 overflow-x-hidden overflow-y-scroll favorites-content-scroll-local focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
                  data-reka-scroll-area-viewport=""
                  data-slot="scroll-area-viewport"
                  tabindex="0"
                >
                  <template v-if="currentLocalFavorites.length">
                    <div class="favorites-card-virtual" :style="localVirtualContainerStyle">
                      <template v-for="item in localVirtualItems" :key="String(item.virtualItem.key)">
                        <div
                          v-if="item.row"
                          :ref="measureLocalRow"
                          class="favorites-card-virtual-row"
                          :data-index="item.virtualItem.index"
                          :style="{ '--favorites-virtual-start': `${item.virtualItem.start}px` }"
                        >
                          <div class="favorites-card-virtual-row-grid">
                            <FavoritesWorldItem
                              v-for="favorite in getLocalRowItems(item.row)"
                              :key="favorite.key"
                              :group="activeLocalGroupName"
                              :favorite="favorite.favorite"
                              :edit-mode="worldEditMode"
                              is-local-favorite
                            />
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
                <div v-else class="flex items-center justify-center text-[13px] h-full">
                  <DataTableEmpty type="nodata" />
                </div>
              </template>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    <WorldExportDialog v-model:world-export-dialog-visible="worldExportDialogVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFavoriteStore } from "../../stores/favorite";
import { useModalStore } from "../../stores/modal";
import { logFailure } from "../../stores/log-failure";
import ResizableHandle from "../../components/ui/resizable/ResizableHandle.vue";
import ResizablePanel from "../../components/ui/resizable/ResizablePanel.vue";
import ResizablePanelGroup from "../../components/ui/resizable/ResizablePanelGroup.vue";
import { favoriteRequest } from "../../api/favorite";
import { worldRequest } from "../../api/world";
import { debounce } from "../../shared/utils/common";
import { useFavoritesCardScaling } from "./composables/use-favorites-card-scaling.ts";
import { useFavoritesGroupPanel } from "./composables/use-favorites-group-panel.ts";
import { useFavoritesLocalGroups } from "./composables/use-favorites-local-groups.ts";
import { useFavoritesLocalRefresh } from "./composables/use-favorites-local-refresh.ts";
import { useFavoritesLocalVirtualRows } from "./composables/use-favorites-local-virtual-rows.ts";
import { useFavoritesSplitter } from "./composables/use-favorites-splitter.ts";
import { useWorldGroupActions } from "./composables/use-world-group-actions.ts";
import { newLocalWorldFavoriteGroup, refreshFavorites, getLocalWorldFavorites } from "../../coordinators/favorite-coordinator";
import { isWorldSearchEntry, toLocalWorldEntry, toWorldFavoriteEntry } from "./world-favorite-entries";
import type { WorldFavoriteEntry, WorldSearchEntry } from "./world-favorite-entries";

import FavoritesContentHeader from "./components/FavoritesContentHeader.vue";
import FavoritesToolbar from "./components/FavoritesToolbar.vue";
import FavoritesWorldGroupSidebar from "./components/FavoritesWorldGroupSidebar.vue";
import FavoritesWorldItem from "./components/FavoritesWorldItem.vue";
import WorldExportDialog from "./dialogs/WorldExportDialog.vue";

import "./favorites-layout.css";
import "./favorites-world-layout.css";

const WORLD_GROUP_PLACEHOLDERS = Array.from({ length: 4 }, (_, index) => ({
  key: `world:worlds${index + 1}`,
  displayName: `Group ${index + 1}`,
}));

const WORLD_FAVORITES_LOG_LABEL = "World favorites view";

const { t } = useI18n();
const { sortFavorites } = storeToRefs(useAppearanceSettingsStore());
const { setSortFavorites } = useAppearanceSettingsStore();
const favoriteStore = useFavoriteStore();
const modalStore = useModalStore();
const { favoriteWorlds, favoriteWorldGroups, localWorldFavorites, selectedFavoriteWorlds, worldImportDialogInput, localWorldFavoriteGroups } =
  storeToRefs(favoriteStore);
const { showWorldImportDialog, localWorldFavoritesList } = favoriteStore;

const worldCardScaling = useFavoritesCardScaling({
  configKey: "VRCX_FavoritesWorldCardScale",
  spacingConfigKey: "VRCX_FavoritesWorldCardSpacing",
  min: 0.6,
  max: 1,
  step: 0.01,
  spacingMin: 0.5,
  spacingMax: 1.5,
  spacingStep: 0.05,
  basePaddingY: 8,
  basePaddingX: 10,
  baseContentGap: 10,
  baseActionGap: 8,
  baseActionGroupGap: 6,
  baseActionMargin: 8,
  baseCheckboxMargin: 10,
});
const {
  cardScale: worldCardScale,
  cardSpacing: worldCardSpacing,
  slider: worldCardScaleSlider,
  spacingSlider: worldCardSpacingSlider,
  gridStyle: worldFavoritesGridStyle,
  cardScalePercent: worldCardScalePercent,
  cardSpacingPercent: worldCardSpacingPercent,
  cardScaleValue: worldCardScaleValue,
  cardSpacingValue: worldCardSpacingValue,
} = worldCardScaling;

const splitter = useFavoritesSplitter({ configKey: "VRCX_FavoritesWorldSplitter" });
const { defaultSize: splitterDefaultSize, minSize: splitterMinSize, maxSize: splitterMaxSize, handleLayout, setDragging: splitterSetDragging } = splitter;
const worldExportDialogVisible = ref(false);
const worldFavoriteSearch = ref("");
const worldFavoriteSearchResults = ref<WorldSearchEntry[]>([]);
const worldGroupPlaceholders = WORLD_GROUP_PLACEHOLDERS;
const worldEditMode = ref(false);
const worldToolbarMenuOpen = ref(false);
const worldSortMode = ref("none");
const worldSearchMode = ref("name");

const worldSearchPlaceholder = computed(() => (worldSearchMode.value === "tag" ? t("view.favorite.worlds.search_by_tag") : t("view.favorite.worlds.search")));

const worldExtraSortOptions = computed(() => [{ value: "players", label: t("view.settings.appearance.appearance.sort_favorite_by_players") }]);

const worldSortValue = computed(() => {
  if (worldSortMode.value === "players") return "players";
  return sortFavorites.value ? "date" : "name";
});

const {
  activeGroupMenu,
  hasUserSelectedGroup: hasUserSelectedWorldGroup,
  remoteGroupsResolved,
  isRemoteGroupSelected,
  isLocalGroupSelected,
  remoteGroupMenuKey,
  localGroupMenuKey,
  activeRemoteGroup,
  activeLocalGroupName,
  activeLocalGroupCount,
  handleGroupMenuVisible,
  selectGroup,
  isGroupActive,
  ensureSelectedGroup,
} = useFavoritesGroupPanel({
  remoteGroups: favoriteWorldGroups,
  localGroups: localWorldFavoriteGroups,
  localFavorites: localWorldFavorites,
  clearSelection: () => {
    selectedFavoriteWorlds.value = [];
  },
  placeholders: WORLD_GROUP_PLACEHOLDERS,
});

const { handleVisibilitySelection, handleRemoteRename, handleRemoteClear, handleLocalRename, handleLocalDelete } = useWorldGroupActions({
  logLabel: WORLD_FAVORITES_LOG_LABEL,
  handleGroupMenuVisible,
  selectGroup,
  localWorldFavoriteGroups,
  remoteGroupMenuKey,
  localGroupMenuKey,
});

const hasWorldSelection = computed(() => selectedFavoriteWorlds.value.length > 0);
const hasSearchInput = computed(() => worldFavoriteSearch.value.trim().length > 0);
const isSearchActive = computed(() => worldFavoriteSearch.value.trim().length >= 3);

const closeWorldToolbarMenu = () => {
  worldToolbarMenuOpen.value = false;
};

function handleWorldImportClick() {
  closeWorldToolbarMenu();
  showWorldImportDialog();
}

function handleWorldExportClick() {
  closeWorldToolbarMenu();
  showExportDialog();
}

const groupedWorldFavorites = computed(() => {
  const grouped = new Map<string, WorldFavoriteEntry[]>();
  favoriteWorlds.value.forEach((world) => {
    if (!world.groupKey) {
      return;
    }
    const group = grouped.get(world.groupKey) ?? [];
    group.push(toWorldFavoriteEntry(world));
    grouped.set(world.groupKey, group);
  });
  return grouped;
});

const flattenedLocalWorldFavorites = computed(() => {
  return Object.values(localWorldFavorites.value).flat();
});

const searchableWorldEntries = computed(() => {
  const seen = new Set<string>();
  const entries: WorldSearchEntry[] = [];
  const pushIfNew = (candidate: unknown) => {
    if (!isWorldSearchEntry(candidate) || !candidate.id || seen.has(candidate.id)) {
      return;
    }
    seen.add(candidate.id);
    entries.push(candidate);
  };
  flattenedLocalWorldFavorites.value.forEach((entry) => pushIfNew(entry));
  favoriteWorlds.value.forEach((favorite) => {
    pushIfNew(favorite.ref);
  });
  return entries;
});

const currentRemoteFavorites = computed<WorldFavoriteEntry[]>(() => {
  if (!activeRemoteGroup.value) {
    return [];
  }
  const list = groupedWorldFavorites.value.get(activeRemoteGroup.value.key) ?? [];
  if (worldSortMode.value === "players") {
    return list.toSorted((a, b) => (b.ref?.occupants ?? 0) - (a.ref?.occupants ?? 0));
  }
  return list;
});

const currentLocalFavorites = computed<WorldFavoriteEntry[]>(() => {
  if (!activeLocalGroupName.value) {
    return [];
  }
  const list = (localWorldFavorites.value[activeLocalGroupName.value] ?? []).map((entry) => toLocalWorldEntry(entry));
  if (worldSortMode.value === "players") {
    return list.toSorted((a, b) => (b.occupants ?? 0) - (a.occupants ?? 0));
  }
  return list;
});

const localFavoritesViewportRef = ref<HTMLDivElement | null>(null);

const { localVirtualizer, localVirtualItems, localVirtualContainerStyle, getLocalRowItems, measureLocalRow } = useFavoritesLocalVirtualRows({
  items: currentLocalFavorites,
  groupName: activeLocalGroupName,
  getGridStyles: (count, options) => worldFavoritesGridStyle.value(count, options),
  getScrollElement: () => localFavoritesViewportRef.value,
});

function handleSortValueChange(value: string) {
  if (value === "players") {
    worldSortMode.value = "players";
    return;
  }
  worldSortMode.value = "none";
  const isDateSort = value === "date";
  if (isDateSort !== sortFavorites.value) {
    setSortFavorites();
  }
}

const isAllWorldsSelected = computed(() => {
  if (!activeRemoteGroup.value || !currentRemoteFavorites.value.length) {
    return false;
  }
  return currentRemoteFavorites.value.map((fav) => fav.id).every((id) => selectedFavoriteWorlds.value.includes(id));
});

watch(
  () => ({
    remote: favoriteWorldGroups.value.map((group) => group.key),
    local: [...localWorldFavoriteGroups.value],
  }),
  () => {
    remoteGroupsResolved.value = favoriteWorldGroups.value.length > 0;
    if (!hasUserSelectedWorldGroup.value) {
      const preferredKey = favoriteWorldGroups.value[0]?.key ?? worldGroupPlaceholders[0]?.key ?? null;
      if (preferredKey) {
        selectGroup("remote", preferredKey);
      }
    }
    ensureSelectedGroup();
  },
  { immediate: true }
);

watch(isSearchActive, (isActive) => {
  if (isActive && worldEditMode.value) {
    worldEditMode.value = false;
  }
});

watch(worldSearchMode, () => {
  if (isSearchActive.value) {
    doSearchWorldFavorites();
  }
});

watch([currentLocalFavorites, worldCardScale, worldCardSpacing, activeLocalGroupName], () => {
  void nextTick(() => {
    localVirtualizer.value.measure();
  }).catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
});

watch(
  () => worldEditMode.value,
  (isEditMode) => {
    if (!isEditMode) {
      clearSelectedWorlds();
    }
  }
);

function handleGroupClick(type: string, key: string) {
  if (hasSearchInput.value) {
    worldFavoriteSearch.value = "";
    doSearchWorldFavorites("");
  }
  selectGroup(type, key, { userInitiated: true });
}

const localGroups = useFavoritesLocalGroups({
  createGroup: newLocalWorldFavoriteGroup,
  selectGroup,
});
const { isCreatingLocalGroup, newLocalGroupName, startLocalGroupCreation, cancelLocalGroupCreation, handleLocalGroupCreationConfirm } = localGroups;

function toggleWorldSelection(id: string, isChecked: boolean) {
  if (isChecked) {
    if (!selectedFavoriteWorlds.value.includes(id)) {
      selectedFavoriteWorlds.value.push(id);
    }
  } else {
    selectedFavoriteWorlds.value = selectedFavoriteWorlds.value.filter((selectedId) => selectedId !== id);
  }
}

function clearSelectedWorlds() {
  selectedFavoriteWorlds.value = [];
}

function toggleSelectAllWorlds() {
  if (!activeRemoteGroup.value) {
    return;
  }
  if (isAllWorldsSelected.value) {
    selectedFavoriteWorlds.value = [];
  } else {
    selectedFavoriteWorlds.value = currentRemoteFavorites.value.map((fav) => fav.id);
  }
}

function copySelectedWorlds() {
  if (!selectedFavoriteWorlds.value.length) {
    return;
  }
  const idList = selectedFavoriteWorlds.value.map((id) => `${id}\n`).join("");
  worldImportDialogInput.value = idList;
  showWorldImportDialog();
}

function showWorldBulkUnfavoriteSelectionConfirm() {
  if (!selectedFavoriteWorlds.value.length) {
    return;
  }
  const total = selectedFavoriteWorlds.value.length;
  modalStore
    .confirm({
      description: `Are you sure you want to unfavorite ${total} favorites?
                This action cannot be undone.`,
      title: `Delete ${total} favorites?`,
    })
    .then(({ ok }) => {
      if (ok) {
        bulkUnfavoriteSelectedWorlds([...selectedFavoriteWorlds.value]);
      }
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

function bulkUnfavoriteSelectedWorlds(ids: string[]) {
  ids.forEach((id) => {
    void favoriteRequest
      .deleteFavorite({
        objectId: id,
      })
      .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
  });
  selectedFavoriteWorlds.value = [];
  worldEditMode.value = false;
}

function showExportDialog() {
  worldExportDialogVisible.value = true;
}

function handleRefreshFavorites() {
  refreshFavorites();
  void getLocalWorldFavorites().catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

function doSearchWorldFavorites(searchInput?: string) {
  const search = (searchInput ?? worldFavoriteSearch.value).trim().toLowerCase();
  if (search.length < 3) {
    worldFavoriteSearchResults.value = [];
    return;
  }
  const isTagMode = worldSearchMode.value === "tag";
  worldFavoriteSearchResults.value = searchableWorldEntries.value.filter((entry) => {
    if (isTagMode) {
      return (entry.tags ?? []).some((tag) => tag.startsWith("author_tag_") && tag.substring(11).toLowerCase().includes(search));
    }
    const authorName = entry.authorName ?? "";
    return entry.name.toLowerCase().includes(search) || authorName.toLowerCase().includes(search);
  });
}
const searchWorldFavorites = debounce(doSearchWorldFavorites, 200);

const { refreshingLocalFavorites, refreshLocalFavorites, cancelLocalRefresh } = useFavoritesLocalRefresh(async (worldId) => {
  await worldRequest.getWorld({
    worldId,
  });
});

function refreshLocalWorldFavorites() {
  return refreshLocalFavorites(localWorldFavoritesList);
}

onBeforeUnmount(() => {
  cancelLocalRefresh();
});
</script>
