import type { FavoriteObjectCtx } from "../../stores/favorite-types";

export type AvatarFavoriteDetails = {
  id: string;
  name?: string | null;
  authorName?: string | null;
  thumbnailImageUrl?: string | null;
  releaseStatus?: string | null;
};

export type AvatarFavoriteEntry = {
  id: string;
  name?: string | null;
  deleted?: boolean;
  ref?: AvatarFavoriteDetails | null;
};

export type AvatarSearchEntry = {
  id: string;
  name: string;
  authorName: string;
  thumbnailImageUrl?: string | null | undefined;
};

export function isAvatarFavoriteDetails(value: unknown): value is AvatarFavoriteDetails {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

export function isAvatarSearchEntry(value: unknown): value is AvatarSearchEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "authorName" in value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.authorName === "string"
  );
}

export function toAvatarFavoriteEntry(favorite: FavoriteObjectCtx): AvatarFavoriteEntry {
  return {
    id: favorite.id,
    name: favorite.name,
    deleted: favorite.deleted ?? false,
    ref: isAvatarFavoriteDetails(favorite.ref) ? favorite.ref : null,
  };
}

export const avatarGroupVisibilityOptions = ["public", "friends", "private"] as const;
export type AvatarGroupVisibility = (typeof avatarGroupVisibilityOptions)[number];
