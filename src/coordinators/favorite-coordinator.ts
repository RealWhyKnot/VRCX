import { toast } from "vue-sonner";
import type { Favorite } from "vrchat";
import { useFavoriteStore } from "../stores/favorite";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAvatarStore } from "../stores/avatar";
import { applyAvatar, toAvatarInput } from "./avatar-coordinator";
import { useFriendStore } from "../stores/friend";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { rebuildFavoriteSearchIndex } from "./search-index-coordinator";
import { applyWorld, toWorldInput } from "./world-coordinator";
import { runUpdateFriendFlow } from "./friend-presence-coordinator";
import { avatarRequest } from "../api/avatar";
import { favoriteRequest } from "../api/favorite";
import { queryRequest } from "../api/query-request";
import { database } from "../services/database";
import { i18n } from "../plugins/i18n";
import { processBulk } from "../services/request";
import { watchState } from "../services/watch-state";
import { compareByName } from "../shared/utils/compare";
import { createDefaultFavoriteCachedRef } from "../shared/utils/entity-transforms";
import { removeFromArray, replaceReactiveObject } from "../shared/utils/base/array";
import type { Json } from "../types/vrcx";

type FavoriteCachedRef = {
  id: string;
  type: string;
  favoriteId: string;
  tags: string[];
  $groupKey: string;
};

type FavoriteObjectCtx = {
  id: string;
  type: string;
  groupKey: string;
  ref: unknown;
  name: string;
  deleted?: boolean;
};

type LocalFavoriteEntry = {
  id: string;
};

type LocalFavoriteGroups<T> = Record<string, T[] | undefined>;

type FriendFavoriteRow = {
  groupName: string;
  userId: string;
};

type FavoriteWorldPage = Awaited<ReturnType<typeof favoriteRequest.getFavoriteWorlds>>;
type FavoriteAvatarPage = Awaited<ReturnType<typeof favoriteRequest.getFavoriteAvatars>>;
type FavoritePageParams = Parameters<typeof favoriteRequest.getFavorites>[0];
type FavoriteWorldPageParams = Parameters<typeof favoriteRequest.getFavoriteWorlds>[0];
type FavoriteAvatarPageParams = NonNullable<Parameters<typeof favoriteRequest.getFavoriteAvatars>[0]>;

type FavoriteHandleArgs = {
  json: Json<Favorite>;
  ref?: FavoriteCachedRef | undefined;
};

type FavoriteAddArgs = {
  json: Json<Favorite>;
  params: {
    favoriteId: string;
    type: string;
    tags: string;
  };
};

type FavoriteGroupClearArgs = {
  params: {
    type: string;
    group: string;
  };
};

type LocalFavoriteCountResult = {
  total: number;
  invalid: number;
  invalidIds: string[];
};

type LocalFavoriteRemoveResult = {
  removed: number;
  removedIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFavoriteCachedRef(value: unknown): value is FavoriteCachedRef {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["type"] === "string" &&
    typeof value["favoriteId"] === "string" &&
    Array.isArray(value["tags"]) &&
    value["tags"].every((tag) => typeof tag === "string") &&
    typeof value["$groupKey"] === "string"
  );
}

function readFavoriteCachedRef(value: unknown): FavoriteCachedRef | undefined {
  return isFavoriteCachedRef(value) ? value : undefined;
}

function isFavoriteObjectCtx(value: unknown): value is FavoriteObjectCtx {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["type"] === "string" &&
    typeof value["groupKey"] === "string" &&
    typeof value["name"] === "string" &&
    (value["deleted"] === undefined || typeof value["deleted"] === "boolean")
  );
}

function readFavoriteObjectCtx(value: unknown): FavoriteObjectCtx | undefined {
  return isFavoriteObjectCtx(value) ? value : undefined;
}

function readName(value: unknown): string | undefined {
  if (isRecord(value) && typeof value["name"] === "string") {
    return value["name"];
  }
  return undefined;
}

function readDisplayName(value: unknown): string | undefined {
  if (isRecord(value) && typeof value["displayName"] === "string") {
    return value["displayName"];
  }
  return undefined;
}

function isFriendFavoriteRow(value: unknown): value is FriendFavoriteRow {
  return isRecord(value) && typeof value["groupName"] === "string" && typeof value["userId"] === "string";
}

function toUnknownList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isGroupRecord<T>(value: unknown): value is LocalFavoriteGroups<T> {
  return isRecord(value);
}

function createGroupRecord<T>(): LocalFavoriteGroups<T> {
  const groups: unknown = Object.create(null);
  if (isGroupRecord<T>(groups)) {
    return groups;
  }
  return {};
}

function deleteGroup<T>(groups: LocalFavoriteGroups<T>, group: string) {
  Reflect.deleteProperty(groups, group);
}

function requireLocalFavoriteGroup<T>(groups: LocalFavoriteGroups<T>, group: string): T[] {
  const entries = groups[group];
  if (!entries) {
    throw new Error(`Local favorite group not found: ${group}`);
  }
  return entries;
}

function logFavoriteError(err: unknown) {
  console.error(err);
}

export function handleFavorite(args: FavoriteHandleArgs) {
  const userStore = useUserStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();

  const ref = applyFavoriteCached(args.json);
  args.ref = ref;
  void applyFavorite(ref.type, ref.favoriteId).catch(logFavoriteError);
  void runUpdateFriendFlow(ref.favoriteId).catch(logFavoriteError);
  const userDialog = userStore.userDialog;
  if (userDialog.visible && ref.favoriteId === userDialog.id) {
    userStore.setUserDialogIsFavorite(true);
  }
  const worldDialog = worldStore.worldDialog;
  if (worldDialog.visible && ref.favoriteId === worldDialog.id) {
    worldStore.setWorldDialogIsFavorite(true);
  }
  const avatarDialog = avatarStore.avatarDialog;
  if (avatarDialog.visible && ref.favoriteId === avatarDialog.id) {
    avatarStore.setAvatarDialogIsFavorite(true);
  }
}

export function handleFavoriteAdd(args: FavoriteAddArgs) {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();
  const avatarStore = useAvatarStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const sortOrder: string[] = favoriteStore.favoritesSortOrder;
  const friendGroups: string[] = generalSettingsStore.localFavoriteFriendsGroups;

  handleFavorite({
    json: args.json,
  });
  if (!sortOrder.includes(args.params.favoriteId)) {
    sortOrder.unshift(args.params.favoriteId);
  }

  if (args.params.type === "avatar" && !avatarStore.cachedAvatars.has(args.params.favoriteId)) {
    void refreshFavoriteAvatars(args.params.tags).catch(logFavoriteError);
  }

  if (args.params.type === "friend" && (!friendGroups.some((key) => !key.startsWith("local:")) || friendGroups.includes("friend:" + args.params.tags))) {
    friendStore.updateLocalFavoriteFriends();
  }
  favoriteStore.updateFavoriteDialog(args.params.favoriteId);
}

export function handleFavoriteAtDelete(ref: FavoriteCachedRef) {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();

  const favorite = readFavoriteObjectCtx(favoriteStore.state.favoriteObjects.get(ref.favoriteId));
  const favoriteFriends: FavoriteObjectCtx[] = favoriteStore.state.favoriteFriends_;
  const favoriteWorlds: FavoriteObjectCtx[] = favoriteStore.state.favoriteWorlds_;
  const favoriteAvatars: FavoriteObjectCtx[] = favoriteStore.state.favoriteAvatars_;
  const sortOrder: string[] = favoriteStore.favoritesSortOrder;
  if (favorite !== undefined) {
    removeFromArray(favoriteFriends, favorite);
    removeFromArray(favoriteWorlds, favorite);
    removeFromArray(favoriteAvatars, favorite);
  }
  favoriteStore.cachedFavorites.delete(ref.id);
  favoriteStore.cachedFavoritesByObjectId.delete(ref.favoriteId);
  favoriteStore.state.favoriteObjects.delete(ref.favoriteId);
  friendStore.localFavoriteFriends.delete(ref.favoriteId);
  favoriteStore.setFavoritesSortOrder(sortOrder.filter((id) => id !== ref.favoriteId));

  void runUpdateFriendFlow(ref.favoriteId).catch(logFavoriteError);
  friendStore.updateSidebarFavorites();
  const userDialog = userStore.userDialog;
  if (userDialog.visible && userDialog.id === ref.favoriteId) {
    userStore.setUserDialogIsFavorite(false);
  }
  const worldDialog = worldStore.worldDialog;
  if (worldDialog.visible && worldDialog.id === ref.favoriteId) {
    worldStore.setWorldDialogIsFavorite(favoriteStore.localWorldFavoritesList.includes(worldDialog.id));
  }
  const avatarDialog = avatarStore.avatarDialog;
  if (avatarDialog.visible && avatarDialog.id === ref.favoriteId) {
    avatarStore.setAvatarDialogIsFavorite(false);
  }
  favoriteStore.countFavoriteGroups();
  rebuildFavoriteSearchIndex();
}

export function handleFavoriteDelete(objectId: string) {
  const favoriteStore = useFavoriteStore();
  const ref = readFavoriteCachedRef(favoriteStore.getCachedFavoritesByObjectId(objectId));
  if (typeof ref === "undefined") {
    return;
  }
  handleFavoriteAtDelete(ref);
}

export function handleFavoriteGroupClear(args: FavoriteGroupClearArgs) {
  const favoriteStore = useFavoriteStore();
  const key = `${args.params.type}:${args.params.group}`;
  for (const value of favoriteStore.cachedFavorites.values()) {
    const ref = readFavoriteCachedRef(value);
    if (ref?.$groupKey !== key) {
      continue;
    }
    handleFavoriteAtDelete(ref);
  }
}

export function handleFavoriteWorldList(args: FavoriteWorldPage) {
  for (const json of args.json) {
    if (json.id === "???") {
      continue;
    }
    applyWorld(json);
  }
}

export function handleFavoriteAvatarList(args: FavoriteAvatarPage) {
  for (const json of args.json) {
    if (json.releaseStatus === "hidden") {
      continue;
    }
    applyAvatar(json);
  }
}

export function applyFavoriteCached(json: Json<Favorite>): FavoriteCachedRef {
  const favoriteStore = useFavoriteStore();
  const friendStore = useFriendStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const groups: string[] = generalSettingsStore.localFavoriteFriendsGroups;
  let ref = readFavoriteCachedRef(favoriteStore.cachedFavorites.get(json.id));
  if (typeof ref === "undefined") {
    ref = createDefaultFavoriteCachedRef(json);
    const oldEntry = readFavoriteCachedRef(favoriteStore.cachedFavoritesByObjectId.get(ref.favoriteId));
    if (oldEntry && oldEntry.id !== ref.id) {
      favoriteStore.cachedFavorites.delete(oldEntry.id);
    }
    favoriteStore.cachedFavorites.set(ref.id, ref);
    favoriteStore.cachedFavoritesByObjectId.set(ref.favoriteId, ref);
    if (ref.type === "friend" && (groups.length === 0 || groups.includes(ref.$groupKey))) {
      friendStore.localFavoriteFriends.add(ref.favoriteId);
      friendStore.updateSidebarFavorites();
    }
    if (!favoriteStore.isFavoriteLoading) {
      favoriteStore.countFavoriteGroups();
    }
  } else {
    if (ref.favoriteId !== json.favoriteId) {
      favoriteStore.cachedFavoritesByObjectId.delete(ref.favoriteId);
    }
    Object.assign(ref, json);
    ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
    favoriteStore.cachedFavoritesByObjectId.set(ref.favoriteId, ref);
  }

  return ref;
}

export async function applyFavorite(type: string, objectId: string) {
  const favoriteStore = useFavoriteStore();
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();
  const favoriteFriends: FavoriteObjectCtx[] = favoriteStore.state.favoriteFriends_;
  const favoriteWorlds: FavoriteObjectCtx[] = favoriteStore.state.favoriteWorlds_;
  const favoriteAvatars: FavoriteObjectCtx[] = favoriteStore.state.favoriteAvatars_;

  const favorite = readFavoriteCachedRef(favoriteStore.getCachedFavoritesByObjectId(objectId));
  let ctx = readFavoriteObjectCtx(favoriteStore.state.favoriteObjects.get(objectId));
  if (typeof favorite !== "undefined") {
    let isTypeChanged = false;
    if (typeof ctx === "undefined") {
      ctx = {
        id: objectId,
        type,
        groupKey: favorite.$groupKey,
        ref: null,
        name: "",
      };
      if (type === "friend") {
        const user: unknown = userStore.cachedUsers.get(objectId);
        if (typeof user === "undefined") {
          const friendEntry: unknown = friendStore.friendLog.get(objectId);
          const displayName = readDisplayName(friendEntry);
          if (typeof displayName !== "undefined" && displayName) {
            ctx.name = displayName;
          }
        } else {
          ctx.ref = user;
          ctx.name = readDisplayName(user) ?? "";
        }
      } else if (type === "world" || type === "vrcPlusWorld") {
        const world: unknown = worldStore.cachedWorlds.get(objectId);
        if (typeof world !== "undefined") {
          ctx.ref = world;
          ctx.name = readName(world) ?? "";
        }
      } else if (type === "avatar") {
        const avatar: unknown = avatarStore.cachedAvatars.get(objectId);
        if (typeof avatar !== "undefined") {
          ctx.ref = avatar;
          ctx.name = readName(avatar) ?? "";
        }
      }
      favoriteStore.state.favoriteObjects.set(objectId, ctx);
      isTypeChanged = true;
    } else {
      if (ctx.type !== type) {
        isTypeChanged = true;
        if (type === "friend") {
          removeFromArray(favoriteFriends, ctx);
        } else if (type === "world" || type === "vrcPlusWorld") {
          removeFromArray(favoriteWorlds, ctx);
        } else if (type === "avatar") {
          removeFromArray(favoriteAvatars, ctx);
        }
      }
      ctx.groupKey = favorite.$groupKey;
      if (type === "friend") {
        const user: unknown = userStore.cachedUsers.get(objectId);
        if (typeof user !== "undefined") {
          if (ctx.ref !== user) {
            ctx.ref = user;
          }
          const displayName = readDisplayName(user) ?? "";
          if (ctx.name !== displayName) {
            ctx.name = displayName;
          }
        }
      } else if (type === "world" || type === "vrcPlusWorld") {
        const world: unknown = worldStore.cachedWorlds.get(objectId);
        if (typeof world !== "undefined") {
          if (ctx.ref !== world) {
            ctx.ref = world;
          }
          const name = readName(world) ?? "";
          if (ctx.name !== name) {
            ctx.name = name;
          }
        } else {
          const cachedWorld: unknown = await database.getCachedWorldById(objectId);
          if (cachedWorld) {
            ctx.ref = cachedWorld;
            ctx.name = readName(cachedWorld) ?? "";
            ctx.deleted = true;
          }
          if (!cachedWorld) {
            const worldName = await database.getGameLogWorldNameByWorldId(objectId);
            if (worldName) {
              ctx.name = worldName;
              ctx.deleted = true;
            }
          }
        }
      } else if (type === "avatar") {
        const avatar: unknown = avatarStore.cachedAvatars.get(objectId);
        if (typeof avatar !== "undefined") {
          if (ctx.ref !== avatar) {
            ctx.ref = avatar;
          }
          const name = readName(avatar) ?? "";
          if (ctx.name !== name) {
            ctx.name = name;
          }
        } else {
          const cachedAvatar: unknown = await database.getCachedAvatarById(objectId);
          if (cachedAvatar) {
            ctx.ref = cachedAvatar;
            ctx.name = readName(cachedAvatar) ?? "";
            ctx.deleted = true;
          }
        }
      }
    }
    if (isTypeChanged) {
      if (type === "friend") {
        favoriteFriends.push(ctx);
      } else if (type === "world" || type === "vrcPlusWorld") {
        favoriteWorlds.push(ctx);
      } else if (type === "avatar") {
        favoriteAvatars.push(ctx);
      }
    }
  }
  rebuildFavoriteSearchIndex();
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

function favoriteAvatarPageParams(tag: string | undefined): FavoriteAvatarPageParams {
  return tag === undefined ? { n: 300, offset: 0 } : { n: 300, offset: 0, tag };
}

export async function refreshFavoriteAvatars(tag: string | undefined) {
  const args = await favoriteRequest.getFavoriteAvatars(favoriteAvatarPageParams(tag));
  handleFavoriteAvatarList(args);
}

export function refreshFavoriteItems() {
  const favoriteStore = useFavoriteStore();
  const counts = { world: 0, avatar: 0 };
  const tags: (string | undefined)[] = [];
  for (const value of favoriteStore.cachedFavorites.values()) {
    const ref = readFavoriteCachedRef(value);
    if (!ref || (ref.type !== "world" && ref.type !== "avatar")) {
      continue;
    }
    if (ref.type === "avatar" && !tags.includes(ref.tags[0])) {
      tags.push(ref.tags[0]);
    }
    counts[ref.type]++;
  }
  if (counts.world > 0) {
    processBulk({
      fn: (params: FavoriteWorldPageParams) => favoriteRequest.getFavoriteWorlds(params),
      N: counts.world,
      handle: (args: FavoriteWorldPage) => handleFavoriteWorldList(args),
      params: {
        n: 300,
        offset: 0,
      },
    }).catch(logFavoriteError);
  }
  if (counts.avatar > 0) {
    for (const tag of tags) {
      processBulk({
        fn: (params: FavoriteAvatarPageParams) => favoriteRequest.getFavoriteAvatars(params),
        N: counts.avatar,
        handle: (args: FavoriteAvatarPage) => handleFavoriteAvatarList(args),
        params: favoriteAvatarPageParams(tag),
      }).catch(logFavoriteError);
    }
  }
}

export function sortLocalAvatarFavorites() {
  const favoriteStore = useFavoriteStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  if (!appearanceSettingsStore.sortFavorites) {
    const localAvatarFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localAvatarFavorites;
    for (const group of favoriteStore.localAvatarFavoriteGroups) {
      localAvatarFavorites[group]?.sort(compareByName);
    }
  }
}

export function sortLocalWorldFavorites() {
  const favoriteStore = useFavoriteStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  if (!appearanceSettingsStore.sortFavorites) {
    const localWorldFavorites: LocalFavoriteGroups<LocalFavoriteEntry> = favoriteStore.localWorldFavorites;
    for (const group of favoriteStore.localWorldFavoriteGroups) {
      localWorldFavorites[group]?.sort(compareByName);
    }
  }
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

export function initFavorites() {
  refreshFavorites();
  void getLocalWorldFavorites().catch(logFavoriteError);
  void getLocalAvatarFavorites().catch(logFavoriteError);
  void getLocalFriendFavorites().catch(logFavoriteError);
}

export function onLoginStateChanged(isLoggedIn: boolean) {
  const friendStore = useFriendStore();
  friendStore.localFavoriteFriends.clear();
  if (isLoggedIn) {
    initFavorites();
  } else {
    rebuildFavoriteSearchIndex();
  }
}
