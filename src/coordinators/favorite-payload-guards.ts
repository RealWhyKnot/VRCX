export type FavoriteCachedRef = {
  id: string;
  type: string;
  favoriteId: string;
  tags: string[];
  $groupKey: string;
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

type FriendFavoriteRow = {
  groupName: string;
  userId: string;
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

export function readFavoriteCachedRef(value: unknown): FavoriteCachedRef | undefined {
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

export function readFavoriteObjectCtx(value: unknown): FavoriteObjectCtx | undefined {
  return isFavoriteObjectCtx(value) ? value : undefined;
}

export function readName(value: unknown): string | undefined {
  if (isRecord(value) && typeof value["name"] === "string") {
    return value["name"];
  }
  return undefined;
}

export function readDisplayName(value: unknown): string | undefined {
  if (isRecord(value) && typeof value["displayName"] === "string") {
    return value["displayName"];
  }
  return undefined;
}

export function isFriendFavoriteRow(value: unknown): value is FriendFavoriteRow {
  return isRecord(value) && typeof value["groupName"] === "string" && typeof value["userId"] === "string";
}

export function toUnknownList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isGroupRecord<T>(value: unknown): value is LocalFavoriteGroups<T> {
  return isRecord(value);
}

export function createGroupRecord<T>(): LocalFavoriteGroups<T> {
  const groups: unknown = Object.create(null);
  if (isGroupRecord<T>(groups)) {
    return groups;
  }
  return {};
}

export function deleteGroup<T>(groups: LocalFavoriteGroups<T>, group: string) {
  Reflect.deleteProperty(groups, group);
}

export function requireLocalFavoriteGroup<T>(groups: LocalFavoriteGroups<T>, group: string): T[] {
  const entries = groups[group];
  if (!entries) {
    throw new Error(`Local favorite group not found: ${group}`);
  }
  return entries;
}

export function logFavoriteError(err: unknown) {
  console.error(err);
}
