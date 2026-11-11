import { localeIncludes } from "./base/string";
import { removeConfusables, removeWhitespace } from "../../services/confusables";

export function matchName(name, query, comparer) {
  if (!name || !query) {
    return false;
  }
  const cleanQuery = removeWhitespace(query);
  if (!cleanQuery) {
    return false;
  }
  const cleanName = removeConfusables(name);
  if (localeIncludes(cleanName, cleanQuery, comparer)) {
    return true;
  }

  return localeIncludes(name, cleanQuery, comparer);
}

export function isPrefixMatch(name, query, comparer) {
  if (!name || !query) {
    return false;
  }
  const cleanQuery = removeWhitespace(query);
  if (!cleanQuery) {
    return false;
  }
  return comparer.compare(name.substring(0, cleanQuery.length), cleanQuery) === 0;
}

export function searchFriends(query, friends, comparer, limit = 10) {
  if (!query || !friends) {
    return [];
  }
  const results = [];
  for (const ctx of friends.values()) {
    if (typeof ctx.ref === "undefined") {
      continue;
    }
    let match = matchName(ctx.name, query, comparer);
    let matchedField = match ? "name" : null;

    if (!match && ctx.ref.$memo && query.length >= 2) {
      match = localeIncludes(ctx.ref.$memo, query, comparer);
      if (match) matchedField = "memo";
    }
    if (!match && ctx.ref.note && query.length >= 2) {
      match = localeIncludes(ctx.ref.note, query, comparer);
      if (match) matchedField = "note";
    }
    if (match) {
      results.push({
        id: ctx.id,
        name: ctx.name,
        type: "friend",
        imageUrl: ctx.ref.currentAvatarThumbnailImageUrl,
        memo: ctx.ref.$memo || "",
        note: ctx.ref.note || "",
        matchedField,
        ref: ctx.ref,
      });
    }
  }

  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchAvatars(query, avatarMap, comparer, authorId = null, limit = 10) {
  if (!query || !avatarMap) {
    return [];
  }
  const results = [];
  for (const ref of avatarMap.values()) {
    if (!ref || !ref.name) {
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
        imageUrl: ref.thumbnailImageUrl || ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchWorlds(query, worldMap, comparer, ownerId = null, limit = 10) {
  if (!query || !worldMap) {
    return [];
  }
  const results = [];
  for (const ref of worldMap.values()) {
    if (!ref || !ref.name) {
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
        imageUrl: ref.thumbnailImageUrl || ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchGroups(query, groupMap, comparer, ownerId = null, limit = 10) {
  if (!query || !groupMap) {
    return [];
  }
  const results = [];
  for (const ref of groupMap.values()) {
    if (!ref || !ref.name) {
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
        imageUrl: ref.iconUrl || ref.bannerUrl,
      });
    }
  }
  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchFavoriteAvatars(query, favoriteAvatars, comparer, limit = 10) {
  if (!query || !favoriteAvatars) {
    return [];
  }
  const results = [];
  for (const ctx of favoriteAvatars) {
    if (!ctx?.ref?.name) {
      continue;
    }
    if (matchName(ctx.ref.name, query, comparer)) {
      results.push({
        id: ctx.ref.id,
        name: ctx.ref.name,
        type: "avatar",
        imageUrl: ctx.ref.thumbnailImageUrl || ctx.ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}

export function searchFavoriteWorlds(query, favoriteWorlds, comparer, limit = 10) {
  if (!query || !favoriteWorlds) {
    return [];
  }
  const results = [];
  for (const ctx of favoriteWorlds) {
    if (!ctx?.ref?.name) {
      continue;
    }
    if (matchName(ctx.ref.name, query, comparer)) {
      results.push({
        id: ctx.ref.id,
        name: ctx.ref.name,
        type: "world",
        imageUrl: ctx.ref.thumbnailImageUrl || ctx.ref.imageUrl,
      });
    }
  }
  results.sort((a, b) => {
    const aPrefix = isPrefixMatch(a.name, query, comparer);
    const bPrefix = isPrefixMatch(b.name, query, comparer);
    if (aPrefix && !bPrefix) return -1;
    if (bPrefix && !aPrefix) return 1;
    return comparer.compare(a.name, b.name);
  });
  if (results.length > limit) {
    results.length = limit;
  }
  return results;
}
