import { replaceBioSymbols } from "./base/string";

export function sanitizeEntityJson(json, fields) {
  for (const field of fields) {
    if (json[field]) {
      json[field] = replaceBioSymbols(json[field]);
    }
  }
  return json;
}

export function createDefaultFavoriteGroupRef(json) {
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

export function createDefaultFavoriteCachedRef(json) {
  const ref = {
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
