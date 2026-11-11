import { computed, reactive } from "vue";
import type { ShallowRef } from "vue";

import { AppDebug } from "../services/app-config";
import { isRealInstance } from "../shared/utils/instance";
import { useFavoriteStore } from "./favorite";
import type { useAppearanceSettingsStore } from "./settings/appearance";
import type { useGeneralSettingsStore } from "./settings/general";
import type { useLocationStore } from "./location";
import type { FriendContext } from "./friend-types";
import { isCachedFavorite } from "./friend-types";

const DERIVED_DEBUG_NAMES = [
  "allFavoriteFriendIds",
  "allFavoriteOnlineFriends",
  "vipFriends",
  "onlineFriends",
  "activeFriends",
  "offlineFriends",
  "friendsInSameInstance",
] as const;

type DerivedDebugName = (typeof DERIVED_DEBUG_NAMES)[number];

export type FriendDerivedDeps = {
  friends: ReadonlyMap<string, FriendContext>;
  sortedFriends: ShallowRef<FriendContext[]>;
  appearanceSettingsStore: ReturnType<typeof useAppearanceSettingsStore>;
  generalSettingsStore: ReturnType<typeof useGeneralSettingsStore>;
  locationStore: ReturnType<typeof useLocationStore>;
};

export function createFriendDerived(deps: FriendDerivedDeps) {
  const { friends, sortedFriends, appearanceSettingsStore, generalSettingsStore, locationStore } = deps;

  const derivedDebugCounters = reactive({
    allFavoriteFriendIds: 0,
    allFavoriteOnlineFriends: 0,
    vipFriends: 0,
    onlineFriends: 0,
    activeFriends: 0,
    offlineFriends: 0,
    friendsInSameInstance: 0,
  });

  function trackDerivedDebug(name: DerivedDebugName, resultSize: number): void {
    derivedDebugCounters[name] += 1;
    if (!AppDebug.debugRecompute) {
      return;
    }
    console.log("[friendStore derived]", {
      name,
      count: derivedDebugCounters[name],
      resultSize,
      friendCount: friends.size,
      sortMethods: appearanceSettingsStore.sidebarSortMethods,
    });
  }

  function resetDerivedDebugCounters(): void {
    for (const key of DERIVED_DEBUG_NAMES) {
      derivedDebugCounters[key] = 0;
    }
    if (AppDebug.debugRecompute) {
      console.log("[friendStore derived] counters reset");
    }
  }

  function getDerivedDebugCounters(): typeof derivedDebugCounters {
    const snapshot = { ...derivedDebugCounters };
    if (AppDebug.debugRecompute) {
      console.log("[friendStore derived] counters snapshot", snapshot);
    }
    return snapshot;
  }

  const allFavoriteFriendIds = computed(() => {
    const favoriteStore = useFavoriteStore();
    const groups: string[] = generalSettingsStore.localFavoriteFriendsGroups;
    const localFriendFavorites: Record<string, string[] | undefined> = favoriteStore.localFriendFavorites;
    const set = new Set<string>();
    for (const favorite of favoriteStore.cachedFavorites.values()) {
      if (!isCachedFavorite(favorite)) {
        continue;
      }
      if (favorite.type === "friend" && (groups.length === 0 || groups.includes(favorite.$groupKey))) {
        set.add(favorite.favoriteId);
      }
    }
    let localGroups = groups.filter((key) => key.startsWith("local:")).map((key) => key.replace("local:", ""));
    if (groups.length === 0) {
      localGroups = Object.keys(localFriendFavorites);
    }
    for (const groupName of localGroups) {
      const userIds = localFriendFavorites[groupName];
      if (userIds) {
        for (const id of userIds) {
          set.add(id);
        }
      }
    }
    trackDerivedDebug("allFavoriteFriendIds", set.size);
    return set;
  });

  const allFavoriteOnlineFriends = computed(() => {
    const favoriteIds = allFavoriteFriendIds.value;
    const result = sortedFriends.value.filter((f) => f.state === "online" && favoriteIds.has(f.id));
    trackDerivedDebug("allFavoriteOnlineFriends", result.length);
    return result;
  });

  const vipFriends = computed(() => {
    const result = sortedFriends.value.filter((f) => f.state === "online" && f.isVIP);
    trackDerivedDebug("vipFriends", result.length);
    return result;
  });

  const onlineFriends = computed(() => {
    const result = sortedFriends.value.filter((f) => f.state === "online" && !f.isVIP);
    trackDerivedDebug("onlineFriends", result.length);
    return result;
  });

  const activeFriends = computed(() => {
    const result = sortedFriends.value.filter((f) => f.state === "active");
    trackDerivedDebug("activeFriends", result.length);
    return result;
  });

  const offlineFriends = computed(() => {
    const result = sortedFriends.value.filter((f) => f.state === "offline" || !f.state);
    trackDerivedDebug("offlineFriends", result.length);
    return result;
  });

  const friendsInSameInstance = computed(() => {
    const friendsList = new Map<string, FriendContext[]>();

    for (const friend of sortedFriends.value) {
      if (friend.state !== "online") {
        continue;
      }
      if (!friend.ref?.$location) {
        continue;
      }

      let locationTag = friend.ref.$location.tag;
      if (!friend.ref.$location.isRealInstance && locationStore.lastLocation.friendList.has(friend.id)) {
        locationTag = locationStore.lastLocation.location;
      }
      if (!locationTag || !isRealInstance(locationTag)) {
        continue;
      }

      const group = friendsList.get(locationTag);
      if (group) {
        group.push(friend);
      } else {
        friendsList.set(locationTag, [friend]);
      }
    }

    const sortedFriendsList: FriendContext[][] = [];
    for (const group of friendsList.values()) {
      if (group.length > 1) {
        sortedFriendsList.push(group);
      }
    }

    const result = sortedFriendsList.sort((a, b) => b.length - a.length);
    trackDerivedDebug("friendsInSameInstance", result.length);
    return result;
  });

  return {
    allFavoriteFriendIds,
    allFavoriteOnlineFriends,
    vipFriends,
    onlineFriends,
    activeFriends,
    offlineFriends,
    friendsInSameInstance,
    resetDerivedDebugCounters,
    getDerivedDebugCounters,
  };
}
