import type { FavoriteGroup } from "vrchat";

import type { Json } from "../types/vrcx";

export type FavoriteTypeCounts = {
  avatar: number;
  friend: number;
  vrcPlusWorld: number;
  world: number;
};

export type FavoriteLimits = {
  maxFavoriteGroups: FavoriteTypeCounts;
  maxFavoritesPerGroup: FavoriteTypeCounts;
};

export type FavoriteCachedRef = {
  id: string;
  type: string;
  favoriteId: string;
  tags: string[];
  $groupKey: string;
};

export type FavoriteGroupRef = {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  name: string;
  displayName: string;
  type: string;
  visibility: string;
  tags: string[];
};

export type FavoriteGroupSlot = {
  assign: boolean;
  key: string;
  type: string;
  name: string;
  displayName: string;
  capacity: number;
  count: number;
  visibility: string;
};

export type FavoriteObjectCtx = {
  id: string;
  type: string;
  groupKey: string;
  ref: unknown;
  name: string;
  deleted?: boolean;
};

export type LocalFavoriteEntry = {
  id: string;
};

export type LocalFavoriteGroups<T> = Record<string, T[] | undefined>;

export type FavoriteDialog = {
  visible: boolean;
  loading: boolean;
  type: string;
  objectId: string;
  currentGroup: Partial<FavoriteGroupSlot>;
};

export type FavoriteState = {
  favoriteObjects: Map<string, FavoriteObjectCtx>;
  favoriteFriends_: FavoriteObjectCtx[];
  favoriteWorlds_: FavoriteObjectCtx[];
  favoriteAvatars_: FavoriteObjectCtx[];
};

export type FavoriteGroupHandleArgs = {
  json: Json<FavoriteGroup>;
  ref?: FavoriteGroupRef | undefined;
  params: {
    favoriteGroupId: string;
  };
};
