<template>
  <div class="x-container">
    <div class="flex flex-col h-full min-h-0 pb-0">
      <FavoritesToolbar
        v-model:search-query="avatarFavoriteSearch"
        v-model:toolbar-menu-open="avatarToolbarMenuOpen"
        v-model:card-scale-value="avatarCardScaleValue"
        v-model:card-spacing-value="avatarCardSpacingValue"
        :sort-value="sortFavorites ? 'date' : 'name'"
        :search-placeholder="t('view.favorite.avatars.search')"
        :card-scale-percent="avatarCardScalePercent"
        :card-scale-slider="avatarCardScaleSlider"
        :card-spacing-percent="avatarCardSpacingPercent"
        :card-spacing-slider="avatarCardSpacingSlider"
        @update:sort-value="handleSortFavoritesChange"
        @search="searchAvatarFavorites"
        @import="handleAvatarImportClick"
        @export="handleAvatarExportClick"
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
                <span>{{ t("view.favorite.avatars.vrchat_favorites") }}</span>
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
                <template v-if="favoriteAvatarGroups.length">
                  <div
                    v-for="group in favoriteAvatarGroups"
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
                        <DropdownMenuContent side="right" class="w-55">
                          <DropdownMenuItem @click="handleRemoteRename(group)">
                            <span>{{ t("view.favorite.rename_tooltip") }}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <span>{{ t("view.favorite.visibility_tooltip") }}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent side="right" align="start" class="w-45">
                                <DropdownMenuCheckboxItem
                                  v-for="visibility in avatarGroupVisibilityOptions"
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
                    v-for="group in avatarGroupPlaceholders"
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
                <template v-if="!refreshingLocalFavorites">
                  <Button class="rounded-full" size="icon" variant="ghost" :aria-label="t('common.actions.refresh')" @click.stop="refreshLocalAvatarFavorites"
                    ><RefreshCcw
                  /></Button>
                </template>
                <Button v-else size="sm" variant="ghost" @click.stop="cancelLocalAvatarRefresh">
                  <Loader />

                  {{ t("view.favorite.avatars.cancel_refresh") }}
                </Button>
              </div>
              <div class="flex flex-col gap-2">
                <template v-if="localAvatarFavoriteGroups.length">
                  <div
                    v-for="group in localAvatarFavoriteGroups"
                    :key="group"
                    :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('local', group) }]"
                    @click="handleGroupClick('local', group)"
                  >
                    <div class="flex items-start justify-between mb-1 text-[13px]">
                      <span class="font-semibold">{{ group }}</span>
                      <div class="flex items-center flex-col">
                        <span class="text-xs">{{ localAvatarFavGroupLength(group) }}</span>
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
                            <DropdownMenuItem @click="handleCheckInvalidAvatars(group)">
                              <span>{{ t("view.favorite.avatars.check_invalid") }}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" @click="handleLocalDelete(group)">
                              <span>{{ t("view.favorite.delete_tooltip") }}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="text-center text-xs py-3">
                  <DataTableEmpty type="nodata" />
                </div>
                <TooltipWrapper v-if="!isCreatingLocalGroup" :content="t('view.favorite.worlds.local_favorites')">
                  <div
                    :class="['group-item x-hover-card hover:shadow-sm', 'border-dashed flex items-center justify-center gap-2 text-sm']"
                    @click="startLocalGroupCreation"
                  >
                    <Plus />
                    <span>{{ t("view.favorite.avatars.new_group") }}</span>
                  </div>
                </TooltipWrapper>
                <InputGroupField
                  v-else
                  :ref="localGroups.newLocalGroupInput"
                  v-model="newLocalGroupName"
                  size="sm"
                  class="w-full"
                  :placeholder="t('view.favorite.avatars.new_group')"
                  @keyup.enter="handleLocalGroupCreationConfirm"
                  @keyup.esc="cancelLocalGroupCreation"
                  @blur="cancelLocalGroupCreation"
                />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
                <span>{{ t("view.favorite.avatars.local_history") }}</span>
                <DropdownMenu :open="activeGroupMenu === historyGroupMenuKey" @update:open="handleGroupMenuVisible(historyGroupMenuKey, $event)">
                  <DropdownMenuTrigger as-child>
                    <Button class="rounded-full" size="icon-sm" variant="ghost" @click.stop><Ellipsis /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" class="w-45">
                    <DropdownMenuItem variant="destructive" @click="handleHistoryClear">
                      <span>{{ t("view.favorite.clear_tooltip") }}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div class="flex flex-col gap-2">
                <div
                  :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('history', historyGroupKey) }]"
                  @click="handleGroupClick('history', historyGroupKey)"
                >
                  <div class="flex items-start justify-between mb-1 text-[13px]">
                    <span class="font-semibold">{{ t("view.favorite.avatars.local_history") }}</span>
                    <span class="text-xs">{{ avatarHistory.length }}/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle @dragging="splitterSetDragging" />
        <ResizablePanel :order="2">
          <div class="flex flex-col h-full min-h-0 pl-[26px]">
            <FavoritesContentHeader
              v-model:edit-mode="avatarEditMode"
              :edit-mode-disabled="isSearchActive || !activeRemoteGroup"
              :edit-mode-visible="avatarEditMode && !isSearchActive && activeRemoteGroup !== null"
              :is-all-selected="isAllAvatarsSelected"
              :has-selection="hasAvatarSelection"
              @toggle-select-all="toggleSelectAllAvatars"
              @clear-selection="clearSelectedAvatars"
              @copy-selection="copySelectedAvatars"
              @bulk-unfavorite="showAvatarBulkUnfavoriteSelectionConfirm"
            >
              <template #title>
                <span v-if="isSearchActive">{{ t("view.favorite.avatars.search") }}</span>
                <template v-else-if="activeRemoteGroup">
                  <span>
                    {{ activeRemoteGroup.displayName }}
                    <small>{{ activeRemoteGroup.count }}/{{ activeRemoteGroup.capacity }}</small>
                  </span>
                </template>
                <template v-else-if="activeLocalGroupName">
                  <span>
                    {{ activeLocalGroupName }}
                    <small>{{ activeLocalGroupCount }}</small>
                  </span>
                </template>
                <template v-else-if="isHistorySelected">
                  <span>
                    Local History
                    <small>{{ avatarHistory.length }}/100</small>
                  </span>
                </template>
                <span v-else>{{ t("view.favorite.avatars.no_group_selected") }}</span>
              </template>
            </FavoritesContentHeader>
            <div :ref="avatarCardScaling.containerRef" class="flex-1 min-h-0">
              <template v-if="isSearchActive">
                <div class="favorites-content__scroll favorites-content__scroll--native h-full overflow-auto">
                  <div
                    v-if="avatarFavoriteSearchResults.length"
                    class="favorites-search-grid"
                    :style="avatarFavoritesGridStyle(avatarFavoriteSearchResults.length)"
                  >
                    <div
                      v-for="favorite in avatarFavoriteSearchResults"
                      :key="favorite.id"
                      class="favorites-search-card x-hover-card hover:shadow-sm"
                      @click="showAvatarDialog(favorite.id)"
                    >
                      <div class="favorites-search-card__content">
                        <div class="favorites-search-card__avatar" :class="{ 'is-empty': !favorite.thumbnailImageUrl }">
                          <img v-if="favorite.thumbnailImageUrl" :src="favorite.thumbnailImageUrl" loading="lazy" />
                        </div>
                        <div class="favorites-search-card__detail">
                          <div class="flex items-center gap-2">
                            <span class="name truncate">{{ favorite.name }}</span>
                          </div>
                          <span class="text-xs">{{ favorite.authorName }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="favorites-empty">
                    <DataTableEmpty type="nomatch" />
                  </div>
                </div>
              </template>
              <template v-else-if="activeRemoteGroup">
                <div class="h-full pr-2 overflow-auto">
                  <template v-if="currentRemoteFavorites.length">
                    <div class="favorites-card-list" :style="avatarFavoritesGridStyle(currentRemoteFavorites.length)">
                      <FavoritesAvatarItem
                        v-for="favorite in currentRemoteFavorites"
                        :key="favorite.id"
                        :favorite="favorite"
                        :group="activeRemoteGroup"
                        :selected="selectedFavoriteAvatars.includes(favorite.id)"
                        :edit-mode="avatarEditMode"
                        @toggle-select="toggleAvatarSelection(favorite.id, $event)"
                      />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
              </template>
              <template v-else-if="!remoteAvatarGroupsResolved">
                <div class="h-full pr-2 overflow-auto">
                  <div class="favorites-card-list" :style="avatarFavoritesGridStyle(avatarGroupPlaceholders.length)">
                    <div v-for="group in avatarGroupPlaceholders" :key="group.key" class="favorites-card-placeholder-box"></div>
                  </div>
                </div>
              </template>
              <template v-else-if="activeLocalGroupName">
                <ScrollArea class="h-full pr-2">
                  <template v-if="currentLocalFavorites.length">
                    <div class="favorites-card-list" :style="avatarFavoritesGridStyle(currentLocalFavorites.length)">
                      <FavoritesAvatarItem
                        v-for="favorite in currentLocalFavorites"
                        :key="favorite.id"
                        :favorite="favorite"
                        :group="activeLocalGroupName"
                        is-local-favorite
                        :edit-mode="avatarEditMode"
                      />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </ScrollArea>
              </template>
              <template v-else-if="isHistorySelected">
                <div class="h-full pr-2 overflow-auto">
                  <template v-if="avatarHistory.length">
                    <div class="favorites-card-list" :style="avatarFavoritesGridStyle(avatarHistory.length)">
                      <FavoritesAvatarLocalHistoryItem v-for="(favorite, index) in avatarHistory" :key="favorite.id ?? index" :favorite="favorite" />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-center text-[13px] h-full">
                  {{ t("view.favorite.avatars.no_group_selected") }}
                </div>
              </template>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    <AvatarExportDialog v-model:avatar-export-dialog-visible="avatarExportDialogVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { Ellipsis, Loader, MoreHorizontal, Plus, RefreshCcw, RefreshCw } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

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
import { useAvatarStore } from "../../stores/avatar";
import { useFavoriteStore } from "../../stores/favorite";
import { useModalStore } from "../../stores/modal";
import type { FavoriteGroupSlot, FavoriteObjectCtx } from "../../stores/favorite-types";
import { logFailure } from "../../stores/log-failure";
import ResizableHandle from "../../components/ui/resizable/ResizableHandle.vue";
import ResizablePanel from "../../components/ui/resizable/ResizablePanel.vue";
import ResizablePanelGroup from "../../components/ui/resizable/ResizablePanelGroup.vue";
import { avatarRequest } from "../../api/avatar";
import { favoriteRequest } from "../../api/favorite";
import { debounce } from "../../shared/utils/common";
import { promptClearAvatarHistory, showAvatarDialog, applyAvatar } from "../../coordinators/avatar-coordinator";
import { useFavoritesCardScaling } from "./composables/use-favorites-card-scaling.ts";
import { useFavoritesGroupPanel } from "./composables/use-favorites-group-panel.ts";
import { useFavoritesLocalGroups } from "./composables/use-favorites-local-groups.ts";
import { useFavoritesSplitter } from "./composables/use-favorites-splitter.ts";
import {
  deleteLocalAvatarFavoriteGroup,
  renameLocalAvatarFavoriteGroup,
  newLocalAvatarFavoriteGroup,
  refreshFavorites,
  getLocalAvatarFavorites,
  checkInvalidLocalAvatars,
  removeInvalidLocalAvatars,
} from "../../coordinators/favorite-coordinator";

import AvatarExportDialog from "./dialogs/AvatarExportDialog.vue";
import FavoritesAvatarItem from "./components/FavoritesAvatarItem.vue";
import FavoritesAvatarLocalHistoryItem from "./components/FavoritesAvatarLocalHistoryItem.vue";
import FavoritesContentHeader from "./components/FavoritesContentHeader.vue";
import FavoritesToolbar from "./components/FavoritesToolbar.vue";
import { InvalidAvatarsProgressToast } from "./components/invalid-avatars-progress-toast.tsx";

import * as workerTimers from "worker-timers";
import "./favorites-layout.css";

type AvatarFavoriteDetails = {
  id: string;
  name?: string | null;
  authorName?: string | null;
  thumbnailImageUrl?: string | null;
  releaseStatus?: string | null;
};

type AvatarFavoriteEntry = {
  id: string;
  name?: string | null;
  deleted?: boolean;
  ref?: AvatarFavoriteDetails | null;
};

type AvatarSearchEntry = {
  id: string;
  name: string;
  authorName: string;
  thumbnailImageUrl?: string | null | undefined;
};

type RefreshToken = {
  cancelled: boolean;
  resolve: (() => void) | null;
};

const AVATAR_GROUP_PLACEHOLDERS = Array.from({ length: 5 }, (_, index) => ({
  key: `avatar:avatars${index + 1}`,
  displayName: `Group ${index + 1}`,
}));

const AVATAR_FAVORITES_LOG_LABEL = "Avatar favorites view";

const avatarGroupVisibilityOptions = ["public", "friends", "private"] as const;
type AvatarGroupVisibility = (typeof avatarGroupVisibilityOptions)[number];
const historyGroupKey = "local-history";
const splitter = useFavoritesSplitter({ configKey: "VRCX_FavoritesAvatarSplitter" });
const { defaultSize: splitterDefaultSize, minSize: splitterMinSize, maxSize: splitterMaxSize, handleLayout, setDragging: splitterSetDragging } = splitter;

const { sortFavorites } = storeToRefs(useAppearanceSettingsStore());
const { setSortFavorites } = useAppearanceSettingsStore();
const favoriteStore = useFavoriteStore();
const modalStore = useModalStore();
const {
  favoriteAvatars,
  favoriteAvatarGroups,
  localAvatarFavorites,
  selectedFavoriteAvatars,
  isFavoriteLoading,
  localAvatarFavoriteGroups,
  avatarImportDialogInput,
} = storeToRefs(favoriteStore);
const { showAvatarImportDialog, localAvatarFavGroupLength, localAvatarFavoritesList, handleFavoriteGroup } = favoriteStore;
const { avatarHistory } = storeToRefs(useAvatarStore());
const { t } = useI18n();

const avatarCardScaling = useFavoritesCardScaling({
  configKey: "VRCX_FavoritesAvatarCardScale",
  spacingConfigKey: "VRCX_FavoritesAvatarCardSpacing",
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
  cardScale: avatarCardScale,
  cardSpacing: avatarCardSpacing,
  slider: avatarCardScaleSlider,
  spacingSlider: avatarCardSpacingSlider,
  gridStyle: avatarFavoritesGridStyle,
} = avatarCardScaling;

const avatarCardScalePercent = computed(() => Math.round(avatarCardScale.value * 100));
const avatarCardSpacingPercent = computed(() => Math.round(avatarCardSpacing.value * 100));
const avatarCardScaleValue = computed({
  get: () => [avatarCardScale.value],
  set: (value: number[]) => {
    const next = value[0];
    if (next !== undefined) {
      avatarCardScale.value = next;
    }
  },
});
const avatarCardSpacingValue = computed({
  get: () => [avatarCardSpacing.value],
  set: (value: number[]) => {
    const next = value[0];
    if (next !== undefined) {
      avatarCardSpacing.value = next;
    }
  },
});

const avatarExportDialogVisible = ref(false);
const avatarFavoriteSearch = ref("");
const avatarFavoriteSearchResults = ref<AvatarSearchEntry[]>([]);
const avatarEditMode = ref(false);
const avatarToolbarMenuOpen = ref(false);
const refreshingLocalFavorites = ref(false);
const worker = ref<ReturnType<typeof workerTimers.setTimeout> | null>(null);
const refreshCancelToken = ref<RefreshToken | null>(null);
const avatarGroupPlaceholders = AVATAR_GROUP_PLACEHOLDERS;

const {
  activeGroupMenu,
  hasUserSelectedGroup: hasUserSelectedAvatarGroup,
  remoteGroupsResolved: remoteAvatarGroupsResolved,

  isHistorySelected,
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
  remoteGroups: favoriteAvatarGroups,
  localGroups: localAvatarFavoriteGroups,
  localFavorites: localAvatarFavorites,
  clearSelection: () => {
    selectedFavoriteAvatars.value = [];
  },
  placeholders: AVATAR_GROUP_PLACEHOLDERS,
  hasHistory: true,
  historyItems: avatarHistory,
});

const historyGroupMenuKey = "history";

function isAvatarFavoriteDetails(value: unknown): value is AvatarFavoriteDetails {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function isAvatarSearchEntry(value: unknown): value is AvatarSearchEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "authorName" in value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.authorName === "string"
  );
}

function toAvatarFavoriteEntry(favorite: FavoriteObjectCtx): AvatarFavoriteEntry {
  return {
    id: favorite.id,
    name: favorite.name,
    deleted: favorite.deleted ?? false,
    ref: isAvatarFavoriteDetails(favorite.ref) ? favorite.ref : null,
  };
}

function handleSortFavoritesChange(value: string) {
  const isDateSort = value === "date";
  if (isDateSort !== sortFavorites.value) {
    setSortFavorites();
  }
}

const hasAvatarSelection = computed(() => selectedFavoriteAvatars.value.length > 0);
const hasSearchInput = computed(() => avatarFavoriteSearch.value.trim().length > 0);
const isSearchActive = computed(() => avatarFavoriteSearch.value.trim().length >= 3);

const closeAvatarToolbarMenu = () => {
  avatarToolbarMenuOpen.value = false;
};

function handleAvatarImportClick() {
  closeAvatarToolbarMenu();
  showAvatarImportDialog();
}

function handleAvatarExportClick() {
  closeAvatarToolbarMenu();
  showAvatarExportDialog();
}

const groupedAvatarFavorites = computed(() => {
  const grouped = new Map<string, AvatarFavoriteEntry[]>();
  favoriteAvatars.value.forEach((avatar) => {
    if (!avatar.groupKey) {
      return;
    }
    const group = grouped.get(avatar.groupKey) ?? [];
    group.push(toAvatarFavoriteEntry(avatar));
    grouped.set(avatar.groupKey, group);
  });
  return grouped;
});

const currentRemoteFavorites = computed<AvatarFavoriteEntry[]>(() => {
  if (!activeRemoteGroup.value) {
    return [];
  }
  return groupedAvatarFavorites.value.get(activeRemoteGroup.value.key) ?? [];
});

const currentLocalFavorites = computed<AvatarFavoriteEntry[]>(() => {
  if (!activeLocalGroupName.value) {
    return [];
  }
  return localAvatarFavorites.value[activeLocalGroupName.value] ?? [];
});

const isAllAvatarsSelected = computed(() => {
  if (!activeRemoteGroup.value || !currentRemoteFavorites.value.length) {
    return false;
  }
  return currentRemoteFavorites.value.map((fav) => fav.id).every((id) => selectedFavoriteAvatars.value.includes(id));
});

watch(
  () => ({
    remote: favoriteAvatarGroups.value.map((group) => group.key),
    local: [...localAvatarFavoriteGroups.value],
    history: avatarHistory.value.length,
  }),
  () => {
    remoteAvatarGroupsResolved.value = favoriteAvatarGroups.value.length > 0;
    if (!hasUserSelectedAvatarGroup.value) {
      const preferred = favoriteAvatarGroups.value.find((group) => group.count > 0) ?? favoriteAvatarGroups.value[0] ?? avatarGroupPlaceholders[0];
      if (preferred) {
        selectGroup("remote", preferred.key);
      }
    }
    ensureSelectedGroup();
  },
  { immediate: true }
);

watch(isSearchActive, (isActive) => {
  if (isActive && avatarEditMode.value) {
    avatarEditMode.value = false;
  }
});

watch(
  () => avatarEditMode.value,
  (isEditMode) => {
    if (!isEditMode) {
      clearSelectedAvatars();
    }
  }
);

function handleGroupClick(type: string, key: string) {
  if (hasSearchInput.value) {
    avatarFavoriteSearch.value = "";
    doSearchAvatarFavorites("");
  }
  selectGroup(type, key, { userInitiated: true });
}

const localGroups = useFavoritesLocalGroups({
  createGroup: newLocalAvatarFavoriteGroup,
  selectGroup,
});
const { isCreatingLocalGroup, newLocalGroupName, startLocalGroupCreation, cancelLocalGroupCreation, handleLocalGroupCreationConfirm } = localGroups;

function toggleAvatarSelection(id: string, isChecked: boolean) {
  if (isChecked) {
    if (!selectedFavoriteAvatars.value.includes(id)) {
      selectedFavoriteAvatars.value.push(id);
    }
  } else {
    selectedFavoriteAvatars.value = selectedFavoriteAvatars.value.filter((selectedId) => selectedId !== id);
  }
}

function clearSelectedAvatars() {
  selectedFavoriteAvatars.value = [];
}

function showAvatarExportDialog() {
  avatarExportDialogVisible.value = true;
}

function handleRefreshFavorites() {
  refreshFavorites();
  void getLocalAvatarFavorites().catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function handleVisibilitySelection(group: FavoriteGroupSlot, visibility: AvatarGroupVisibility) {
  const menuKey = remoteGroupMenuKey(group.key);
  changeAvatarGroupVisibility(group.name, visibility, menuKey);
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
  promptLocalAvatarFavoriteGroupRename(groupName);
}

function handleLocalDelete(groupName: string) {
  handleGroupMenuVisible(localGroupMenuKey(groupName), false);
  promptLocalAvatarFavoriteGroupDelete(groupName);
}

async function handleCheckInvalidAvatars(groupName: string) {
  handleGroupMenuVisible(localGroupMenuKey(groupName), false);

  const startCheckResult = await modalStore.confirm({
    description: t("view.favorite.avatars.check_description"),
    title: t("view.favorite.avatars.check_invalid"),
    confirmText: t("confirm.confirm_button"),
    cancelText: t("confirm.cancel_button"),
  });

  if (!startCheckResult.ok) {
    return;
  }

  const progressState = reactive({
    current: 0,
    total: 0,
    percentage: 0,
  });

  let progressToastId: string | number | undefined;

  try {
    progressToastId = toast(markRaw(InvalidAvatarsProgressToast), {
      duration: Infinity,
      componentProps: {
        t,
        progress: progressState,
        onDismiss: () => {
          if (progressToastId) {
            toast.dismiss(progressToastId);
          }
        },
      },
    });

    const result = await checkInvalidLocalAvatars(groupName, (current, total) => {
      progressState.current = current;
      progressState.total = total;
      progressState.percentage = total ? Math.floor((current / total) * 100) : 0;
    });

    if (progressToastId) {
      toast.dismiss(progressToastId);
    }

    if (result.invalid === 0) {
      toast.success(t("view.favorite.avatars.no_invalid_found"));
      return;
    }

    const invalidIdsText = result.invalidIds.join("\n");

    const confirmDeleteResult = await modalStore.confirm({
      description:
        t("view.favorite.avatars.confirm_delete_description", { count: result.invalid }) +
        `\n\n${t("view.favorite.avatars.removed_list_header")}\n` +
        invalidIdsText,
      title: t("view.favorite.avatars.confirm_delete_invalid"),
      confirmText: t("confirm.confirm_button"),
      cancelText: t("view.favorite.avatars.copy_removed_ids"),
      destructive: true,
    });

    if (!confirmDeleteResult.ok) {
      if (confirmDeleteResult.reason === "cancel") {
        navigator.clipboard
          .writeText(invalidIdsText)
          .then(() => {
            toast.success(t("view.favorite.avatars.copied_ids"));
          })
          .catch(() => {
            toast.error(t("view.favorite.avatars.copy_failed"));
          });
      }
      toast.info(t("view.favorite.avatars.delete_cancelled"));
      return;
    }

    const removeResult = await removeInvalidLocalAvatars(result.invalidIds, groupName);

    toast.success(
      t("view.favorite.avatars.delete_summary", {
        removed: removeResult.removed,
      })
    );
  } catch (err) {
    if (progressToastId) {
      toast.dismiss(progressToastId);
    }
    console.error(err);
    toast.error(err instanceof Error && err.message ? err.message : String(err));
  }
}

function handleHistoryClear() {
  handleGroupMenuVisible(historyGroupMenuKey, false);
  promptClearAvatarHistory();
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
          type: "avatar",
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
        .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function changeAvatarGroupVisibility(name: string, visibility: AvatarGroupVisibility, menuKey: string | null = null) {
  const params = {
    type: "avatar",
    group: name,
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
      toast.success("Group visibility changed");
      if (menuKey) {
        handleGroupMenuVisible(menuKey, false);
      }
      refreshFavorites();
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function clearFavoriteGroup(ctx: FavoriteGroupSlot) {
  modalStore
    .confirm({
      description: t("confirm.clear_group"),
      title: t("confirm.title"),
      destructive: true,
    })
    .then(({ ok }) => {
      if (ok) {
        void favoriteRequest
          .clearFavoriteGroup({
            type: ctx.type,
            group: ctx.name,
          })
          .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
      }
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function promptLocalAvatarFavoriteGroupRename(group: string) {
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
        renameLocalAvatarFavoriteGroup(value, group);
        void nextTick(() => {
          if (localAvatarFavoriteGroups.value.includes(value)) {
            selectGroup("local", value);
          }
        }).catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
      }
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function promptLocalAvatarFavoriteGroupDelete(group: string) {
  modalStore
    .confirm({
      description: t("confirm.delete_group", { name: group }),
      title: t("confirm.title"),
      destructive: true,
    })
    .then(({ ok }) => {
      if (ok) {
        deleteLocalAvatarFavoriteGroup(group);
      }
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function doSearchAvatarFavorites(searchTerm?: string) {
  if (typeof searchTerm === "string") {
    avatarFavoriteSearch.value = searchTerm;
  }
  const search = avatarFavoriteSearch.value.trim().toLowerCase();
  if (search.length < 3) {
    avatarFavoriteSearchResults.value = [];
    return;
  }
  const results: AvatarSearchEntry[] = [];
  const seen = new Set<string>();
  const addMatch = (candidate: unknown) => {
    if (!isAvatarSearchEntry(candidate) || seen.has(candidate.id)) {
      return;
    }
    if (candidate.name.toLowerCase().includes(search) || candidate.authorName.toLowerCase().includes(search)) {
      seen.add(candidate.id);
      results.push(candidate);
    }
  };
  localAvatarFavoriteGroups.value.forEach((group) => {
    (localAvatarFavorites.value[group] ?? []).forEach((entry) => addMatch(entry));
  });
  favoriteAvatars.value.forEach((favorite) => addMatch(favorite.ref));
  avatarFavoriteSearchResults.value = results;
}
const searchAvatarFavorites = debounce(doSearchAvatarFavorites, 200);

async function refreshLocalAvatarFavorites() {
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
    for (const avatarId of localAvatarFavoritesList) {
      if (isRefreshCancelled()) {
        break;
      }
      try {
        const args = await avatarRequest.getAvatar({
          avatarId,
        });
        applyAvatar(args.json);
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

function cancelLocalAvatarRefresh() {
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

function toggleSelectAllAvatars() {
  if (!activeRemoteGroup.value) {
    return;
  }
  if (isAllAvatarsSelected.value) {
    selectedFavoriteAvatars.value = [];
  } else {
    selectedFavoriteAvatars.value = currentRemoteFavorites.value.map((fav) => fav.id);
  }
}

function copySelectedAvatars() {
  if (!selectedFavoriteAvatars.value.length) {
    return;
  }
  const idList = selectedFavoriteAvatars.value.map((id) => `${id}\n`).join("");
  avatarImportDialogInput.value = idList;
  showAvatarImportDialog();
}

function showAvatarBulkUnfavoriteSelectionConfirm() {
  if (!selectedFavoriteAvatars.value.length) {
    return;
  }
  const total = selectedFavoriteAvatars.value.length;
  modalStore
    .confirm({
      description: t("confirm.bulk_unfavorite", { count: total }),
      title: t("confirm.bulk_unfavorite_title", { count: total }),
      destructive: true,
    })
    .then(({ ok }) => {
      if (ok) {
        bulkUnfavoriteSelectedAvatars(selectedFavoriteAvatars.value);
      }
    })
    .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
}

function bulkUnfavoriteSelectedAvatars(ids: string[]) {
  ids.forEach((id) => {
    void favoriteRequest
      .deleteFavorite({
        objectId: id,
      })
      .catch(logFailure(AVATAR_FAVORITES_LOG_LABEL));
  });
  selectedFavoriteAvatars.value = [];
  avatarEditMode.value = false;
}

onBeforeUnmount(() => {
  cancelLocalAvatarRefresh();
});
</script>
