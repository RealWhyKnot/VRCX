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
          <div class="h-full pr-2 overflow-auto flex flex-col gap-3">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
                <span>{{ t("view.favorite.worlds.vrchat_favorites") }}</span>
                <TooltipWrapper side="bottom" :content="t('view.favorite.refresh_favorites_tooltip')">
                  <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="isFavoriteLoading"
                    :aria-label="t('view.favorite.refresh_favorites_tooltip')"
                    @click.stop="handleRefreshFavorites"
                  >
                    <Spinner v-if="isFavoriteLoading" />
                    <RefreshCw v-else />
                  </Button>
                </TooltipWrapper>
              </div>
              <div class="flex flex-col gap-2">
                <template v-if="favoriteWorldGroups.length">
                  <div
                    v-for="group in favoriteWorldGroups"
                    :key="group.key"
                    :class="[
                      'group-item x-hover-card hover:shadow-sm',
                      `group-item--${group.visibility}`,
                      { 'is-active': !hasSearchInput && isGroupActive('remote', group.key) },
                    ]"
                    @click="handleGroupClick('remote', group.key)"
                  >
                    <div class="flex items-start justify-between mb-1 text-[13px]">
                      <span class="font-semibold">{{ group.displayName }}</span>
                      <span class="text-xs">{{ group.count }}/{{ group.capacity }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="flex items-center gap-1.5">
                        <span class="text-[11px] text-muted-foreground">{{ t(`view.favorite.visibility.${group.visibility}`) }}</span>
                      </span>
                      <DropdownMenu
                        :open="activeGroupMenu === remoteGroupMenuKey(group.key)"
                        @update:open="handleGroupMenuVisible(remoteGroupMenuKey(group.key), $event)"
                      >
                        <DropdownMenuTrigger as-child>
                          <Button class="rounded-full" variant="ghost" size="icon-sm" :aria-label="t('nav_tooltip.manage')" @click.stop>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" class="w-50">
                          <DropdownMenuItem @click="handleRemoteRename(group)">
                            <span>{{ t("view.favorite.rename_tooltip") }}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <span>{{ t("view.favorite.visibility_tooltip") }}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent side="right" align="start" class="w-[200px]">
                                <DropdownMenuCheckboxItem
                                  v-for="visibility in worldGroupVisibilityOptions"
                                  :key="visibility"
                                  :model-value="group.visibility === visibility"
                                  indicator-position="right"
                                  @select="handleVisibilitySelection(group, visibility)"
                                >
                                  <span>{{ t(`view.favorite.visibility.${visibility}`) }}</span>
                                </DropdownMenuCheckboxItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuItem variant="destructive" @click="handleRemoteClear(group)">
                            <span>{{ t("view.favorite.clear") }}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div
                    v-for="group in worldGroupPlaceholders"
                    :key="group.key"
                    :class="[
                      'group-item x-hover-card hover:shadow-sm',
                      'pointer-events-none opacity-70',
                      { 'is-active': !hasSearchInput && isGroupActive('remote', group.key) },
                    ]"
                  >
                    <div class="flex items-start justify-between mb-1 text-[13px]">
                      <span class="font-semibold">{{ group.displayName }}</span>
                      <span class="text-xs">--/--</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <div class="w-16 h-[18px] rounded-full"></div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
                <span>{{ t("view.favorite.worlds.local_favorites") }}</span>
                <Button
                  v-if="!refreshingLocalFavorites"
                  class="rounded-full"
                  size="icon-sm"
                  variant="ghost"
                  :aria-label="t('common.actions.refresh')"
                  @click.stop="refreshLocalWorldFavorites"
                  ><RefreshCcw
                /></Button>
                <Button v-else size="icon-sm" variant="ghost" @click.stop="cancelLocalWorldRefresh">
                  <RefreshCcw />
                  {{ t("view.favorite.worlds.cancel_refresh") }}
                </Button>
              </div>
              <div class="flex flex-col gap-2">
                <template v-if="localWorldFavoriteGroups.length">
                  <div
                    v-for="group in localWorldFavoriteGroups"
                    :key="group"
                    :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('local', group) }]"
                    @click="handleGroupClick('local', group)"
                  >
                    <div class="flex items-start justify-between mb-1 text-[13px]">
                      <span class="font-semibold">{{ group }}</span>
                      <div class="flex items-center flex-col">
                        <span class="text-xs">{{ localWorldFavGroupLength(group) }}</span>
                        <div class="flex items-center justify-between gap-2">
                          <DropdownMenu
                            :open="activeGroupMenu === localGroupMenuKey(group)"
                            @update:open="handleGroupMenuVisible(localGroupMenuKey(group), $event)"
                          >
                            <DropdownMenuTrigger as-child>
                              <Button class="rounded-full" size="icon-sm" variant="ghost" @click.stop><Ellipsis /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" class="w-50">
                              <DropdownMenuItem @click="handleLocalRename(group)">
                                <span>{{ t("view.favorite.rename_tooltip") }}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" @click="handleLocalDelete(group)">
                                <span>{{ t("view.favorite.delete_tooltip") }}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="text-center text-xs py-3">
                  <DataTableEmpty type="nodata" />
                </div>
                <div
                  v-if="!isCreatingLocalGroup"
                  class="group-item x-hover-card hover:shadow-sm border-dashed flex items-center justify-center gap-2 text-sm"
                  @click="startLocalGroupCreation"
                >
                  <Plus />
                  <span>{{ t("view.favorite.worlds.new_group") }}</span>
                </div>
                <InputGroupField
                  v-else
                  :ref="localGroups.newLocalGroupInput"
                  v-model="newLocalGroupName"
                  size="sm"
                  class="w-full"
                  :placeholder="t('view.favorite.worlds.new_group')"
                  @keyup.enter="handleLocalGroupCreationConfirm"
                  @keyup.esc="cancelLocalGroupCreation"
                  @blur="cancelLocalGroupCreation"
                />
              </div>
            </div>
          </div>
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
                  class="h-full pr-2 overflow-auto favorites-content__scroll--local focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
                  data-reka-scroll-area-viewport=""
                  data-slot="scroll-area-viewport"
                  tabindex="0"
                  style="overflow: hidden scroll"
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
import { Ellipsis, MoreHorizontal, Plus, RefreshCcw, RefreshCw } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";

import DropdownMenu from "../../components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "../../components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "../../components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../components/ui/dropdown-menu/DropdownMenuItem.vue";
import { DropdownMenuPortal } from "reka-ui";
import DropdownMenuSub from "../../components/ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../components/ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../components/ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useFavoriteStore } from "../../stores/favorite";
import { useModalStore } from "../../stores/modal";
import type { FavoriteGroupSlot, FavoriteObjectCtx, LocalFavoriteEntry } from "../../stores/favorite-types";
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
import { useFavoritesSplitter } from "./composables/use-favorites-splitter.ts";
import { renameLocalWorldFavoriteGroup, newLocalWorldFavoriteGroup, refreshFavorites, getLocalWorldFavorites } from "../../coordinators/favorite-coordinator";

import FavoritesContentHeader from "./components/FavoritesContentHeader.vue";
import FavoritesToolbar from "./components/FavoritesToolbar.vue";
import FavoritesWorldItem from "./components/FavoritesWorldItem.vue";
import WorldExportDialog from "./dialogs/WorldExportDialog.vue";

import * as workerTimers from "worker-timers";
import "./favorites-layout.css";
import "./favorites-world-layout.css";

type WorldFavoriteDetails = {
  name?: string | null;
  authorName?: string | null;
  thumbnailImageUrl?: string | null;
  releaseStatus?: string | null;
  occupants?: number | null;
};

type WorldFavoriteEntry = WorldFavoriteDetails & {
  id: string;
  deleted?: boolean;
  ref?: WorldFavoriteDetails | null;
};

type WorldSearchEntry = {
  id: string;
  name: string;
  authorName?: string | null;
  tags?: string[];
};

type LocalVirtualItem = {
  key: string;
  favorite: WorldFavoriteEntry;
};

type LocalVirtualRow = {
  type: string;
  key: string;
  items: LocalVirtualItem[];
};

type RefreshToken = {
  cancelled: boolean;
  resolve: (() => void) | null;
};

const WORLD_GROUP_PLACEHOLDERS = Array.from({ length: 4 }, (_, index) => ({
  key: `world:worlds${index + 1}`,
  displayName: `Group ${index + 1}`,
}));

const WORLD_FAVORITES_LOG_LABEL = "World favorites view";

const worldGroupVisibilityOptions = ["public", "friends", "private"] as const;
type WorldGroupVisibility = (typeof worldGroupVisibilityOptions)[number];

const { t } = useI18n();
const { sortFavorites } = storeToRefs(useAppearanceSettingsStore());
const { setSortFavorites } = useAppearanceSettingsStore();
const favoriteStore = useFavoriteStore();
const modalStore = useModalStore();
const {
  favoriteWorlds,
  favoriteWorldGroups,
  localWorldFavorites,
  selectedFavoriteWorlds,
  worldImportDialogInput,
  isFavoriteLoading,
  localWorldFavoriteGroups,
} = storeToRefs(favoriteStore);
const { showWorldImportDialog, localWorldFavGroupLength, deleteLocalWorldFavoriteGroup, handleFavoriteGroup, localWorldFavoritesList } = favoriteStore;

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
} = worldCardScaling;

const worldCardScalePercent = computed(() => Math.round(worldCardScale.value * 100));
const worldCardSpacingPercent = computed(() => Math.round(worldCardSpacing.value * 100));
const worldCardScaleValue = computed({
  get: () => [worldCardScale.value],
  set: (value: number[]) => {
    const next = value[0];
    if (next !== undefined) {
      worldCardScale.value = next;
    }
  },
});
const worldCardSpacingValue = computed({
  get: () => [worldCardSpacing.value],
  set: (value: number[]) => {
    const next = value[0];
    if (next !== undefined) {
      worldCardSpacing.value = next;
    }
  },
});

const splitter = useFavoritesSplitter({ configKey: "VRCX_FavoritesWorldSplitter" });
const { defaultSize: splitterDefaultSize, minSize: splitterMinSize, maxSize: splitterMaxSize, handleLayout, setDragging: splitterSetDragging } = splitter;
const worldExportDialogVisible = ref(false);
const worldFavoriteSearch = ref("");
const worldFavoriteSearchResults = ref<WorldSearchEntry[]>([]);
const worldGroupPlaceholders = WORLD_GROUP_PLACEHOLDERS;
const refreshingLocalFavorites = ref(false);
const worker = ref<ReturnType<typeof workerTimers.setTimeout> | null>(null);
const refreshCancelToken = ref<RefreshToken | null>(null);
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

function isWorldRecord(value: unknown): value is WorldFavoriteEntry {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function isWorldSearchEntry(value: unknown): value is WorldSearchEntry {
  return typeof value === "object" && value !== null && "id" in value && "name" in value && typeof value.id === "string" && typeof value.name === "string";
}

function toWorldFavoriteEntry(favorite: FavoriteObjectCtx): WorldFavoriteEntry {
  return {
    id: favorite.id,
    name: favorite.name,
    deleted: favorite.deleted ?? false,
    ref: isWorldRecord(favorite.ref) ? favorite.ref : null,
  };
}

function toLocalWorldEntry(entry: LocalFavoriteEntry): WorldFavoriteEntry {
  return isWorldRecord(entry) ? entry : { id: entry.id };
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

const getFavoritesGridMetrics = (count = 1, options: { matchMaxColumnWidth?: boolean } = {}) => {
  const styles = worldFavoritesGridStyle.value(count, options);
  const columns = Math.max(1, Number(styles["--favorites-grid-columns"]) || 1);
  const gap = Number(styles["--favorites-card-gap"].replace("px", "")) || 0;

  return {
    columns,
    gap,
    styles,
  };
};

const chunkLocalFavorites = (favorites: WorldFavoriteEntry[]): LocalVirtualRow[] => {
  if (!favorites.length) {
    return [];
  }
  const { columns } = getFavoritesGridMetrics(favorites.length, { matchMaxColumnWidth: true });
  const safeColumns = Math.max(1, columns);
  const rows: LocalVirtualRow[] = [];

  for (let index = 0; index < favorites.length; index += safeColumns) {
    rows.push({
      type: "cards",
      key: `local:${activeLocalGroupName.value}:${index}`,
      items: favorites.slice(index, index + safeColumns).map((favorite) => ({
        key: favorite.id,
        favorite,
      })),
    });
  }

  return rows;
};

const localVirtualRows = computed(() => chunkLocalFavorites(currentLocalFavorites.value));

const estimateLocalRowSize = (row: LocalVirtualRow | undefined) => {
  if (!row) {
    return 120;
  }
  const itemCount = row.items.length;
  const { columns, gap } = getFavoritesGridMetrics(itemCount, { matchMaxColumnWidth: true });
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(itemCount / safeColumns));
  const baseCardHeight = 220;
  const rowGap = Math.max(0, gap);

  return rows * baseCardHeight + (rows - 1) * rowGap + 8;
};

const localVirtualizer = useVirtualizer(
  computed(() => ({
    count: localVirtualRows.value.length,
    getScrollElement: () => localFavoritesViewportRef.value,
    estimateSize: (index: number) => estimateLocalRowSize(localVirtualRows.value[index]),
    overscan: 8,
  }))
);

const localVirtualItems = computed(() =>
  localVirtualizer.value.getVirtualItems().map((virtualItem) => ({
    virtualItem,
    row: localVirtualRows.value[virtualItem.index],
  }))
);

const localVirtualContainerStyle = computed(() => ({
  ...getFavoritesGridMetrics(currentLocalFavorites.value.length, { matchMaxColumnWidth: true }).styles,
  "--favorites-virtual-height": `${localVirtualizer.value.getTotalSize()}px`,
}));

const getLocalRowItems = (row: LocalVirtualRow | undefined) => row?.items ?? [];

function measureLocalRow(node: unknown) {
  if (node instanceof Element) {
    localVirtualizer.value.measureElement(node);
  }
}

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

function changeWorldGroupVisibility(group: FavoriteGroupSlot, visibility: WorldGroupVisibility, menuKey: string | null = null) {
  const params = {
    type: group.type,
    group: group.name,
    visibility,
  };
  void favoriteRequest
    .saveFavoriteGroup(params)
    .then((args) => {
      handleFavoriteGroup({
        json: args.json,
        params: {
          favoriteGroupId: args.json.id,
        },
      });
      toast.success(t("message.group.visibility_updated"));
      if (menuKey) {
        handleGroupMenuVisible(menuKey, false);
      }
      refreshFavorites();
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

function promptLocalWorldFavoriteGroupRename(group: string) {
  modalStore
    .prompt({
      title: t("prompt.local_favorite_group_rename.header"),
      description: t("prompt.local_favorite_group_rename.description"),
      confirmText: t("prompt.local_favorite_group_rename.save"),
      cancelText: t("prompt.local_favorite_group_rename.cancel"),
      pattern: /\S+/,
      errorMessage: t("prompt.local_favorite_group_rename.input_error"),
      inputValue: group,
    })
    .then(({ ok, value }) => {
      if (!ok) return;
      if (value) {
        renameLocalWorldFavoriteGroup(value, group);
        void nextTick(() => {
          if (localWorldFavoriteGroups.value.includes(value)) {
            selectGroup("local", value, { userInitiated: true });
          }
        }).catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
      }
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

function promptLocalWorldFavoriteGroupDelete(group: string) {
  modalStore
    .confirm({
      description: t("confirm.delete_group", { name: group }),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (ok) {
        deleteLocalWorldFavoriteGroup(group);
      }
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

function clearFavoriteGroup(ctx: FavoriteGroupSlot) {
  modalStore
    .confirm({
      description: t("confirm.clear_group"),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (ok) {
        void favoriteRequest
          .clearFavoriteGroup({
            type: ctx.type,
            group: ctx.name,
          })
          .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
      }
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
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

function handleVisibilitySelection(group: FavoriteGroupSlot, visibility: WorldGroupVisibility) {
  const menuKey = remoteGroupMenuKey(group.key);
  changeWorldGroupVisibility(group, visibility, menuKey);
}

function handleRemoteRename(group: FavoriteGroupSlot) {
  handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
  changeFavoriteGroupName(group);
}

function handleRemoteClear(group: FavoriteGroupSlot) {
  handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
  clearFavoriteGroup(group);
}

function handleLocalRename(groupName: string) {
  handleGroupMenuVisible(localGroupMenuKey(groupName), false);
  promptLocalWorldFavoriteGroupRename(groupName);
}

function handleLocalDelete(groupName: string) {
  handleGroupMenuVisible(localGroupMenuKey(groupName), false);
  promptLocalWorldFavoriteGroupDelete(groupName);
}

function changeFavoriteGroupName(group: FavoriteGroupSlot) {
  const currentName = group.displayName || group.name;
  modalStore
    .prompt({
      title: t("prompt.change_favorite_group_name.header"),
      description: t("prompt.change_favorite_group_name.description"),
      confirmText: t("prompt.change_favorite_group_name.change"),
      cancelText: t("prompt.change_favorite_group_name.cancel"),
      pattern: /\S+/,
      inputValue: currentName,
      errorMessage: t("prompt.change_favorite_group_name.input_error"),
    })
    .then(({ ok, value }) => {
      if (!ok) return;
      const newName = value.trim();
      if (!newName || newName === currentName) {
        return;
      }
      void favoriteRequest
        .saveFavoriteGroup({
          type: group.type,
          group: group.name,
          displayName: newName,
        })
        .then((args) => {
          handleFavoriteGroup({
            json: args.json,
            params: {
              favoriteGroupId: args.json.id,
            },
          });
          toast.success(t("prompt.change_favorite_group_name.message.success"));
          refreshFavorites();
        })
        .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
    })
    .catch(logFailure(WORLD_FAVORITES_LOG_LABEL));
}

async function refreshLocalWorldFavorites() {
  if (refreshingLocalFavorites.value) {
    return;
  }
  refreshingLocalFavorites.value = true;
  const token: RefreshToken = {
    cancelled: false,
    resolve: null,
  };
  refreshCancelToken.value = token;
  const isRefreshCancelled = () => token.cancelled;
  try {
    for (const worldId of localWorldFavoritesList) {
      if (isRefreshCancelled()) {
        break;
      }
      try {
        await worldRequest.getWorld({
          worldId,
        });
      } catch (err) {
        console.error(err);
      }
      if (isRefreshCancelled()) {
        break;
      }
      await new Promise<void>((resolve) => {
        token.resolve = resolve;
        worker.value = workerTimers.setTimeout(() => {
          worker.value = null;
          resolve();
        }, 1000);
      });
    }
  } finally {
    if (worker.value) {
      workerTimers.clearTimeout(worker.value);
      worker.value = null;
    }
    if (refreshCancelToken.value === token) {
      refreshCancelToken.value = null;
    }
    refreshingLocalFavorites.value = false;
  }
}

function cancelLocalWorldRefresh() {
  if (!refreshingLocalFavorites.value) {
    return;
  }
  if (refreshCancelToken.value) {
    refreshCancelToken.value.cancelled = true;
    refreshCancelToken.value.resolve?.();
  }
  if (worker.value) {
    workerTimers.clearTimeout(worker.value);
    worker.value = null;
  }
  refreshingLocalFavorites.value = false;
}

onBeforeUnmount(() => {
  cancelLocalWorldRefresh();
});
</script>
