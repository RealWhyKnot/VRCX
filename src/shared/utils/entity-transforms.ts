import type { FavoriteGroup } from "vrchat";

import { replaceBioSymbols } from "./base/string";

type FavoriteCachedRef = {
  id: string;
  type: string;
  favoriteId: string;
  tags: string[];
  $groupKey: string;
};

export function sanitizeEntityJson(json: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    if (json[field]) {
      json[field] = replaceBioSymbols(json[field]);
    }
  }
  return json;
}

export function createDefaultFavoriteGroupRef(json: Partial<FavoriteGroup>) {
  return {
    id: "",
    ownerId: "",
    ownerDisplayName: "",
    name: "",
    displayName: "",
    type: "",
    visibility: "",
    tags: [],
    ...json,
  };
}

export function createDefaultFavoriteCachedRef(json: Partial<FavoriteCachedRef>) {
  const ref: FavoriteCachedRef = {
    id: "",
    type: "",
    favoriteId: "",
    tags: [],

    $groupKey: "",

    ...json,
  };
  ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
  return ref;
}
