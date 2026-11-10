import { computed, reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { compareByName, createDefaultFavoriteGroupRef, replaceReactiveObject } from "../shared/utils";
import { favoriteRequest } from "../api";
import { database } from "../services/database";
import { processBulk } from "../services/request";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { watchState } from "../services/watchState";
import { onLoginStateChanged } from "../coordinators/favoriteCoordinator";

export const useFavoriteStore = defineStore("Favorite", () => {
  const appearanceSettingsStore = useAppearanceSettingsStore();

  const { t } = useI18n();

  const state = reactive({
    favoriteObjects: new Map(),
    favoriteFriends_: [],
    favoriteWorlds_: [],
    favoriteAvatars_: [],
  });

  const cachedFavorites = reactive(new Map());
  const cachedFavoritesByObjectId = reactive(new Map());

  const cachedFavoriteGroups = ref({});

  const isFavoriteGroupLoading = ref(false);

  const favoriteFriendGroups = ref([]);

  const favoriteWorldGroups = ref([]);
  const favoriteAvatarGroups = ref([]);

  const favoriteLimits = ref({
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

  const localWorldFavorites = reactive({});

  const localAvatarFavorites = reactive({});

  const localFriendFavorites = reactive({});

  const selectedFavoriteFriends = ref([]);
  const selectedFavoriteWorlds = ref([]);
  const selectedFavoriteAvatars = ref([]);

  const favoriteDialog = ref({
    visible: false,
    loading: false,
    type: "",
    objectId: "",
    currentGroup: {},
  });

  const favoritesSortOrder = ref([]);

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

  const localWorldFavoritesList = computed(() =>
    Object.values(localWorldFavorites)
      .flat()
      .map((fav) => fav.id)
  );

  const localAvatarFavoritesList = computed(() =>
    Object.values(localAvatarFavorites)
      .flat()
      .map((fav) => fav.id)
  );

  const localFriendFavoritesList = computed(() =>
    Object.values(localFriendFavorites)
      .flat()
      .map((userId) => userId)
  );

  const groupedByGroupKeyFavoriteFriends = computed(() => {
    const groupedByGroupKeyFavoriteFriends = {};
    favoriteFriends.value.forEach((friend) => {
      if (friend.groupKey) {
        if (!groupedByGroupKeyFavoriteFriends[friend.groupKey]) {
          groupedByGroupKeyFavoriteFriends[friend.groupKey] = [];
        }
        groupedByGroupKeyFavoriteFriends[friend.groupKey].push(friend);
      }
    });
    return groupedByGroupKeyFavoriteFriends;
  });

  const localWorldFavGroupLength = computed(() => (group) => {
    const favoriteGroup = localWorldFavorites[group];
    if (!favoriteGroup) {
      return 0;
    }
    return favoriteGroup.length;
  });

  const localAvatarFavGroupLength = computed(() => (group) => {
    const favoriteGroup = localAvatarFavorites[group];
    if (!favoriteGroup) {
      return 0;
    }
    return favoriteGroup.length;
  });

  const localFriendFavoriteGroups = computed(() => Object.keys(localFriendFavorites).sort());

  const localFriendFavGroupLength = computed(() => (group) => {
    const favoriteGroup = localFriendFavorites[group];
    if (!favoriteGroup) {
      return 0;
    }
    return favoriteGroup.length;
  });

  function syncFavoriteSelection(list, selectionRef) {
    if (!Array.isArray(list)) {
      selectionRef.value = [];
      return;
    }
    const availableIds = new Set(list.map((item) => item.id));
    const filtered = selectionRef.value.filter((id) => availableIds.has(id));
    if (filtered.length !== selectionRef.value.length) {
      selectionRef.value = filtered;
    }
  }

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
    const groups = {};
    for (const group of favoriteFriendGroups.value) {
      groups[group.key] = group;
    }
    for (const group of favoriteWorldGroups.value) {
      groups[group.key] = group;
    }
    for (const group of favoriteAvatarGroups.value) {
      groups[group.key] = group;
    }
    return groups;
  }

  function getCachedFavoritesByObjectId(objectId) {
    return cachedFavoritesByObjectId.get(objectId);
  }

  function handleFavoriteGroup(args) {
    args.ref = applyFavoriteGroup(args.json);
  }

  function refreshFavoriteGroups() {
    if (isFavoriteGroupLoading.value) {
      return;
    }
    isFavoriteGroupLoading.value = true;
    processBulk({
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
      done(ok) {
        if (ok) {
          buildFavoriteGroups();
        }
        isFavoriteGroupLoading.value = false;
      },
    });
  }

  function buildFavoriteGroups() {
    let group;
    let groups;
    let i;

    favoriteFriendGroups.value = [];
    for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.friend; ++i) {
      favoriteFriendGroups.value.push({
        assign: false,
        key: `friend:group_${i}`,
        type: "friend",
        name: `group_${i}`,
        displayName: `Group ${i + 1}`,
        capacity: favoriteLimits.value.maxFavoritesPerGroup.friend,
        count: 0,
        visibility: "private",
      });
    }

    favoriteWorldGroups.value = [];
    for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.world; ++i) {
      favoriteWorldGroups.value.push({
        assign: false,
        key: `world:worlds${i + 1}`,
        type: "world",
        name: `worlds${i + 1}`,
        displayName: `Group ${i + 1}`,
        capacity: favoriteLimits.value.maxFavoritesPerGroup.world,
        count: 0,
        visibility: "private",
      });
    }

    for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.vrcPlusWorld; ++i) {
      favoriteWorldGroups.value.push({
        assign: false,
        key: `vrcPlusWorld:vrcPlusWorlds${i + 1}`,
        type: "vrcPlusWorld",
        name: `vrcPlusWorlds${i + 1}`,
        displayName: `VRC+ Group ${i + 1}`,
        capacity: favoriteLimits.value.maxFavoritesPerGroup.vrcPlusWorld,
        count: 0,
        visibility: "private",
      });
    }

    favoriteAvatarGroups.value = [];
    for (i = 0; i < favoriteLimits.value.maxFavoriteGroups.avatar; ++i) {
      favoriteAvatarGroups.value.push({
        assign: false,
        key: `avatar:avatars${i + 1}`,
        type: "avatar",
        name: `avatars${i + 1}`,
        displayName: `Group ${i + 1}`,
        capacity: favoriteLimits.value.maxFavoritesPerGroup.avatar,
        count: 0,
        visibility: "private",
      });
    }
    const types = {
      friend: favoriteFriendGroups.value,
      world: favoriteWorldGroups.value,
      vrcPlusWorld: favoriteWorldGroups.value,
      avatar: favoriteAvatarGroups.value,
    };
    const assigns = new Set();

    for (const key in cachedFavoriteGroups.value) {
      const ref = cachedFavoriteGroups.value[key];
      groups = types[ref.type];
      if (typeof groups === "undefined") {
        continue;
      }
      for (group of groups) {
        if (group.assign === false && group.name === ref.name) {
          group.assign = true;
          if (ref.displayName) {
            group.displayName = ref.displayName;
          }
          group.visibility = ref.visibility;
          assigns.add(ref.id);
          break;
        }
      }
    }

    for (const key in cachedFavoriteGroups.value) {
      const ref = cachedFavoriteGroups.value[key];
      if (assigns.has(ref.id)) {
        continue;
      }
      groups = types[ref.type];
      if (typeof groups === "undefined") {
        continue;
      }
      for (group of groups) {
        if (group.assign === false) {
          group.assign = true;
          group.key = `${group.type}:${ref.name}`;
          group.name = ref.name;
          group.displayName = ref.displayName;
          assigns.add(ref.id);
          break;
        }
      }
    }
    countFavoriteGroups();
  }

  function countFavoriteGroups() {
    const cachedFavoriteGroups = getCachedFavoriteGroupsByTypeName();
    for (const key in cachedFavoriteGroups) {
      cachedFavoriteGroups[key].count = 0;
    }
    for (const ref of cachedFavorites.values()) {
      const group = cachedFavoriteGroups[ref.$groupKey];
      if (typeof group === "undefined") {
        continue;
      }
      ++group.count;
    }
  }

  function applyFavoriteGroup(json) {
    let ref = cachedFavoriteGroups.value[json.id];
    if (typeof ref === "undefined") {
      ref = createDefaultFavoriteGroupRef(json);
      cachedFavoriteGroups.value[ref.id] = ref;
    } else {
      Object.assign(ref, json);
    }
    return ref;
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

  function setAvatarImportDialogInput(value) {
    avatarImportDialogInput.value = value;
  }

  function setWorldImportDialogInput(value) {
    worldImportDialogInput.value = value;
  }

  function setFriendImportDialogInput(value) {
    friendImportDialogInput.value = value;
  }

  function syncLocalAvatarFavoriteRef(avatarRef) {
    if (!avatarRef?.id) {
      return;
    }
    for (let i = 0; i < localAvatarFavoriteGroups.value.length; ++i) {
      const groupName = localAvatarFavoriteGroups.value[i];
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

  function hasLocalWorldFavorite(worldId, group) {
    const favoriteGroup = localWorldFavorites[group];
    if (!favoriteGroup) {
      return false;
    }
    for (let i = 0; i < favoriteGroup.length; ++i) {
      if (favoriteGroup[i].id === worldId) {
        return true;
      }
    }
    return false;
  }

  function hasLocalAvatarFavorite(avatarId, group) {
    const favoriteGroup = localAvatarFavorites[group];
    if (!favoriteGroup) {
      return false;
    }
    for (let i = 0; i < favoriteGroup.length; ++i) {
      if (favoriteGroup[i].id === avatarId) {
        return true;
      }
    }
    return false;
  }

  function updateFavoriteDialog(objectId) {
    const D = favoriteDialog.value;
    if (!D.visible || D.objectId !== objectId) {
      return;
    }
    D.currentGroup = {};
    const favorite = state.favoriteObjects.get(objectId);
    if (favorite) {
      let group;
      for (group of favoriteWorldGroups.value) {
        if (favorite.groupKey === group.key) {
          D.currentGroup = group;
          return;
        }
      }
      for (group of favoriteAvatarGroups.value) {
        if (favorite.groupKey === group.key) {
          D.currentGroup = group;
          return;
        }
      }
      for (group of favoriteFriendGroups.value) {
        if (favorite.groupKey === group.key) {
          D.currentGroup = group;
          return;
        }
      }
    }
  }

  function deleteLocalWorldFavoriteGroup(group) {
    let i;

    const worldIdRemoveList = new Set();
    const favoriteGroup = localWorldFavorites[group];
    for (i = 0; i < favoriteGroup.length; ++i) {
      worldIdRemoveList.add(favoriteGroup[i].id);
    }

    delete localWorldFavorites[group];
    database.deleteWorldFavoriteGroup(group);

    for (i = 0; i < localWorldFavoriteGroups.value.length; ++i) {
      const groupName = localWorldFavoriteGroups.value[i];
      if (!localWorldFavorites[groupName]) {
        continue;
      }
      for (let j = 0; j < localWorldFavorites[groupName].length; ++j) {
        const worldId = localWorldFavorites[groupName][j].id;
        if (worldIdRemoveList.has(worldId)) {
          worldIdRemoveList.delete(worldId);
          break;
        }
      }
    }

    worldIdRemoveList.forEach((id) => {
      database.removeWorldFromCache(id);
    });
  }

  function hasLocalFriendFavorite(userId, group) {
    const favoriteGroup = localFriendFavorites[group];
    if (!favoriteGroup) {
      return false;
    }
    return favoriteGroup.includes(userId);
  }

  function isInAnyLocalFriendGroup(userId) {
    for (const group in localFriendFavorites) {
      if (localFriendFavorites[group]?.includes(userId)) {
        return true;
      }
    }
    return false;
  }

  function newLocalFriendFavoriteGroup(group) {
    if (localFriendFavoriteGroups.value.includes(group)) {
      toast.error(
        t("prompt.new_local_favorite_group.message.error", {
          name: group,
        })
      );
      return;
    }
    if (!localFriendFavorites[group]) {
      localFriendFavorites[group] = [];
    }
  }

  function deleteFavoriteNoConfirm(objectId) {
    if (!objectId) {
      return;
    }
    favoriteDialog.value.visible = true;
    favoriteRequest
      .deleteFavorite({
        objectId,
      })
      .then(() => {
        favoriteDialog.value.visible = false;
      })
      .finally(() => {
        favoriteDialog.value.loading = false;
      });
  }

  function showFavoriteDialog(type, objectId) {
    const D = favoriteDialog.value;
    D.type = type;
    D.objectId = objectId;
    D.visible = true;
    updateFavoriteDialog(objectId);
  }

  function compareByFavoriteSortOrder(a, b) {
    const indexA = favoritesSortOrder.value.indexOf(a.id);
    const indexB = favoritesSortOrder.value.indexOf(b.id);
    return indexA - indexB;
  }

  function setIsFavoriteLoading(value) {
    isFavoriteLoading.value = value;
  }

  function setFavoriteLimits(value) {
    favoriteLimits.value = value;
  }

  function setFavoritesSortOrder(value) {
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
