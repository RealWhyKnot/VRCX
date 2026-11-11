import { localeIncludes } from "./base/string";
import { removeConfusables, removeWhitespace } from "../../services/confusables";

type Comparer = { compare(a: string, b: string): number };

function stripWhitespace(value: string): string {
  const cleaned: unknown = removeWhitespace(value);
  return typeof cleaned === "string" ? cleaned : "";
}

function stripConfusables(value: string): string {
  const cleaned: unknown = removeConfusables(value);
  return typeof cleaned === "string" ? cleaned : value;
}

type FriendRefLike = {
  $memo?: string | null;
  note?: string | null;
  currentAvatarThumbnailImageUrl?: string | null;
};

type FriendContext = {
  id: string;
  name: string;
  ref?: FriendRefLike;
};

type EntityRefLike = {
  id: string;
  name?: string | null;
  authorId?: string | null;
  ownerId?: string | null;
  thumbnailImageUrl?: string | null;
  imageUrl?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
};

type FavoriteContext = {
  ref?: EntityRefLike;
};

type FriendSearchResult = {
  id: string;
  name: string;
  type: "friend";
  imageUrl: string | null | undefined;
  memo: string;
  note: string;
  matchedField: "name" | "memo" | "note" | null;
  ref: FriendRefLike;
};

type EntitySearchResult = {
  id: string;
  name: string;
  type: "avatar" | "world" | "group";
  imageUrl: string | null | undefined;
};

export function matchName(name: string | null | undefined, query: string | null | undefined, comparer: Comparer): boolean {
  if (!name || !query) {
    return false;
  }
  const cleanQuery = stripWhitespace(query);
  if (!cleanQuery) {
    return false;
  }
  const cleanName = stripConfusables(name);
  if (localeIncludes(cleanName, cleanQuery, comparer)) {
    return true;
  }

  return localeIncludes(name, cleanQuery, comparer);
}

export function isPrefixMatch(name: string | null | undefined, query: string | null | undefined, comparer: Comparer): boolean {
  if (!name || !query) {
    return false;
  }
  const cleanQuery = stripWhitespace(query);
  if (!cleanQuery) {
    return false;
  }
  return comparer.compare(name.substring(0, cleanQuery.length), cleanQuery) === 0;
}

export function searchFriends(
  query: string | null | undefined,
  friends: Map<string, FriendContext> | null | undefined,
  comparer: Comparer,
  limit = 10
): FriendSearchResult[] {
  if (!query || !friends) {
    return [];
  }
  const results: FriendSearchResult[] = [];
  for (const ctx of friends.values()) {
    if (typeof ctx.ref === "undefined") {
      continue;
    }
    let isMatch = matchName(ctx.name, query, comparer);
    let matchedField: FriendSearchResult["matchedField"] = isMatch ? "name" : null;

    if (!isMatch && ctx.ref.$memo && query.length >= 2) {
      isMatch = localeIncludes(ctx.ref.$memo, query, comparer);
      if (isMatch) matchedField = "memo";
    }
    if (!isMatch && ctx.ref.note && query.length >= 2) {
      isMatch = localeIncludes(ctx.ref.note, query, comparer);
      if (isMatch) matchedField = "note";
    }
    if (isMatch) {
      results.push({
        id: ctx.id,
        name: ctx.name,
        type: "friend",
        imageUrl: ctx.ref.currentAvatarThumbnailImageUrl,
        memo: ctx.ref.$memo ?? "",
        note: ctx.ref.note ?? "",
        matchedField,
        ref: ctx.ref,
      });
    }
  }

  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchAvatars(
  query: string | null | undefined,
  avatarMap: Map<string, EntityRefLike> | null | undefined,
  comparer: Comparer,
  authorId: string | null = null,
  limit = 10
): EntitySearchResult[] {
  if (!query || !avatarMap) {
    return [];
  }
  const results: EntitySearchResult[] = [];
  for (const ref of avatarMap.values()) {
    if (!ref.name) {
      continue;
    }
    if (authorId && ref.authorId !== authorId) {
      continue;
    }
    if (matchName(ref.name, query, comparer)) {
      results.push({
        id: ref.id,
        name: ref.name,
        type: "avatar",
        imageUrl: ref.thumbnailImageUrl ?? ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchWorlds(
  query: string | null | undefined,
  worldMap: Map<string, EntityRefLike> | null | undefined,
  comparer: Comparer,
  ownerId: string | null = null,
  limit = 10
): EntitySearchResult[] {
  if (!query || !worldMap) {
    return [];
  }
  const results: EntitySearchResult[] = [];
  for (const ref of worldMap.values()) {
    if (!ref.name) {
      continue;
    }
    if (ownerId && ref.authorId !== ownerId) {
      continue;
    }
    if (matchName(ref.name, query, comparer)) {
      results.push({
        id: ref.id,
        name: ref.name,
        type: "world",
        imageUrl: ref.thumbnailImageUrl ?? ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchGroups(
  query: string | null | undefined,
  groupMap: Map<string, EntityRefLike> | null | undefined,
  comparer: Comparer,
  ownerId: string | null = null,
  limit = 10
): EntitySearchResult[] {
  if (!query || !groupMap) {
    return [];
  }
  const results: EntitySearchResult[] = [];
  for (const ref of groupMap.values()) {
    if (!ref.name) {
      continue;
    }
    if (ownerId && ref.ownerId !== ownerId) {
      continue;
    }
    if (matchName(ref.name, query, comparer)) {
      results.push({
        id: ref.id,
        name: ref.name,
        type: "group",
        imageUrl: ref.iconUrl ?? ref.bannerUrl,
      });
    }
  }
  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchFavoriteAvatars(
  query: string | null | undefined,
  favoriteAvatars: FavoriteContext[] | null | undefined,
  comparer: Comparer,
  limit = 10
): EntitySearchResult[] {
  if (!query || !favoriteAvatars) {
    return [];
  }
  const results: EntitySearchResult[] = [];
  for (const ctx of favoriteAvatars) {
    if (!ctx.ref?.name) {
      continue;
    }
    if (matchName(ctx.ref.name, query, comparer)) {
      results.push({
        id: ctx.ref.id,
        name: ctx.ref.name,
        type: "avatar",
        imageUrl: ctx.ref.thumbnailImageUrl ?? ctx.ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchFavoriteWorlds(
  query: string | null | undefined,
  favoriteWorlds: FavoriteContext[] | null | undefined,
  comparer: Comparer,
  limit = 10
): EntitySearchResult[] {
  if (!query || !favoriteWorlds) {
    return [];
  }
  const results: EntitySearchResult[] = [];
  for (const ctx of favoriteWorlds) {
    if (!ctx.ref?.name) {
      continue;
    }
    if (matchName(ctx.ref.name, query, comparer)) {
      results.push({
        id: ctx.ref.id,
        name: ctx.ref.name,
        type: "world",
        imageUrl: ctx.ref.thumbnailImageUrl ?? ctx.ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const isAPrefix = isPrefixMatch(a.name, query, comparer);
    const isBPrefix = isPrefixMatch(b.name, query, comparer);
    if (isAPrefix && !isBPrefix) return -1;
    if (isBPrefix && !isAPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}
