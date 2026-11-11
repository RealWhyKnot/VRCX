import { computed, reactive, ref, watch, type Ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { FavoriteGroup } from "vrchat";

import { compareByName } from "../shared/utils/compare";
import { createDefaultFavoriteGroupRef } from "../shared/utils/entity-transforms";
import { replaceReactiveObject } from "../shared/utils/base/array";
import { favoriteRequest } from "../api/favorite";
import { database } from "../services/database";
import { processBulk } from "../services/request";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { watchState } from "../services/watch-state";
import { onLoginStateChanged } from "../coordinators/favorite-coordinator";
import { logFailure } from "./log-failure";
import type { Json } from "../types/vrcx";
import type {
  FavoriteCachedRef,
  FavoriteDialog,
  FavoriteGroupHandleArgs,
  FavoriteGroupRef,
  FavoriteGroupSlot,
  FavoriteLimits,
  FavoriteObjectCtx,
  FavoriteState,
  LocalFavoriteEntry,
  LocalFavoriteGroups,
} from "./favorite-types";

function createFavoriteSlot(type: string, name: string, displayName: string, capacity: number): FavoriteGroupSlot {
  return {
    assign: false,
    key: `${type}:${name}`,
    type,
    name,
    displayName,
    capacity,
    count: 0,
    visibility: "private",
  };
}

function flattenFavoriteGroups<T>(groups: LocalFavoriteGroups<T>): T[] {
  return Object.values(groups).flatMap((group) => group ?? []);
}

function syncFavoriteSelection(list: { id: string }[], selectionRef: Ref<string[]>) {
  const availableIds = new Set(list.map((item) => item.id));
  const filtered = selectionRef.value.filter((id) => availableIds.has(id));
  if (filtered.length !== selectionRef.value.length) {
    selectionRef.value = filtered;
  }
}

export const useFavoriteStore = defineStore("Favorite", () => {
  const appearanceSettingsStore = useAppearanceSettingsStore();

  const { t } = useI18n();

  const state = reactive<FavoriteState>({
    favoriteObjects: new Map<string, FavoriteObjectCtx>(),
    favoriteFriends_: [],
    favoriteWorlds_: [],
    favoriteAvatars_: [],
  });

  const cachedFavorites = reactive(new Map<string, FavoriteCachedRef>());
  const cachedFavoritesByObjectId = reactive(new Map<string, FavoriteCachedRef>());

  const cachedFavoriteGroups = ref<Record<string, FavoriteGroupRef>>({});

  const isFavoriteGroupLoading = ref(false);

  const favoriteFriendGroups = ref<FavoriteGroupSlot[]>([]);

  const favoriteWorldGroups = ref<FavoriteGroupSlot[]>([]);
  const favoriteAvatarGroups = ref<FavoriteGroupSlot[]>([]);

  const favoriteLimits = ref<FavoriteLimits>({
    maxFavoriteGroups: {
      avatar: 6,
      friend: 3,
      vrcPlusWorld: 4,
      world: 4,
    },
    maxFavoritesPerGroup: {
      avatar: 50,
      friend: 150,
      vrcPlusWorld: 100,
      world: 100,
    },
  });

  const isFavoriteLoading = ref(false);

  const friendImportDialogInput = ref("");

  const worldImportDialogInput = ref("");

  const avatarImportDialogInput = ref("");

  const worldImportDialogVisible = ref(false);

  const avatarImportDialogVisible = ref(false);

  const friendImportDialogVisible = ref(false);

  const localWorldFavorites = reactive<LocalFavoriteGroups<LocalFavoriteEntry>>({});

  const localAvatarFavorites = reactive<LocalFavoriteGroups<LocalFavoriteEntry>>({});

  const localFriendFavorites = reactive<LocalFavoriteGroups<string>>({});

  const selectedFavoriteFriends = ref<string[]>([]);
  const selectedFavoriteWorlds = ref<string[]>([]);
  const selectedFavoriteAvatars = ref<string[]>([]);

  const favoriteDialog = ref<FavoriteDialog>({
    visible: false,
    loading: false,
    type: "",
    objectId: "",
    currentGroup: {},
  });

  const favoritesSortOrder = ref<string[]>([]);

  const favoriteFriends = computed(() => {
    if (appearanceSettingsStore.sortFavorites) {
      return state.favoriteFriends_.toSorted(compareByFavoriteSortOrder);
    }
    return state.favoriteFriends_.toSorted(compareByName);
  });

  const favoriteWorlds = computed(() => {
    if (appearanceSettingsStore.sortFavorites) {
      return state.favoriteWorlds_.toSorted(compareByFavoriteSortOrder);
    }
    return state.favoriteWorlds_.toSorted(compareByName);
  });

  const favoriteAvatars = computed(() => {
    if (appearanceSettingsStore.sortFavorites) {
      return state.favoriteAvatars_.toSorted(compareByFavoriteSortOrder);
    }
    return state.favoriteAvatars_.toSorted(compareByName);
  });

  watch(
    favoriteFriends,
    (list) => {
      syncFavoriteSelection(list, selectedFavoriteFriends);
    },
    { immediate: true }
  );

  watch(
    favoriteWorlds,
    (list) => {
      syncFavoriteSelection(list, selectedFavoriteWorlds);
    },
    { immediate: true }
  );

  watch(
    favoriteAvatars,
    (list) => {
      syncFavoriteSelection(list, selectedFavoriteAvatars);
    },
    { immediate: true }
  );

  const localAvatarFavoriteGroups = computed(() => Object.keys(localAvatarFavorites).sort());

  const localWorldFavoriteGroups = computed(() => Object.keys(localWorldFavorites).sort());

  const localWorldFavoritesList = computed(() => flattenFavoriteGroups(localWorldFavorites).map((fav) => fav.id));

  const localAvatarFavoritesList = computed(() => flattenFavoriteGroups(localAvatarFavorites).map((fav) => fav.id));

  const localFriendFavoritesList = computed(() => flattenFavoriteGroups(localFriendFavorites));

  const groupedByGroupKeyFavoriteFriends = computed(() =>
    Object.groupBy(
      favoriteFriends.value.filter((friend) => friend.groupKey !== ""),
      (friend) => friend.groupKey
    )
  );

  const localWorldFavGroupLength = computed(() => (group: string) => localWorldFavorites[group]?.length ?? 0);

  const localAvatarFavGroupLength = computed(() => (group: string) => localAvatarFavorites[group]?.length ?? 0);

  const localFriendFavoriteGroups = computed(() => Object.keys(localFriendFavorites).sort());

  const localFriendFavGroupLength = computed(() => (group: string) => localFriendFavorites[group]?.length ?? 0);

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      cachedFavorites.clear();
      cachedFavoritesByObjectId.clear();
      cachedFavoriteGroups.value = {};
      favoriteFriendGroups.value = [];
      favoriteWorldGroups.value = [];
      favoriteAvatarGroups.value = [];
      isFavoriteLoading.value = false;
      isFavoriteGroupLoading.value = false;
      state.favoriteObjects.clear();
      state.favoriteFriends_ = [];
      state.favoriteWorlds_ = [];
      state.favoriteAvatars_ = [];
      replaceReactiveObject(localWorldFavorites, {});
      replaceReactiveObject(localAvatarFavorites, {});
      selectedFavoriteFriends.value = [];
      selectedFavoriteWorlds.value = [];
      selectedFavoriteAvatars.value = [];
      favoriteDialog.value.visible = false;
      worldImportDialogVisible.value = false;
      avatarImportDialogVisible.value = false;
      friendImportDialogVisible.value = false;

      onLoginStateChanged(isLoggedIn);
    },
    { flush: "sync" }
  );

  function getCachedFavoriteGroupsByTypeName() {
    const groups = new Map<string, FavoriteGroupSlot>();
    for (const group of [...favoriteFriendGroups.value, ...favoriteWorldGroups.value, ...favoriteAvatarGroups.value]) {
      groups.set(group.key, group);
    }
    return groups;
  }

  function getCachedFavoritesByObjectId(objectId: string) {
    return cachedFavoritesByObjectId.get(objectId);
  }

  function handleFavoriteGroup(args: FavoriteGroupHandleArgs) {
    args.ref = applyFavoriteGroup(args.json);
  }

  function refreshFavoriteGroups() {
    if (isFavoriteGroupLoading.value) {
      return;
    }
    isFavoriteGroupLoading.value = true;
    void processBulk({
      fn: (params) => favoriteRequest.getFavoriteGroups(params),
      N: -1,
      params: {
        n: 50,
        offset: 0,
      },
      handle: (args) => {
        for (const json of args.json) {
          handleFavoriteGroup({
            json,
            params: {
              favoriteGroupId: json.id,
            },
          });
        }
      },
      done(isSucceeded) {
        if (isSucceeded) {
          buildFavoriteGroups();
        }
        isFavoriteGroupLoading.value = false;
      },
    }).catch(logFailure("Failed to refresh favorite groups:"));
  }

  function buildFavoriteGroups() {
    const limits = favoriteLimits.value;

    favoriteFriendGroups.value = [];
    for (let i = 0; i < limits.maxFavoriteGroups.friend; ++i) {
      favoriteFriendGroups.value.push(createFavoriteSlot("friend", `group_${i}`, `Group ${i + 1}`, limits.maxFavoritesPerGroup.friend));
    }

    favoriteWorldGroups.value = [];
    for (let i = 0; i < limits.maxFavoriteGroups.world; ++i) {
      favoriteWorldGroups.value.push(createFavoriteSlot("world", `worlds${i + 1}`, `Group ${i + 1}`, limits.maxFavoritesPerGroup.world));
    }

    for (let i = 0; i < limits.maxFavoriteGroups.vrcPlusWorld; ++i) {
      favoriteWorldGroups.value.push(
        createFavoriteSlot("vrcPlusWorld", `vrcPlusWorlds${i + 1}`, `VRC+ Group ${i + 1}`, limits.maxFavoritesPerGroup.vrcPlusWorld)
      );
    }

    favoriteAvatarGroups.value = [];
    for (let i = 0; i < limits.maxFavoriteGroups.avatar; ++i) {
      favoriteAvatarGroups.value.push(createFavoriteSlot("avatar", `avatars${i + 1}`, `Group ${i + 1}`, limits.maxFavoritesPerGroup.avatar));
    }

    const groupsByType = new Map<string, FavoriteGroupSlot[]>([
      ["friend", favoriteFriendGroups.value],
      ["world", favoriteWorldGroups.value],
      ["vrcPlusWorld", favoriteWorldGroups.value],
      ["avatar", favoriteAvatarGroups.value],
    ]);
    const assigns = new Set<string>();

    for (const cachedGroup of Object.values(cachedFavoriteGroups.value)) {
      const groups = groupsByType.get(cachedGroup.type);
      if (!groups) {
        continue;
      }
      for (const group of groups) {
        if (!group.assign && group.name === cachedGroup.name) {
          group.assign = true;
          if (cachedGroup.displayName) {
            group.displayName = cachedGroup.displayName;
          }
          group.visibility = cachedGroup.visibility;
          assigns.add(cachedGroup.id);
          break;
        }
      }
    }

    for (const cachedGroup of Object.values(cachedFavoriteGroups.value)) {
      if (assigns.has(cachedGroup.id)) {
        continue;
      }
      const groups = groupsByType.get(cachedGroup.type);
      if (!groups) {
        continue;
      }
      for (const group of groups) {
        if (!group.assign) {
          group.assign = true;
          group.key = `${group.type}:${cachedGroup.name}`;
          group.name = cachedGroup.name;
          group.displayName = cachedGroup.displayName;
          assigns.add(cachedGroup.id);
          break;
        }
      }
    }
    countFavoriteGroups();
  }

  function countFavoriteGroups() {
    const groups = getCachedFavoriteGroupsByTypeName();
    for (const group of groups.values()) {
      group.count = 0;
    }
    for (const cached of cachedFavorites.values()) {
      const group = groups.get(cached.$groupKey);
      if (!group) {
        continue;
      }
      ++group.count;
    }
  }

  function applyFavoriteGroup(json: Json<FavoriteGroup>): FavoriteGroupRef {
    let groupRef = cachedFavoriteGroups.value[json.id];
    if (groupRef === undefined) {
      groupRef = createDefaultFavoriteGroupRef(json);
      cachedFavoriteGroups.value[groupRef.id] = groupRef;
    } else {
      Object.assign(groupRef, json);
    }
    return groupRef;
  }

  function showWorldImportDialog() {
    worldImportDialogVisible.value = true;
  }

  function showAvatarImportDialog() {
    avatarImportDialogVisible.value = true;
  }

  function showFriendImportDialog() {
    friendImportDialogVisible.value = true;
  }

  function setAvatarImportDialogInput(value: string) {
    avatarImportDialogInput.value = value;
  }

  function setWorldImportDialogInput(value: string) {
    worldImportDialogInput.value = value;
  }

  function setFriendImportDialogInput(value: string) {
    friendImportDialogInput.value = value;
  }

  function syncLocalAvatarFavoriteRef(avatarRef: LocalFavoriteEntry) {
    if (!avatarRef.id) {
      return;
    }
    for (const groupName of localAvatarFavoriteGroups.value) {
      const group = localAvatarFavorites[groupName];
      if (!group) {
        continue;
      }
      for (let j = 0; j < group.length; ++j) {
        if (group[j]?.id === avatarRef.id) {
          group[j] = avatarRef;
        }
      }
    }
  }

  function hasLocalWorldFavorite(worldId: string, group: string) {
    const favoriteGroup = localWorldFavorites[group];
    if (!favoriteGroup) {
      return false;
    }
    return favoriteGroup.some((fav) => fav.id === worldId);
  }

  function hasLocalAvatarFavorite(avatarId: string, group: string) {
    const favoriteGroup = localAvatarFavorites[group];
    if (!favoriteGroup) {
      return false;
    }
    return favoriteGroup.some((fav) => fav.id === avatarId);
  }

  function updateFavoriteDialog(objectId: string) {
    const dialog = favoriteDialog.value;
    if (!dialog.visible || dialog.objectId !== objectId) {
      return;
    }
    dialog.currentGroup = {};
    const favorite = state.favoriteObjects.get(objectId);
    if (!favorite) {
      return;
    }
    const group = [...favoriteWorldGroups.value, ...favoriteAvatarGroups.value, ...favoriteFriendGroups.value].find(
      (candidate) => candidate.key === favorite.groupKey
    );
    if (group) {
      dialog.currentGroup = group;
    }
  }

  function deleteLocalWorldFavoriteGroup(group: string) {
    const favoriteGroup = localWorldFavorites[group];
    if (!favoriteGroup) {
      return;
    }

    const worldIdRemoveList = new Set(favoriteGroup.map((fav) => fav.id));

    Reflect.deleteProperty(localWorldFavorites, group);
    database.deleteWorldFavoriteGroup(group);

    for (const groupName of localWorldFavoriteGroups.value) {
      const entries = localWorldFavorites[groupName];
      if (!entries) {
        continue;
      }
      for (const entry of entries) {
        if (worldIdRemoveList.delete(entry.id)) {
          break;
        }
      }
    }

    for (const id of worldIdRemoveList) {
      database.removeWorldFromCache(id);
    }
  }

  function hasLocalFriendFavorite(userId: string, group: string) {
    return localFriendFavorites[group]?.includes(userId) ?? false;
  }

  function isInAnyLocalFriendGroup(userId: string) {
    return Object.values(localFriendFavorites).some((userIds) => userIds?.includes(userId) === true);
  }

  function newLocalFriendFavoriteGroup(group: string) {
    if (localFriendFavoriteGroups.value.includes(group)) {
      toast.error(
        t("prompt.new_local_favorite_group.message.error", {
          name: group,
        })
      );
      return;
    }
    localFriendFavorites[group] ??= [];
  }

  function deleteFavoriteNoConfirm(objectId: string) {
    if (!objectId) {
      return;
    }
    favoriteDialog.value.visible = true;
    void favoriteRequest
      .deleteFavorite({
        objectId,
      })
      .then(() => {
        favoriteDialog.value.visible = false;
      })
      .finally(() => {
        favoriteDialog.value.loading = false;
      })
      .catch(logFailure("Failed to delete favorite:"));
  }

  function showFavoriteDialog(type: string, objectId: string) {
    const dialog = favoriteDialog.value;
    dialog.type = type;
    dialog.objectId = objectId;
    dialog.visible = true;
    updateFavoriteDialog(objectId);
  }

  function compareByFavoriteSortOrder(a: { id: string }, b: { id: string }) {
    const indexA = favoritesSortOrder.value.indexOf(a.id);
    const indexB = favoritesSortOrder.value.indexOf(b.id);
    return indexA - indexB;
  }

  function setIsFavoriteLoading(isLoading: boolean) {
    isFavoriteLoading.value = isLoading;
  }

  function setFavoriteLimits(value: FavoriteLimits) {
    favoriteLimits.value = value;
  }

  function setFavoritesSortOrder(value: string[]) {
    favoritesSortOrder.value = value;
  }

  return {
    state,

    favoriteFriends,
    favoriteWorlds,
    favoriteAvatars,
    isFavoriteGroupLoading,
    favoriteFriendGroups,
    cachedFavoriteGroups,
    favoriteLimits,
    cachedFavorites,
    cachedFavoritesByObjectId,
    favoriteWorldGroups,
    favoriteAvatarGroups,
    isFavoriteLoading,
    friendImportDialogInput,
    worldImportDialogInput,
    avatarImportDialogInput,
    worldImportDialogVisible,
    avatarImportDialogVisible,
    friendImportDialogVisible,
    localWorldFavorites,
    localAvatarFavorites,
    localAvatarFavoritesList,
    localAvatarFavoriteGroups,
    favoriteDialog,
    localWorldFavoritesList,
    localFriendFavoritesList,

    localWorldFavoriteGroups,
    localFriendFavorites,
    localFriendFavoriteGroups,

    localFriendFavGroupLength,
    groupedByGroupKeyFavoriteFriends,
    selectedFavoriteFriends,
    selectedFavoriteWorlds,
    selectedFavoriteAvatars,
    localWorldFavGroupLength,
    localAvatarFavGroupLength,
    favoritesSortOrder,

    refreshFavoriteGroups,
    applyFavoriteGroup,
    showWorldImportDialog,
    showAvatarImportDialog,
    showFriendImportDialog,
    setAvatarImportDialogInput,
    setWorldImportDialogInput,
    setFriendImportDialogInput,
    syncLocalAvatarFavoriteRef,
    hasLocalWorldFavorite,
    hasLocalAvatarFavorite,
    updateFavoriteDialog,
    deleteLocalWorldFavoriteGroup,
    deleteFavoriteNoConfirm,
    showFavoriteDialog,
    getCachedFavoritesByObjectId,
    getCachedFavoriteGroupsByTypeName,
    handleFavoriteGroup,
    hasLocalFriendFavorite,
    isInAnyLocalFriendGroup,
    newLocalFriendFavoriteGroup,
    countFavoriteGroups,
    setIsFavoriteLoading,
    setFavoriteLimits,
    setFavoritesSortOrder,
  };
});
