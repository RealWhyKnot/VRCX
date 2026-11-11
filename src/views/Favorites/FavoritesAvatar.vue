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
          <FavoritesAvatarGroupSidebar
            v-model:new-local-group-name="newLocalGroupName"
            :has-search-input="hasSearchInput"
            :is-group-active="isGroupActive"
            :handle-group-click="handleGroupClick"
            :avatar-group-placeholders="avatarGroupPlaceholders"
            :active-group-menu="activeGroupMenu"
            :remote-group-menu-key="remoteGroupMenuKey"
            :handle-group-menu-visible="handleGroupMenuVisible"
            :handle-visibility-selection="handleVisibilitySelection"
            :handle-remote-rename="handleRemoteRename"
            :handle-remote-clear="handleRemoteClear"
            :handle-refresh-favorites="handleRefreshFavorites"
            :is-refreshing-local-favorites="refreshingLocalFavorites"
            :refresh-local-avatar-favorites="refreshLocalAvatarFavorites"
            :cancel-local-refresh="cancelLocalRefresh"
            :local-group-menu-key="localGroupMenuKey"
            :handle-local-rename="handleLocalRename"
            :handle-check-invalid-avatars="handleCheckInvalidAvatars"
            :handle-local-delete="handleLocalDelete"
            :is-creating-local-group="isCreatingLocalGroup"
            :start-local-group-creation="startLocalGroupCreation"
            :new-local-group-input="localGroups.newLocalGroupInput"
            :handle-local-group-creation-confirm="handleLocalGroupCreationConfirm"
            :cancel-local-group-creation="cancelLocalGroupCreation"
            :history-group-menu-key="historyGroupMenuKey"
            :history-group-key="historyGroupKey"
            :handle-history-clear="handleHistoryClear"
          />
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
                      <div class="favorites-search-card-content">
                        <div class="favorites-search-card-thumbnail" :data-empty="favorite.thumbnailImageUrl ? undefined : ''">
                          <img v-if="favorite.thumbnailImageUrl" :src="favorite.thumbnailImageUrl" loading="lazy" />
                        </div>
                        <div class="favorites-search-card-detail">
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useAvatarStore } from "../../stores/avatar";
import { useFavoriteStore } from "../../stores/favorite";
import { useModalStore } from "../../stores/modal";
import type { FavoriteGroupSlot } from "../../stores/favorite-types";
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
import { refreshFavorites } from "../../coordinators/favorite-coordinator";
import { getLocalAvatarFavorites, newLocalAvatarFavoriteGroup } from "../../coordinators/favorite-local-avatars";
import { useAvatarGroupActions } from "./composables/use-avatar-group-actions.ts";
import { useAvatarInvalidCheck } from "./composables/use-avatar-invalid-check.ts";
import { useFavoritesLocalRefresh } from "./composables/use-favorites-local-refresh.ts";
import { isAvatarSearchEntry, toAvatarFavoriteEntry } from "./avatar-favorite-entries";
import type { AvatarFavoriteEntry, AvatarGroupVisibility, AvatarSearchEntry } from "./avatar-favorite-entries";

import AvatarExportDialog from "./dialogs/AvatarExportDialog.vue";
import FavoritesAvatarGroupSidebar from "./components/FavoritesAvatarGroupSidebar.vue";
import FavoritesAvatarItem from "./components/FavoritesAvatarItem.vue";
import FavoritesAvatarLocalHistoryItem from "./components/FavoritesAvatarLocalHistoryItem.vue";
import FavoritesContentHeader from "./components/FavoritesContentHeader.vue";
import FavoritesToolbar from "./components/FavoritesToolbar.vue";

import "./favorites-layout.css";

const AVATAR_GROUP_PLACEHOLDERS = Array.from({ length: 5 }, (_, index) => ({
  key: `avatar:avatars${index + 1}`,
  displayName: `Group ${index + 1}`,
}));

const AVATAR_FAVORITES_LOG_LABEL = "Avatar favorites view";

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

  localAvatarFavoriteGroups,
  avatarImportDialogInput,
} = storeToRefs(favoriteStore);
const { showAvatarImportDialog, localAvatarFavoritesList } = favoriteStore;
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
  slider: avatarCardScaleSlider,
  spacingSlider: avatarCardSpacingSlider,
  gridStyle: avatarFavoritesGridStyle,
  cardScalePercent: avatarCardScalePercent,
  cardSpacingPercent: avatarCardSpacingPercent,
  cardScaleValue: avatarCardScaleValue,
  cardSpacingValue: avatarCardSpacingValue,
} = avatarCardScaling;

const avatarExportDialogVisible = ref(false);
const avatarFavoriteSearch = ref("");
const avatarFavoriteSearchResults = ref<AvatarSearchEntry[]>([]);
const avatarEditMode = ref(false);
const avatarToolbarMenuOpen = ref(false);
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

const { refreshingLocalFavorites, refreshLocalFavorites, cancelLocalRefresh } = useFavoritesLocalRefresh(async (avatarId) => {
  const args = await avatarRequest.getAvatar({
    avatarId,
  });
  applyAvatar(args.json);
});
const { changeFavoriteGroupName, changeAvatarGroupVisibility, clearFavoriteGroup, promptLocalAvatarFavoriteGroupRename, promptLocalAvatarFavoriteGroupDelete } =
  useAvatarGroupActions({
    logLabel: AVATAR_FAVORITES_LOG_LABEL,
    handleGroupMenuVisible,
    selectGroup,
    localAvatarFavoriteGroups,
  });
const { handleCheckInvalidAvatars } = useAvatarInvalidCheck({ handleGroupMenuVisible, localGroupMenuKey });

function refreshLocalAvatarFavorites() {
  return refreshLocalFavorites(localAvatarFavoritesList);
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

function handleHistoryClear() {
  handleGroupMenuVisible(historyGroupMenuKey, false);
  promptClearAvatarHistory();
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
  cancelLocalRefresh();
});
</script>
