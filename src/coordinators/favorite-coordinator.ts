import { toast } from "vue-sonner";
import { useFavoriteStore } from "../stores/favorite";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useFriendStore } from "../stores/friend";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { applyWorld, toWorldInput } from "./world-coordinator";
import { favoriteRequest } from "../api/favorite";
import { queryRequest } from "../api/query-request";
import { database } from "../services/database";
import { i18n } from "../plugins/i18n";
import { processBulk } from "../services/request";
import { watchState } from "../services/watch-state";
import { replaceReactiveObject } from "../shared/utils/base/array";
import type { LocalFavoriteEntry, LocalFavoriteGroups } from "./favorite-payload-guards";
import {
  createGroupRecord,
  deleteGroup,
  isFriendFavoriteRow,
  logFavoriteError,
  readFavoriteCachedRef,
  requireLocalFavoriteGroup,
  toUnknownList,
} from "./favorite-payload-guards";
import type { FavoritePageParams, FavoriteWorldPage } from "./favorite-sync";
import { handleFavorite, handleFavoriteAtDelete, refreshFavoriteItems, sortLocalWorldFavorites } from "./favorite-sync";

export function handleFavoriteWorldList(args: FavoriteWorldPage) {
  for (const json of args.json) {
    if (json.id === "???") {
      continue;
    }
    applyWorld(json);
  }
}

export function refreshFavorites() {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();

  if (favoriteStore.isFavoriteLoading) {
    return;
  }
  favoriteStore.setIsFavoriteLoading(true);
  queryRequest
    .fetch("favoriteLimits")
    .then((args) => {
      favoriteStore.setFavoriteLimits({
        ...favoriteStore.favoriteLimits,
        ...args.json,
      });
    })
    .catch(logFavoriteError);
  const newFavoriteSortOrder: string[] = [];
  const sortOrder: string[] = favoriteStore.favoritesSortOrder;
  processBulk({
    fn: (params: FavoritePageParams) => favoriteRequest.getFavorites(params),
    N: -1,
    params: {
      n: 300,
      offset: 0,
    },
    handle(args: Awaited<ReturnType<typeof favoriteRequest.getFavorites>>) {
      for (const json of args.json) {
        newFavoriteSortOrder.push(json.favoriteId);
        handleFavorite({
          json,
          ref: undefined,
        });
      }
    },
    done(isOk: boolean) {
      if (isOk) {
        for (const id of sortOrder) {
          if (!newFavoriteSortOrder.includes(id)) {
            const fav = readFavoriteCachedRef(favoriteStore.cachedFavoritesByObjectId.get(id));
            if (fav) {
              handleFavoriteAtDelete(fav);
            }
          }
        }
        favoriteStore.setFavoritesSortOrder(newFavoriteSortOrder);
      }
      refreshFavoriteItems();
      favoriteStore.refreshFavoriteGroups();
      friendStore.updateLocalFavoriteFriends();
      favoriteStore.setIsFavoriteLoading(false);
      watchState.isFavoritesLoaded = true;
      favoriteStore.countFavoriteGroups();
    },
  }).catch(logFavoriteError);
}

export function addLocalWorldFavorite(worldId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const worldStore = useWorldStore();

  if (favoriteStore.hasLocalWorldFavorite(worldId, group)) {
    return;
  }
  const ref = worldStore.cachedWorlds.get(worldId);
  if (ref === undefined) {
    return;
  }
  const localWorldFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localWorldFavorites;
  localWorldFavorites[group] ??= [];

  requireLocalFavoriteGroup(localWorldFavorites, group).unshift(ref);
  database.addWorldToCache(ref);
  database.addWorldToFavorites(worldId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === worldId) {
    favoriteStore.updateFavoriteDialog(worldId);
  }
  if (worldStore.worldDialog.visible && worldStore.worldDialog.id === worldId) {
    worldStore.setWorldDialogIsFavorite(true);
  }

  sortLocalWorldFavorites();
}

export function removeLocalWorldFavorite(worldId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const worldStore = useWorldStore();
  const localWorldFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localWorldFavorites;

  const favoriteGroup = requireLocalFavoriteGroup(localWorldFavorites, group);
  for (let i = 0; i < favoriteGroup.length; ++i) {
    if (favoriteGroup[i]?.id === worldId) {
      favoriteGroup.splice(i, 1);
    }
  }

  let isWorldInFavorites = false;
  for (const groupName of favoriteStore.localWorldFavoriteGroups) {
    const groupEntries = localWorldFavorites[groupName];
    if (!groupEntries || group === groupName) {
      continue;
    }
    for (const entry of groupEntries) {
      if (entry.id === worldId) {
        isWorldInFavorites = true;
        break;
      }
    }
  }
  if (!isWorldInFavorites) {
    database.removeWorldFromCache(worldId);
  }
  database.removeWorldFromFavorites(worldId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === worldId) {
    favoriteStore.updateFavoriteDialog(worldId);
  }
  if (worldStore.worldDialog.visible && worldStore.worldDialog.id === worldId) {
    worldStore.setWorldDialogIsFavorite(readFavoriteCachedRef(favoriteStore.getCachedFavoritesByObjectId(worldId)) !== undefined);
  }

  sortLocalWorldFavorites();
}

export async function getLocalWorldFavorites() {
  const favoriteStore = useFavoriteStore();
  const worldStore = useWorldStore();

  const localGroups = new Set<string>();
  const localFavorites = createGroupRecord<LocalFavoriteEntry>();

  const worldCache = await database.getWorldCache();
  for (const row of worldCache) {
    if (row.id === null || worldStore.cachedWorlds.has(row.id)) {
      continue;
    }
    applyWorld(toWorldInput(row, row.id));
  }

  const favorites = await database.getWorldFavorites();
  for (const row of favorites) {
    if (row.groupName === null || row.worldId === null) {
      continue;
    }
    localGroups.add(row.groupName);
    const groupEntries = localFavorites[row.groupName] ?? [];
    localFavorites[row.groupName] = groupEntries;

    const ref: LocalFavoriteEntry = worldStore.cachedWorlds.get(row.worldId) ?? { id: row.worldId };
    groupEntries.unshift(ref);
  }

  if (localGroups.size === 0) {
    localFavorites["Favorites"] = [];
  }

  replaceReactiveObject(favoriteStore.localWorldFavorites, localFavorites);

  sortLocalWorldFavorites();
}

export function renameLocalWorldFavoriteGroup(newName: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const { t } = i18n.global;
  if (favoriteStore.localWorldFavoriteGroups.includes(newName)) {
    toast.error(
      t("prompt.local_favorite_group_rename.message.error", {
        name: newName,
      })
    );
    return;
  }
  const localWorldFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localWorldFavorites;
  localWorldFavorites[newName] = localWorldFavorites[group];

  deleteGroup(localWorldFavorites, group);
  database.renameWorldFavoriteGroup(newName, group);
  sortLocalWorldFavorites();
}

export function newLocalWorldFavoriteGroup(group: string) {
  const favoriteStore = useFavoriteStore();
  const { t } = i18n.global;
  if (favoriteStore.localWorldFavoriteGroups.includes(group)) {
    toast.error(
      t("prompt.new_local_favorite_group.message.error", {
        name: group,
      })
    );
    return;
  }
  const localWorldFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localWorldFavorites;
  localWorldFavorites[group] ??= [];
  sortLocalWorldFavorites();
}

export function addLocalFriendFavorite(userId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const localFriendFavorites: LocalFavoriteGroups<string> = favoriteStore.localFriendFavorites;

  if (favoriteStore.hasLocalFriendFavorite(userId, group)) {
    return;
  }
  localFriendFavorites[group] ??= [];
  requireLocalFavoriteGroup(localFriendFavorites, group).unshift(userId);
  database.addFriendToLocalFavorites(userId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === userId) {
    favoriteStore.updateFavoriteDialog(userId);
  }
  const userDialog = userStore.userDialog;
  if (userDialog.visible && userDialog.id === userId) {
    userStore.setUserDialogIsFavorite(true);
  }
  friendStore.updateLocalFavoriteFriends();
}

export function removeLocalFriendFavorite(userId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const localFriendFavorites: LocalFavoriteGroups<string> = favoriteStore.localFriendFavorites;

  const favoriteGroup = localFriendFavorites[group];
  if (favoriteGroup) {
    const idx = favoriteGroup.indexOf(userId);
    if (idx !== -1) {
      favoriteGroup.splice(idx, 1);
    }
  }
  database.removeFriendFromLocalFavorites(userId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === userId) {
    favoriteStore.updateFavoriteDialog(userId);
  }
  const userDialog = userStore.userDialog;
  if (userDialog.visible && userDialog.id === userId) {
    userStore.setUserDialogIsFavorite(
      readFavoriteCachedRef(favoriteStore.getCachedFavoritesByObjectId(userId)) !== undefined || favoriteStore.isInAnyLocalFriendGroup(userId)
    );
  }
  friendStore.updateLocalFavoriteFriends();
}

export function deleteLocalFriendFavoriteGroup(group: string) {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const localFriendFavorites: LocalFavoriteGroups<string> = favoriteStore.localFriendFavorites;

  deleteGroup(localFriendFavorites, group);
  database.deleteFriendFavoriteGroup(group);
  const key = `local:${group}`;
  const friendGroups: string[] = generalSettingsStore.localFavoriteFriendsGroups;
  if (friendGroups.includes(key)) {
    generalSettingsStore.setLocalFavoriteFriendsGroups(friendGroups.filter((k) => k !== key));
  }
  friendStore.updateLocalFavoriteFriends();
}

export async function getLocalFriendFavorites() {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();

  const localFavorites = createGroupRecord<string>();

  const favorites = toUnknownList(await database.getFriendFavorites());
  for (const row of favorites) {
    if (!isFriendFavoriteRow(row)) {
      continue;
    }
    const groupEntries = localFavorites[row.groupName] ?? [];
    localFavorites[row.groupName] = groupEntries;
    groupEntries.unshift(row.userId);
  }

  if (Object.keys(localFavorites).length === 0) {
    localFavorites["Favorites"] = [];
  }

  replaceReactiveObject(favoriteStore.localFriendFavorites, localFavorites);
  friendStore.updateLocalFavoriteFriends();
}

export function renameLocalFriendFavoriteGroup(newName: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const { t } = i18n.global;
  if (favoriteStore.localFriendFavoriteGroups.includes(newName)) {
    toast.error(
      t("prompt.local_favorite_group_rename.message.error", {
        name: newName,
      })
    );
    return;
  }
  const localFriendFavorites: LocalFavoriteGroups<string> = favoriteStore.localFriendFavorites;
  localFriendFavorites[newName] = localFriendFavorites[group];
  deleteGroup(localFriendFavorites, group);
  database.renameFriendFavoriteGroup(newName, group);
  const oldKey = `local:${group}`;
  const friendGroups: string[] = generalSettingsStore.localFavoriteFriendsGroups;
  const idx = friendGroups.indexOf(oldKey);
  if (idx !== -1) {
    const updated = [...friendGroups];
    updated[idx] = `local:${newName}`;
    generalSettingsStore.setLocalFavoriteFriendsGroups(updated);
  }
}

export function saveSortFavoritesOption() {
  const appearanceSettingsStore = useAppearanceSettingsStore();
  void getLocalWorldFavorites().catch(logFavoriteError);
  void getLocalFriendFavorites().catch(logFavoriteError);
  appearanceSettingsStore.setSortFavorites();
}
