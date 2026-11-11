import { toast } from "vue-sonner";
import { useFavoriteStore } from "../stores/favorite";
import { useAvatarStore } from "../stores/avatar";
import { applyAvatar, toAvatarInput } from "./avatar-coordinator";
import { avatarRequest } from "../api/avatar";
import { database } from "../services/database";
import { i18n } from "../plugins/i18n";
import { replaceReactiveObject } from "../shared/utils/base/array";
import type { LocalFavoriteEntry, LocalFavoriteGroups } from "./favorite-payload-guards";
import { createGroupRecord, deleteGroup, readFavoriteCachedRef, requireLocalFavoriteGroup } from "./favorite-payload-guards";
import { sortLocalAvatarFavorites } from "./favorite-sync";

type LocalFavoriteCountResult = {
  total: number;
  invalid: number;
  invalidIds: string[];
};

type LocalFavoriteRemoveResult = {
  removed: number;
  removedIds: string[];
};

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
