import type { FavoriteObjectCtx, LocalFavoriteEntry } from "../../stores/favorite-types";

type WorldFavoriteDetails = {
  name?: string | null;
  authorName?: string | null;
  thumbnailImageUrl?: string | null;
  releaseStatus?: string | null;
  occupants?: number | null;
};

export type WorldFavoriteEntry = WorldFavoriteDetails & {
  id: string;
  deleted?: boolean;
  ref?: WorldFavoriteDetails | null;
};

export type WorldSearchEntry = {
  id: string;
  name: string;
  authorName?: string | null;
  tags?: string[];
};

export const worldGroupVisibilityOptions = ["public", "friends", "private"] as const;
export type WorldGroupVisibility = (typeof worldGroupVisibilityOptions)[number];

function isWorldRecord(value: unknown): value is WorldFavoriteEntry {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

export function isWorldSearchEntry(value: unknown): value is WorldSearchEntry {
  return typeof value === "object" && value !== null && "id" in value && "name" in value && typeof value.id === "string" && typeof value.name === "string";
}

export function toWorldFavoriteEntry(favorite: FavoriteObjectCtx): WorldFavoriteEntry {
  return {
    id: favorite.id,
    name: favorite.name,
    deleted: favorite.deleted ?? false,
    ref: isWorldRecord(favorite.ref) ? favorite.ref : null,
  };
}

export function toLocalWorldEntry(entry: LocalFavoriteEntry): WorldFavoriteEntry {
  return isWorldRecord(entry) ? entry : { id: entry.id };
}
