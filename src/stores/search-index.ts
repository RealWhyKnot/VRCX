import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { useFavoriteStore } from "./favorite";

type FriendSource = {
  id: string;
  name?: string | undefined;
  ref?: { $memo?: string; note?: string | null; currentAvatarThumbnailImageUrl?: string } | undefined;
};

type AssetSource = {
  id: string;
  name?: string;
  authorId?: string;
  thumbnailImageUrl?: string;
  imageUrl?: string;
};

type GroupSource = {
  id: string;
  name?: string;
  ownerId?: string;
  iconUrl?: string;
  bannerUrl?: string;
};

type FriendEntry = { id: string; name: string; memo: string; note: string; imageUrl: string };

type AssetEntry = { id: string; name: string; authorId: string; imageUrl: string };

type GroupEntry = { id: string; name: string; ownerId: string; imageUrl: string };

type FavoriteEntry = { id: string; name: string; imageUrl: string };

function firstNonEmpty(...values: unknown[]): string {
  const found = values.find((value): value is string => typeof value === "string" && value !== "");
  return found ?? "";
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function favoriteEntryFromRef(value: unknown): FavoriteEntry | undefined {
  if (typeof value !== "object" || value === null || !("id" in value) || !("name" in value)) {
    return undefined;
  }
  const { id, name } = value;
  if (typeof id !== "string" || typeof name !== "string" || name === "") {
    return undefined;
  }
  const thumbnailImageUrl = "thumbnailImageUrl" in value ? value.thumbnailImageUrl : undefined;
  const imageUrl = "imageUrl" in value ? value.imageUrl : undefined;
  return { id, name, imageUrl: firstNonEmpty(thumbnailImageUrl, imageUrl) };
}

function favoriteEntryFromContext(value: unknown): FavoriteEntry | undefined {
  if (typeof value !== "object" || value === null || !("ref" in value)) {
    return undefined;
  }
  return favoriteEntryFromRef(value.ref);
}

export const useSearchIndexStore = defineStore("SearchIndex", () => {
  const favoriteStore = useFavoriteStore();

  const friends = new Map<string, FriendEntry>();
  const avatars = new Map<string, AssetEntry>();
  const worlds = new Map<string, AssetEntry>();
  const groups = new Map<string, GroupEntry>();
  const favAvatars = new Map<string, FavoriteEntry>();
  const favWorlds = new Map<string, FavoriteEntry>();

  const version = ref(0);

  function syncFriend(ctx: FriendSource | null | undefined) {
    if (!ctx?.id) return;
    const entry: FriendEntry = {
      id: ctx.id,
      name: ctx.name ?? "",
      memo: ctx.ref?.$memo ?? "",
      note: ctx.ref?.note ?? "",
      imageUrl: ctx.ref?.currentAvatarThumbnailImageUrl ?? "",
    };
    const existing = friends.get(ctx.id);
    if (existing?.name === entry.name && existing.memo === entry.memo && existing.note === entry.note && existing.imageUrl === entry.imageUrl) {
      return;
    }
    friends.set(ctx.id, entry);
    version.value++;
  }

  function removeFriend(id: string) {
    if (friends.delete(id)) {
      version.value++;
    }
  }

  function clearFriends() {
    if (friends.size > 0) {
      friends.clear();
      version.value++;
    }
  }

  function upsertAvatar(ref: AssetSource | null | undefined) {
    if (!ref?.id) return;
    const entry: AssetEntry = {
      id: ref.id,
      name: ref.name ?? "",
      authorId: ref.authorId ?? "",
      imageUrl: firstNonEmpty(ref.thumbnailImageUrl, ref.imageUrl),
    };
    const existing = avatars.get(ref.id);
    if (existing?.name === entry.name && existing.authorId === entry.authorId && existing.imageUrl === entry.imageUrl) {
      return;
    }
    avatars.set(ref.id, entry);
    version.value++;
  }

  function removeAvatar(id: string) {
    if (avatars.delete(id)) {
      version.value++;
    }
  }

  function clearAvatars() {
    if (avatars.size > 0) {
      avatars.clear();
      version.value++;
    }
  }

  function upsertWorld(ref: AssetSource | null | undefined) {
    if (!ref?.id) return;
    const entry: AssetEntry = {
      id: ref.id,
      name: ref.name ?? "",
      authorId: ref.authorId ?? "",
      imageUrl: firstNonEmpty(ref.thumbnailImageUrl, ref.imageUrl),
    };
    const existing = worlds.get(ref.id);
    if (existing?.name === entry.name && existing.authorId === entry.authorId && existing.imageUrl === entry.imageUrl) {
      return;
    }
    worlds.set(ref.id, entry);
    version.value++;
  }

  function removeWorld(id: string) {
    if (worlds.delete(id)) {
      version.value++;
    }
  }

  function clearWorlds() {
    if (worlds.size > 0) {
      worlds.clear();
      version.value++;
    }
  }

  function upsertGroup(ref: GroupSource | null | undefined) {
    if (!ref?.id) return;
    const entry: GroupEntry = {
      id: ref.id,
      name: ref.name ?? "",
      ownerId: ref.ownerId ?? "",
      imageUrl: firstNonEmpty(ref.iconUrl, ref.bannerUrl),
    };
    const existing = groups.get(ref.id);
    if (existing?.name === entry.name && existing.ownerId === entry.ownerId && existing.imageUrl === entry.imageUrl) {
      return;
    }
    groups.set(ref.id, entry);
    version.value++;
  }

  function removeGroup(id: string) {
    if (groups.delete(id)) {
      version.value++;
    }
  }

  function clearGroups() {
    if (groups.size > 0) {
      groups.clear();
      version.value++;
    }
  }

  function rebuildFavoritesFromStore() {
    const newFavAvatars = new Map<string, FavoriteEntry>();
    for (const ctx of favoriteStore.favoriteAvatars) {
      const entry = favoriteEntryFromContext(ctx);
      if (entry) {
        newFavAvatars.set(entry.id, entry);
      }
    }
    for (const group of Object.values<unknown>(favoriteStore.localAvatarFavorites)) {
      if (!isUnknownArray(group)) continue;
      for (const ref of group) {
        const entry = favoriteEntryFromRef(ref);
        if (!entry || newFavAvatars.has(entry.id)) continue;
        newFavAvatars.set(entry.id, entry);
      }
    }

    const newFavWorlds = new Map<string, FavoriteEntry>();
    for (const ctx of favoriteStore.favoriteWorlds) {
      const entry = favoriteEntryFromContext(ctx);
      if (entry) {
        newFavWorlds.set(entry.id, entry);
      }
    }
    for (const group of Object.values<unknown>(favoriteStore.localWorldFavorites)) {
      if (!isUnknownArray(group)) continue;
      for (const ref of group) {
        const entry = favoriteEntryFromRef(ref);
        if (!entry || newFavWorlds.has(entry.id)) continue;
        newFavWorlds.set(entry.id, entry);
      }
    }

    let hasChanged = false;
    if (favAvatars.size !== newFavAvatars.size) {
      hasChanged = true;
    } else {
      for (const [id, entry] of newFavAvatars) {
        const existing = favAvatars.get(id);
        if (existing?.name !== entry.name || existing.imageUrl !== entry.imageUrl) {
          hasChanged = true;
          break;
        }
      }
    }
    if (favWorlds.size !== newFavWorlds.size) {
      hasChanged = true;
    } else if (!hasChanged) {
      for (const [id, entry] of newFavWorlds) {
        const existing = favWorlds.get(id);
        if (existing?.name !== entry.name || existing.imageUrl !== entry.imageUrl) {
          hasChanged = true;
          break;
        }
      }
    }

    if (hasChanged) {
      favAvatars.clear();
      for (const [id, entry] of newFavAvatars) {
        favAvatars.set(id, entry);
      }
      favWorlds.clear();
      for (const [id, entry] of newFavWorlds) {
        favWorlds.set(id, entry);
      }
      version.value++;
    }
  }

  watch([() => favoriteStore.localAvatarFavorites, () => favoriteStore.localWorldFavorites], rebuildFavoritesFromStore, { deep: true, immediate: true });

  function clearFavorites() {
    if (favAvatars.size > 0 || favWorlds.size > 0) {
      favAvatars.clear();
      favWorlds.clear();
      version.value++;
    }
  }

  function getSnapshot() {
    return {
      friends: Array.from(friends.values()),
      avatars: Array.from(avatars.values()),
      worlds: Array.from(worlds.values()),
      groups: Array.from(groups.values()),
      favAvatars: Array.from(favAvatars.values()),
      favWorlds: Array.from(favWorlds.values()),
    };
  }

  return {
    version,

    syncFriend,
    removeFriend,
    clearFriends,

    upsertAvatar,
    removeAvatar,
    clearAvatars,

    upsertWorld,
    removeWorld,
    clearWorlds,

    upsertGroup,
    removeGroup,
    clearGroups,
    rebuildFavoritesFromStore,
    clearFavorites,

    getSnapshot,
  };
});
