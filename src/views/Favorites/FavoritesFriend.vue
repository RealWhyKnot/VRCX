<template>
  <div class="x-container">
    <div class="flex flex-col h-full min-h-0 pb-0">
      <FavoritesToolbar
        v-model:search-query="friendFavoriteSearch"
        v-model:toolbar-menu-open="friendToolbarMenuOpen"
        v-model:card-scale-value="friendCardScaleValue"
        v-model:card-spacing-value="friendCardSpacingValue"
        :sort-value="sortFavorites ? 'date' : 'name'"
        :search-placeholder="t('view.favorite.worlds.search')"
        :card-scale-percent="friendCardScalePercent"
        :card-scale-slider="friendCardScaleSlider"
        :card-spacing-percent="friendCardSpacingPercent"
        :card-spacing-slider="friendCardSpacingSlider"
        @update:sort-value="handleSortFavoritesChange"
        @search="searchFriendFavorites"
        @import="handleFriendImportClick"
        @export="handleFriendExportClick"
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
                <template v-if="favoriteFriendGroups.length">
                  <div
                    v-for="group in favoriteFriendGroups"
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
                                  v-for="visibility in friendGroupVisibilityOptions"
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
                <div v-else class="text-center text-xs py-3">
                  <DataTableEmpty type="nodata" />
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between font-semibold text-sm mb-[9px]">
                <span>{{ t("view.favorite.worlds.local_favorites") }}</span>
                <Button class="rounded-full" size="icon-sm" variant="ghost" :aria-label="t('common.actions.refresh')" @click.stop="getLocalFriendFavorites"
                  ><RefreshCcw />
                </Button>
              </div>
              <div class="flex flex-col gap-2">
                <template v-if="localFriendFavoriteGroups.length">
                  <div
                    v-for="group in localFriendFavoriteGroups"
                    :key="group"
                    :class="['group-item x-hover-card hover:shadow-sm', { 'is-active': !hasSearchInput && isGroupActive('local', group) }]"
                    @click="handleGroupClick('local', group)"
                  >
                    <div class="flex items-start justify-between mb-1 text-[13px]">
                      <span class="font-semibold">{{ group }}</span>
                      <div class="flex items-center flex-col">
                        <span class="text-xs">{{ localFriendFavGroupLength(group) }}</span>
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
              v-model:edit-mode="friendEditMode"
              :edit-mode-disabled="isSearchActive || (!activeRemoteGroup && !activeLocalGroupName)"
              :edit-mode-visible="friendEditMode && !isSearchActive"
              :is-all-selected="isAllFriendsSelected"
              :has-selection="hasFriendSelection"
              :show-copy-button="!isLocalGroupSelected"
              @toggle-select-all="toggleSelectAllFriends"
              @clear-selection="clearSelectedFriends"
              @copy-selection="copySelectedFriends"
              @bulk-unfavorite="showFriendBulkUnfavoriteSelectionConfirm"
            >
              <template #title>
                <span v-if="isSearchActive">{{ t("view.favorite.worlds.search") }}</span>
                <template v-else-if="activeRemoteGroup">
                  <span>
                    {{ activeRemoteGroup.displayName }}
                    <small>{{ activeRemoteGroup.count }}/{{ activeRemoteGroup.capacity }}</small>
                  </span>
                </template>
                <span v-else-if="activeLocalGroupName">
                  {{ activeLocalGroupName }}
                  <small>{{ activeLocalGroupCount }}</small>
                </span>
                <span v-else>No Group Selected</span>
              </template>
            </FavoritesContentHeader>
            <div :ref="cardScaling.containerRef" class="flex-1 min-h-0">
              <template v-if="activeRemoteGroup && !isSearchActive">
                <div class="h-full pr-2 overflow-auto">
                  <template v-if="currentFriendFavorites.length">
                    <div class="favorites-card-list" :style="friendFavoritesGridStyle(currentFriendFavorites.length)">
                      <FavoritesFriendItem
                        v-for="favorite in currentFriendFavorites"
                        :key="favorite.id"
                        :favorite="favorite"
                        :group="activeRemoteGroup"
                        :selected="selectedFavoriteFriends.includes(favorite.id)"
                        :edit-mode="friendEditMode"
                        @toggle-select="toggleFriendSelection(favorite.id, $event)"
                      />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
              </template>
              <template v-else-if="!isSearchActive && activeLocalGroupName && isLocalGroupSelected">
                <div class="h-full pr-2 overflow-auto">
                  <template v-if="currentLocalFriendFavorites.length">
                    <div class="favorites-card-list" :style="friendFavoritesGridStyle(currentLocalFriendFavorites.length)">
                      <FavoritesFriendItem
                        v-for="favorite in currentLocalFriendFavorites"
                        :key="favorite.id"
                        :favorite="favorite"
                        :group="{ key: activeLocalGroupName, type: 'local' }"
                        :selected="selectedFavoriteFriends.includes(favorite.id)"
                        :edit-mode="friendEditMode"
                        @toggle-select="toggleFriendSelection(favorite.id, $event)"
                      />
                    </div>
                  </template>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nodata" />
                  </div>
                </div>
              </template>
              <template v-else-if="!isSearchActive">
                <div class="flex items-center justify-center text-[13px] h-full">No Group Selected</div>
              </template>
              <template v-else>
                <div class="h-full pr-2 overflow-auto">
                  <div
                    v-if="friendFavoriteSearchResults.length"
                    class="favorites-card-list"
                    :style="friendFavoritesGridStyle(friendFavoriteSearchResults.length)"
                  >
                    <FavoritesFriendItem v-for="favorite in friendFavoriteSearchResults" :key="favorite.id" :favorite="favorite" />
                  </div>
                  <div v-else class="flex items-center justify-center text-[13px] h-full">
                    <DataTableEmpty type="nomatch" />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    <FriendExportDialog v-model:friend-export-dialog-visible="friendExportDialogVisible" />
  </div>
</template>

<script setup lang="ts">
import { Ellipsis, MoreHorizontal, Plus, RefreshCcw, RefreshCw } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
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
import { useFavoriteStore } from "../../stores/favorite";
import type { FavoriteGroupSlot, FavoriteObjectCtx } from "../../stores/favorite-types";
import { isVrcxUser } from "../../stores/friend-types";
import { logFailure } from "../../stores/log-failure";
import { useModalStore } from "../../stores/modal";
import { useUserStore } from "../../stores/user";
import ResizableHandle from "../../components/ui/resizable/ResizableHandle.vue";
import ResizablePanel from "../../components/ui/resizable/ResizablePanel.vue";
import ResizablePanelGroup from "../../components/ui/resizable/ResizablePanelGroup.vue";
import { debounce } from "../../shared/utils/common";
import { favoriteRequest } from "../../api/favorite";
import type { VrcxUser } from "../../types/vrcx";
import { useFavoritesCardScaling } from "./composables/use-favorites-card-scaling.ts";
import { useFavoritesGroupPanel } from "./composables/use-favorites-group-panel.ts";
import { useFavoritesLocalGroups } from "./composables/use-favorites-local-groups.ts";
import { useFavoritesSplitter } from "./composables/use-favorites-splitter.ts";
import {
  refreshFavorites,
  getLocalWorldFavorites,
  getLocalFriendFavorites,
  deleteLocalFriendFavoriteGroup,
  renameLocalFriendFavoriteGroup,
  removeLocalFriendFavorite,
} from "../../coordinators/favorite-coordinator";
import FavoritesContentHeader from "./components/FavoritesContentHeader.vue";
import FavoritesFriendItem from "./components/FavoritesFriendItem.vue";
import FavoritesToolbar from "./components/FavoritesToolbar.vue";
import FriendExportDialog from "./dialogs/FriendExportDialog.vue";
import "./favorites-layout.css";

type FavoriteFriendEntry = {
  id: string;
  name?: string | undefined;
  ref?: VrcxUser | undefined;
};

const friendGroupVisibilityOptions = ["public", "friends", "private"] as const;

const splitter = useFavoritesSplitter({ configKey: "VRCX_FavoritesFriendSplitter" });
const { defaultSize: splitterDefaultSize, minSize: splitterMinSize, maxSize: splitterMaxSize, handleLayout, setDragging: splitterSetDragging } = splitter;

const { sortFavorites } = storeToRefs(useAppearanceSettingsStore());
const { setSortFavorites } = useAppearanceSettingsStore();
const favoriteStore = useFavoriteStore();
const modalStore = useModalStore();
const {
  favoriteFriends,
  favoriteFriendGroups,
  groupedByGroupKeyFavoriteFriends,
  selectedFavoriteFriends,
  friendImportDialogInput,
  isFavoriteLoading,
  localFriendFavorites,
  localFriendFavoriteGroups,
} = storeToRefs(favoriteStore);
const { showFriendImportDialog, handleFavoriteGroup, localFriendFavGroupLength, newLocalFriendFavoriteGroup } = favoriteStore;
const userStore = useUserStore();
const { cachedUsers } = storeToRefs(userStore);
const { t } = useI18n();

const cardScaling = useFavoritesCardScaling({
  configKey: "VRCX_FavoritesFriendCardScale",
  spacingConfigKey: "VRCX_FavoritesFriendCardSpacing",
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
  cardScale: friendCardScale,
  cardSpacing: friendCardSpacing,
  slider: friendCardScaleSlider,
  spacingSlider: friendCardSpacingSlider,
  gridStyle: friendFavoritesGridStyle,
} = cardScaling;

const friendCardScalePercent = computed(() => Math.round(friendCardScale.value * 100));
const friendCardSpacingPercent = computed(() => Math.round(friendCardSpacing.value * 100));
const friendCardScaleValue = computed({
  get: () => [friendCardScale.value],
  set: (value: number[] | undefined) => {
    const next = value?.[0];
    if (typeof next === "number") {
      friendCardScale.value = next;
    }
  },
});
const friendCardSpacingValue = computed({
  get: () => [friendCardSpacing.value],
  set: (value: number[] | undefined) => {
    const next = value?.[0];
    if (typeof next === "number") {
      friendCardSpacing.value = next;
    }
  },
});

const friendExportDialogVisible = ref(false);
const friendFavoriteSearch = ref("");
const friendFavoriteSearchResults = ref<FavoriteFriendEntry[]>([]);
const friendEditMode = ref(false);
const friendToolbarMenuOpen = ref(false);

const {
  activeGroupMenu,
  isLocalGroupSelected,
  remoteGroupMenuKey,
  localGroupMenuKey,
  activeRemoteGroup,
  activeLocalGroupName,
  activeLocalGroupCount,
  handleGroupMenuVisible,
  selectGroup,
  selectDefaultGroup,
  isGroupActive,
  ensureSelectedGroup,
} = useFavoritesGroupPanel({
  remoteGroups: favoriteFriendGroups,
  localGroups: localFriendFavoriteGroups,
  localFavorites: localFriendFavorites,
  clearSelection: () => {
    selectedFavoriteFriends.value = [];
  },
});

const localGroups = useFavoritesLocalGroups({
  createGroup: newLocalFriendFavoriteGroup,
  selectGroup,
});
const { isCreatingLocalGroup, newLocalGroupName, startLocalGroupCreation, cancelLocalGroupCreation, handleLocalGroupCreationConfirm } = localGroups;

function toFriendEntry(favorite: FavoriteObjectCtx): FavoriteFriendEntry {
  return {
    id: favorite.id,
    name: favorite.name,
    ref: isVrcxUser(favorite.ref) ? favorite.ref : undefined,
  };
}

function handleSortFavoritesChange(value: string) {
  const isDateSort = value === "date";
  if (isDateSort !== sortFavorites.value) {
    setSortFavorites();
  }
}

const hasFriendSelection = computed(() => selectedFavoriteFriends.value.length > 0);
const hasSearchInput = computed(() => friendFavoriteSearch.value.trim().length > 0);
const isSearchActive = computed(() => friendFavoriteSearch.value.trim().length >= 3);

const closeFriendToolbarMenu = () => {
  friendToolbarMenuOpen.value = false;
};

function handleFriendImportClick() {
  closeFriendToolbarMenu();
  showFriendImportDialog();
}

function handleFriendExportClick() {
  closeFriendToolbarMenu();
  showFriendExportDialog();
}

const searchableFriendEntries = computed(() => {
  const seen = new Set<string>();
  const entries: FavoriteFriendEntry[] = [];
  for (const favorite of favoriteFriends.value) {
    const entry = toFriendEntry(favorite);
    if (!entry.ref || !entry.id || seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    entries.push(entry);
  }
  return entries;
});

const currentFriendFavorites = computed<FavoriteFriendEntry[]>(() => {
  if (!activeRemoteGroup.value) {
    return [];
  }
  return (groupedByGroupKeyFavoriteFriends.value[activeRemoteGroup.value.key] ?? []).map(toFriendEntry);
});

const currentLocalFriendFavorites = computed<FavoriteFriendEntry[]>(() => {
  if (!activeLocalGroupName.value) {
    return [];
  }
  const userIds = localFriendFavorites.value[activeLocalGroupName.value] ?? [];
  return userIds.map((userId) => {
    const user = cachedUsers.value.get(userId);
    const displayName = user?.displayName;
    return {
      id: userId,
      ref: user ?? undefined,
      name: displayName === "" ? userId : (displayName ?? userId),
    };
  });
});

const isAllFriendsSelected = computed(() => {
  if (!activeRemoteGroup.value || !currentFriendFavorites.value.length) {
    return false;
  }
  return currentFriendFavorites.value.map((fav) => fav.id).every((id) => selectedFavoriteFriends.value.includes(id));
});

watch(
  () => favoriteFriendGroups.value.map((group) => `${group.key}:${group.count}`),
  () => {
    ensureSelectedGroup();
  },
  { immediate: true }
);

watch(isSearchActive, (isActive) => {
  if (isActive && friendEditMode.value) {
    friendEditMode.value = false;
  }
});

watch(
  () => friendEditMode.value,
  (isEditing) => {
    if (!isEditing) {
      clearSelectedFriends();
    }
  }
);

function showFriendExportDialog() {
  friendExportDialogVisible.value = true;
}

function handleRefreshFavorites() {
  refreshFavorites();
  void getLocalWorldFavorites().catch(logFailure("Refresh local world favorites"));
  void getLocalFriendFavorites().catch(logFailure("Refresh local friend favorites"));
}

function handleGroupClick(type: string, key: string) {
  if (hasSearchInput.value) {
    friendFavoriteSearch.value = "";
    doSearchFriendFavorites("");
  }
  selectGroup(type, key);
}

function doSearchFriendFavorites(searchTerm?: string) {
  const search = (searchTerm ?? friendFavoriteSearch.value).trim().toLowerCase();
  if (search.length < 3) {
    friendFavoriteSearchResults.value = [];
    return;
  }
  friendFavoriteSearchResults.value = searchableFriendEntries.value.filter((favorite) => {
    const user = favorite.ref;
    if (!user) {
      return false;
    }
    const username = user.username ?? "";
    return user.displayName.toLowerCase().includes(search) || username.toLowerCase().includes(search);
  });
}
const searchFriendFavorites = debounce(doSearchFriendFavorites, 200);

function toggleFriendSelection(id: string, isSelected: boolean) {
  if (isSelected) {
    if (!selectedFavoriteFriends.value.includes(id)) {
      selectedFavoriteFriends.value.push(id);
    }
  } else {
    selectedFavoriteFriends.value = selectedFavoriteFriends.value.filter((selectedId) => selectedId !== id);
  }
}

function clearSelectedFriends() {
  selectedFavoriteFriends.value = [];
}

function toggleSelectAllFriends() {
  if (!activeRemoteGroup.value) {
    return;
  }
  if (isAllFriendsSelected.value) {
    selectedFavoriteFriends.value = [];
  } else {
    selectedFavoriteFriends.value = currentFriendFavorites.value.map((fav) => fav.id);
  }
}

function copySelectedFriends() {
  if (!selectedFavoriteFriends.value.length) {
    return;
  }
  const idList = selectedFavoriteFriends.value.map((id) => `${id}\n`).join("");
  friendImportDialogInput.value = idList;
  showFriendImportDialog();
}

function showFriendBulkUnfavoriteSelectionConfirm() {
  if (!selectedFavoriteFriends.value.length) {
    return;
  }
  const total = selectedFavoriteFriends.value.length;
  modalStore
    .confirm({
      description: `Are you sure you want to unfavorite ${total} favorites?\n            This action cannot be undone.`,
      title: `Delete ${total} favorites?`,
    })
    .then(({ ok }) => {
      if (ok) {
        bulkUnfavoriteSelectedFriends([...selectedFavoriteFriends.value]);
      }
    })
    .catch(logFailure("Friend favorites dialog"));
}

function bulkUnfavoriteSelectedFriends(ids: string[]) {
  if (isLocalGroupSelected.value && activeLocalGroupName.value) {
    ids.forEach((id) => {
      removeLocalFriendFavorite(id, activeLocalGroupName.value);
    });
  } else {
    ids.forEach((id) => {
      void favoriteRequest.deleteFavorite({ objectId: id }).catch(logFailure("Remove friend favorite"));
    });
  }
  selectedFavoriteFriends.value = [];
  friendEditMode.value = false;
}

function clearFavoriteGroup(group: FavoriteGroupSlot) {
  modalStore
    .confirm({
      description: t("confirm.clear_group"),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (ok) {
        void favoriteRequest
          .clearFavoriteGroup({
            type: group.type,
            group: group.name,
          })
          .catch(logFailure("Clear friend favorite group"));
      }
    })
    .catch(logFailure("Friend favorites dialog"));
}

function handleVisibilitySelection(group: FavoriteGroupSlot, visibility: (typeof friendGroupVisibilityOptions)[number]) {
  const menuKey = remoteGroupMenuKey(group.key);
  changeFriendGroupVisibility(group.name, visibility, menuKey);
}

function handleRemoteRename(group: FavoriteGroupSlot) {
  handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
  changeFavoriteGroupName(group);
}

function handleRemoteClear(group: FavoriteGroupSlot) {
  handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
  clearFavoriteGroup(group);
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
          type: "friend",
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
        .catch(logFailure("Rename friend favorite group"));
    })
    .catch(logFailure("Friend favorites dialog"));
}

function changeFriendGroupVisibility(name: string, visibility: (typeof friendGroupVisibilityOptions)[number], menuKey: string | null = null) {
  const params = {
    type: "friend",
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
      toast.success(t("message.group.visibility_updated"));
      if (menuKey) {
        handleGroupMenuVisible(menuKey, false);
      }
      refreshFavorites();
    })
    .catch(logFailure("Change friend favorite group visibility"));
}

function handleLocalRename(group: string) {
  handleGroupMenuVisible(localGroupMenuKey(group), false);
  modalStore
    .prompt({
      title: t("prompt.change_favorite_group_name.header"),
      description: t("prompt.change_favorite_group_name.description"),
      confirmText: t("prompt.change_favorite_group_name.change"),
      cancelText: t("prompt.change_favorite_group_name.cancel"),
      pattern: /\S+/,
      inputValue: group,
      errorMessage: t("prompt.change_favorite_group_name.input_error"),
    })
    .then(({ ok, value }) => {
      if (!ok) return;
      const newName = value.trim();
      if (!newName || newName === group) {
        return;
      }
      renameLocalFriendFavoriteGroup(newName, group);
      if (isGroupActive("local", group)) {
        selectGroup("local", newName);
      }
      toast.success(t("prompt.change_favorite_group_name.message.success"));
    })
    .catch(logFailure("Friend favorites dialog"));
}

function handleLocalDelete(group: string) {
  handleGroupMenuVisible(localGroupMenuKey(group), false);
  modalStore
    .confirm({
      description: t("confirm.delete_group", { name: group }),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (!ok) return;
      deleteLocalFriendFavoriteGroup(group);
      if (isGroupActive("local", group)) {
        selectDefaultGroup();
      }
    })
    .catch(logFailure("Friend favorites dialog"));
}
</script>
