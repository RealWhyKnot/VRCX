import { removeAvatarFromCache } from "./avatar-coordinator";
import { removeWorldFromCache } from "./world-coordinator";
import { useAvatarStore } from "../stores/avatar";
import { useFavoriteStore } from "../stores/favorite";
import { useFriendStore } from "../stores/friend";
import { useGalleryStore } from "../stores/gallery";
import { useGroupStore } from "../stores/group";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";
import { failedGetRequests } from "../services/request";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function stringFieldOf(value: unknown, key: string): string {
  const field = fieldOf(value, key);
  return typeof field === "string" ? field : "";
}

export function clearVRCXCache() {
  const userStore = useUserStore();
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();
  const groupStore = useGroupStore();
  const instanceStore = useInstanceStore();
  const friendStore = useFriendStore();
  const favoriteStore = useFavoriteStore();
  const locationStore = useLocationStore();
  const galleryStore = useGalleryStore();

  console.log("Clearing VRCX cache...");
  failedGetRequests.clear();
  userStore.cachedUsers.forEach((ref: unknown, id: string) => {
    if (!friendStore.friends.has(id) && !locationStore.lastLocation.playerList.has(stringFieldOf(ref, "id")) && id !== userStore.currentUser.id) {
      userStore.deleteCachedUser(id);
    }
  });
  userStore.cachedProfiles.forEach((ref: unknown, id: string) => {
    if (!friendStore.friends.has(id) && !locationStore.lastLocation.playerList.has(stringFieldOf(ref, "id")) && id !== userStore.currentUser.id) {
      userStore.deleteCachedProfile(id);
    }
  });
  worldStore.cachedWorlds.forEach((ref: unknown, id: string) => {
    if (
      !favoriteStore.getCachedFavoritesByObjectId(id) &&
      fieldOf(ref, "authorId") !== userStore.currentUser.id &&
      !favoriteStore.localWorldFavoritesList.includes(id)
    ) {
      removeWorldFromCache(id);
    }
  });
  avatarStore.cachedAvatars.forEach((ref: unknown, id: string) => {
    const avatarHistory = avatarStore.avatarHistory;
    if (
      !favoriteStore.getCachedFavoritesByObjectId(id) &&
      fieldOf(ref, "authorId") !== userStore.currentUser.id &&
      !favoriteStore.localAvatarFavoritesList.includes(id) &&
      !avatarHistory.some((entry) => entry.id === id)
    ) {
      removeAvatarFromCache(id);
    }
  });
  groupStore.cachedGroups.forEach((_: unknown, id: string) => {
    if (!groupStore.currentUserGroups.has(id)) {
      groupStore.cachedGroups.delete(id);
    }
  });
  instanceStore.cachedInstances.forEach((ref: unknown, id: string) => {
    if ([...friendStore.friends.values()].some((f: unknown) => fieldOf(fieldOf(f, "$location"), "tag") === id)) {
      return;
    }

    const fetchedAt = fieldOf(ref, "$fetchedAt");
    if (typeof fetchedAt === "string" && Date.parse(fetchedAt) < Date.now() - 3600000) {
      instanceStore.cachedInstances.delete(id);
    }
  });
  avatarStore.cachedAvatarNames.clear();
  userStore.customUserTags.clear();
  galleryStore.cachedEmoji.clear();
}
