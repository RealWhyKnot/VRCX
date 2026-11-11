import type { Favorite } from "vrchat";
import { useFavoriteStore } from "../stores/favorite";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAvatarStore } from "../stores/avatar";
import { applyAvatar } from "./avatar-coordinator";
import { useFriendStore } from "../stores/friend";
import { useGeneralSettingsStore } from "../stores/settings/general";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { rebuildFavoriteSearchIndex } from "./search-index-coordinator";
import { runUpdateFriendFlow } from "./friend-presence-coordinator";
import { favoriteRequest } from "../api/favorite";
import { database } from "../services/database";
import { processBulk } from "../services/request";
import { compareByName } from "../shared/utils/compare";
import { createDefaultFavoriteCachedRef } from "../shared/utils/entity-transforms";
import { removeFromArray } from "../shared/utils/base/array";
import type { Json } from "../types/vrcx";
import type { FavoriteCachedRef, FavoriteObjectCtx, LocalFavoriteEntry, LocalFavoriteGroups } from "./favorite-payload-guards";
import { logFavoriteError, readDisplayName, readFavoriteCachedRef, readFavoriteObjectCtx, readName } from "./favorite-payload-guards";
import { getLocalFriendFavorites, getLocalWorldFavorites, handleFavoriteWorldList, refreshFavorites } from "./favorite-coordinator";
import { getLocalAvatarFavorites } from "./favorite-local-avatars";

export type FavoriteWorldPage = Awaited<ReturnType<typeof favoriteRequest.getFavoriteWorlds>>;

type FavoriteAvatarPage = Awaited<ReturnType<typeof favoriteRequest.getFavoriteAvatars>>;

export type FavoritePageParams = Parameters<typeof favoriteRequest.getFavorites>[0];

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
