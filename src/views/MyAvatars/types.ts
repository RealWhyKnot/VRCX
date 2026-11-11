import type { AvatarRef } from "../../shared/utils/avatar-transforms";
import { getTagColor } from "../../shared/constants/tags";

export type AvatarTagRow = { tag: string | null; color: string | null };

export type AvatarTag = { tag: string; color: string | null };

export type MyAvatar = AvatarRef & { $tags?: AvatarTag[]; $timeSpent?: number };

export type AvatarContextAction =
  | "details"
  | "wear"
  | "makePrivate"
  | "makePublic"
  | "rename"
  | "changeDescription"
  | "createImpostor"
  | "changeImage"
  | "manageTags"
  | "changeTags"
  | "changeStyles";

export type AvatarTagSavePayload = { avatarId: string; tags: AvatarTag[] };

export function isAvatarTag(entry: AvatarTagRow): entry is AvatarTag {
  return entry.tag !== null;
}

export function toAvatarTagMap(source: ReadonlyMap<string | null, AvatarTagRow[]>): Map<string | null, AvatarTag[]> {
  const map = new Map<string | null, AvatarTag[]>();
  for (const [avatarId, entries] of source) {
    map.set(avatarId, entries.filter(isAvatarTag));
  }
  return map;
}

export function getAvatarTagColor(tag: string) {
  const color = getTagColor(tag);
  if (!color) {
    throw new Error(`No tag colour is defined for tag "${tag}"`);
  }
  return color;
}
