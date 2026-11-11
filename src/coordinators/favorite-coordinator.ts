import { toast } from "vue-sonner";
import { useFavoriteStore } from "../stores/favorite";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAvatarStore } from "../stores/avatar";
import { applyAvatar, toAvatarInput } from "./avatar-coordinator";
import { useFriendStore } from "../stores/friend";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { applyWorld, toWorldInput } from "./world-coordinator";
import { avatarRequest } from "../api/avatar";
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
import { handleFavorite, handleFavoriteAtDelete, refreshFavoriteItems, sortLocalAvatarFavorites, sortLocalWorldFavorites } from "./favorite-sync";

type LocalFavoriteCountResult = {
  total: number;
  invalid: number;
  invalidIds: string[];
};

type LocalFavoriteRemoveResult = {
  removed: number;
  removedIds: string[];
};

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

export function addLocalAvatarFavorite(avatarId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const avatarStore = useAvatarStore();

  if (favoriteStore.hasLocalAvatarFavorite(avatarId, group)) {
    return;
  }
  const ref = avatarStore.cachedAvatars.get(avatarId);
  if (ref === undefined) {
    return;
  }
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  localAvatarFavorites[group] ??= [];
  requireLocalFavoriteGroup(localAvatarFavorites, group).unshift(ref);
  database.addAvatarToCache(ref);
  database.addAvatarToFavorites(avatarId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === avatarId) {
    favoriteStore.updateFavoriteDialog(avatarId);
  }
  if (avatarStore.avatarDialog.visible && avatarStore.avatarDialog.id === avatarId) {
    avatarStore.setAvatarDialogIsFavorite(true);
  }

  sortLocalAvatarFavorites();
}

export function removeLocalAvatarFavorite(avatarId: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const avatarStore = useAvatarStore();
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  const avatarHistory: unknown[] = avatarStore.avatarHistory;

  const favoriteGroup = requireLocalFavoriteGroup(localAvatarFavorites, group);
  for (let i = 0; i < favoriteGroup.length; ++i) {
    if (favoriteGroup[i]?.id === avatarId) {
      favoriteGroup.splice(i, 1);
    }
  }

  let isAvatarInFavorites = false;
  for (const groupName of favoriteStore.localAvatarFavoriteGroups) {
    const groupEntries = localAvatarFavorites[groupName];
    if (!groupEntries || group === groupName) {
      continue;
    }
    for (const entry of groupEntries) {
      if (entry.id === avatarId) {
        isAvatarInFavorites = true;
        break;
      }
    }
  }
  if (!isAvatarInFavorites) {
    if (!avatarHistory.includes(avatarId)) {
      database.removeAvatarFromCache(avatarId);
    }
  }
  database.removeAvatarFromFavorites(avatarId, group);
  if (favoriteStore.favoriteDialog.visible && favoriteStore.favoriteDialog.objectId === avatarId) {
    favoriteStore.updateFavoriteDialog(avatarId);
  }
  if (avatarStore.avatarDialog.visible && avatarStore.avatarDialog.id === avatarId) {
    avatarStore.setAvatarDialogIsFavorite(readFavoriteCachedRef(favoriteStore.getCachedFavoritesByObjectId(avatarId)) !== undefined);
  }

  sortLocalAvatarFavorites();
}

export function deleteLocalAvatarFavoriteGroup(group: string) {
  const favoriteStore = useFavoriteStore();
  const avatarStore = useAvatarStore();
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  const avatarHistory: unknown[] = avatarStore.avatarHistory;

  const avatarIdRemoveList = new Set<string>();
  const favoriteGroup = requireLocalFavoriteGroup(localAvatarFavorites, group);
  for (const favorite of favoriteGroup) {
    avatarIdRemoveList.add(favorite.id);
  }

  deleteGroup(localAvatarFavorites, group);
  database.deleteAvatarFavoriteGroup(group);

  for (const groupName of favoriteStore.localAvatarFavoriteGroups) {
    const groupEntries = localAvatarFavorites[groupName];
    if (!groupEntries) {
      continue;
    }
    for (const entry of groupEntries) {
      if (avatarIdRemoveList.has(entry.id)) {
        avatarIdRemoveList.delete(entry.id);
        break;
      }
    }
  }

  avatarIdRemoveList.forEach((id) => {
    let isAvatarInFavorites = false;
    loop: for (const groupName of favoriteStore.localAvatarFavoriteGroups) {
      const groupEntries = localAvatarFavorites[groupName];
      if (!groupEntries || group === groupName) {
        continue loop;
      }
      for (const entry of groupEntries) {
        if (id === entry.id) {
          isAvatarInFavorites = true;
          break loop;
        }
      }
    }
    if (!isAvatarInFavorites) {
      if (!avatarHistory.includes(id)) {
        database.removeAvatarFromCache(id);
      }
    }
  });
}

export async function getLocalAvatarFavorites() {
  const favoriteStore = useFavoriteStore();
  const avatarStore = useAvatarStore();

  const localGroups = new Set<string>();
  const localFavorites = createGroupRecord<LocalFavoriteEntry>();

  const avatarCache = await database.getAvatarCache();
  for (const row of avatarCache) {
    if (row.id === null || avatarStore.cachedAvatars.has(row.id)) {
      continue;
    }
    applyAvatar(toAvatarInput(row, row.id));
  }

  const favorites = await database.getAvatarFavorites();
  for (const row of favorites) {
    if (row.groupName === null || row.avatarId === null) {
      continue;
    }
    localGroups.add(row.groupName);
    const groupEntries = localFavorites[row.groupName] ?? [];
    localFavorites[row.groupName] = groupEntries;

    const ref: LocalFavoriteEntry = avatarStore.cachedAvatars.get(row.avatarId) ?? { id: row.avatarId };
    groupEntries.unshift(ref);
  }

  if (localGroups.size === 0) {
    localFavorites["Favorites"] = [];
  }

  replaceReactiveObject(favoriteStore.localAvatarFavorites, localFavorites);

  sortLocalAvatarFavorites();
}

export function renameLocalAvatarFavoriteGroup(newName: string, group: string) {
  const favoriteStore = useFavoriteStore();
  const { t } = i18n.global;
  if (favoriteStore.localAvatarFavoriteGroups.includes(newName)) {
    toast.error(
      t("prompt.local_favorite_group_rename.message.error", {
        name: newName,
      })
    );
    return;
  }
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  localAvatarFavorites[newName] = localAvatarFavorites[group];

  deleteGroup(localAvatarFavorites, group);
  database.renameAvatarFavoriteGroup(newName, group);
  sortLocalAvatarFavorites();
}

export function newLocalAvatarFavoriteGroup(group: string) {
  const favoriteStore = useFavoriteStore();
  const { t } = i18n.global;
  if (favoriteStore.localAvatarFavoriteGroups.includes(group)) {
    toast.error(
      t("prompt.new_local_favorite_group.message.error", {
        name: group,
      })
    );
    return;
  }
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  localAvatarFavorites[group] ??= [];
  sortLocalAvatarFavorites();
}

export async function checkInvalidLocalAvatars(
  targetGroup: string | null = null,
  onProgress: ((current: number, total: number) => void) | null = null
): Promise<LocalFavoriteCountResult> {
  const favoriteStore = useFavoriteStore();
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  const result: LocalFavoriteCountResult = {
    total: 0,
    invalid: 0,
    invalidIds: [],
  };

  const groupsToCheck = targetGroup ? [targetGroup] : favoriteStore.localAvatarFavoriteGroups;

  for (const group of groupsToCheck) {
    const favoriteGroup = localAvatarFavorites[group];
    if (favoriteGroup && favoriteGroup.length > 0) {
      result.total += favoriteGroup.length;
    }
  }

  let currentIndex = 0;

  for (const group of groupsToCheck) {
    const favoriteGroup = localAvatarFavorites[group];
    if (!favoriteGroup || favoriteGroup.length === 0) {
      continue;
    }

    for (const favorite of favoriteGroup) {
      currentIndex++;

      if (typeof onProgress === "function") {
        onProgress(currentIndex, result.total);
      }

      try {
        await avatarRequest.getAvatar({
          avatarId: favorite.id,
        });
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
      } catch (err: unknown) {
        console.error(`Failed to fetch avatar ${favorite.id}:`, err);
        result.invalid++;
        result.invalidIds.push(favorite.id);
      }
    }
  }

  return result;
}

export function removeInvalidLocalAvatars(avatarIds: string[], targetGroup: string | null = null): Promise<LocalFavoriteRemoveResult> {
  const favoriteStore = useFavoriteStore();
  const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
  const result: LocalFavoriteRemoveResult = {
    removed: 0,
    removedIds: [],
  };

  const groupsToCheck = targetGroup ? [targetGroup] : favoriteStore.localAvatarFavoriteGroups;

  for (const group of groupsToCheck) {
    const favoriteGroup = localAvatarFavorites[group];
    if (!favoriteGroup) {
      continue;
    }

    for (const avatarId of avatarIds) {
      const index = favoriteGroup.findIndex((fav) => fav.id === avatarId);
      if (index !== -1) {
        removeLocalAvatarFavorite(avatarId, group);
        result.removed++;
        if (!result.removedIds.includes(avatarId)) {
          result.removedIds.push(avatarId);
        }
      }
    }
  }

  return Promise.resolve(result);
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
