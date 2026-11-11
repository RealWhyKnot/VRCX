import { computed, reactive, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useFavoriteStore } from "../../../stores/favorite";
import { useFriendStore } from "../../../stores/friend";
import type { FriendContext } from "../../../stores/friend-types";
import { useLocationStore } from "../../../stores/location";
import { getFriendsLocations } from "../../../shared/utils/location.ts";
import { getFriendsSortFunction } from "../../../shared/utils/friend";
import type { FriendEntry, SameInstanceGroup } from "./friends-locations-types";

type FriendsLocationsListsOptions = {
  activeSegment: Ref<string>;
  searchTerm: Ref<string>;
  showSameInstance: Ref<boolean>;
};

export function useFriendsLocationsLists({ activeSegment, searchTerm, showSameInstance }: FriendsLocationsListsOptions) {
  const friendStore = useFriendStore();
  const { onlineFriends, allFavoriteOnlineFriends, allFavoriteFriendIds, activeFriends, offlineFriends, friendsInSameInstance } = storeToRefs(friendStore);

  const appearanceSettingsStore = useAppearanceSettingsStore();
  const { isSidebarDivideByFriendGroup, sidebarFavoriteGroups, sidebarFavoriteGroupOrder, sidebarSortMethods } = storeToRefs(appearanceSettingsStore);

  const favoriteStore = useFavoriteStore();
  const { favoriteFriendGroups, groupedByGroupKeyFavoriteFriends, localFriendFavorites } = storeToRefs(favoriteStore);

  const locationStore = useLocationStore();
  const { lastLocation } = storeToRefs(locationStore);
  const lastLocationSnapshot = computed(() => ({
    location: lastLocation.value.location,
    friendList: new Set(lastLocation.value.friendList.keys()),
  }));

  const collapsedGroups = reactive(new Set<string>());
  const normalizedSearchTerm = computed(() => searchTerm.value.trim().toLowerCase());

  const toEntries = (list: FriendContext[] | undefined, instanceId?: string): FriendEntry[] =>
    Array.isArray(list)
      ? list.map((friend) => ({
          id: friend.id,
          friend,
          instanceId,
        }))
      : [];

  const toLocationEntries = (friends: FriendContext[]) =>
    friends.map((friend) => ({
      id: friend.id,
      ref: friend.ref ?? {},
    }));

  const sameInstanceGroups = computed<SameInstanceGroup[]>(() =>
    friendsInSameInstance.value.flatMap((friends, index) => {
      if (friends.length === 0) return [];
      const location = getFriendsLocations(toLocationEntries(friends), lastLocationSnapshot.value);
      const instanceId = location === undefined || location === "" ? `instance-${index + 1}` : location;
      return [{ instanceId, friends }];
    })
  );

  const sameInstanceEntries = computed(() => sameInstanceGroups.value.flatMap((group) => toEntries(group.friends, group.instanceId)));

  const uniqueEntries = (entries: FriendEntry[]) => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = entry.id;
      if (!key) {
        return true;
      }
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const displayedVipIds = computed(() => {
    const selectedGroups = sidebarFavoriteGroups.value;
    const hasFilter = selectedGroups.length > 0;
    if (!hasFilter) return allFavoriteFriendIds.value;

    const ids = new Set<string>();
    const remoteFriendsByGroup = groupedByGroupKeyFavoriteFriends.value;
    for (const key of selectedGroups) {
      if (key.startsWith("local:")) {
        const groupName = key.slice(6);
        const userIds = localFriendFavorites.value[groupName];
        if (userIds) {
          for (const id of userIds) ids.add(id);
        }
      } else if (remoteFriendsByGroup[key]) {
        for (const f of remoteFriendsByGroup[key]) ids.add(f.id);
      }
    }
    return ids;
  });

  const visibleFavoriteOnlineFriends = computed(() => {
    const selectedGroups = sidebarFavoriteGroups.value;
    if (selectedGroups.length === 0) {
      return allFavoriteOnlineFriends.value;
    }
    return allFavoriteOnlineFriends.value.filter((friend) => displayedVipIds.value.has(friend.id));
  });

  const onlineFriendsByGroupStatus = computed(() => {
    const selectedGroups = sidebarFavoriteGroups.value;
    if (selectedGroups.length === 0) {
      return onlineFriends.value.filter((f) => !allFavoriteFriendIds.value.has(f.id));
    }
    const selectedIds = displayedVipIds.value;
    const nonFavOnline = onlineFriends.value.filter((f) => !selectedIds.has(f.id));
    const existingIds = new Set(nonFavOnline.map((f) => f.id));
    const unselectedGroupFriends = allFavoriteOnlineFriends.value.filter((f) => !selectedIds.has(f.id) && !existingIds.has(f.id));
    return [...nonFavOnline, ...unselectedGroupFriends].sort(getFriendsSortFunction(sidebarSortMethods.value));
  });

  const vipFriendsDivideByGroup = computed(() => {
    const remoteFriendsByGroup = groupedByGroupKeyFavoriteFriends.value;
    const selectedGroups = sidebarFavoriteGroups.value;
    const hasFilter = selectedGroups.length > 0;

    const groups: { key: string; groupName: string; memberIds: Set<string> }[] = [];
    for (const key in remoteFriendsByGroup) {
      if (Object.hasOwn(remoteFriendsByGroup, key)) {
        if (hasFilter && !selectedGroups.includes(key)) continue;
        const groupName = favoriteFriendGroups.value.find((g) => g.key === key)?.displayName ?? "";
        const memberIds = new Set((remoteFriendsByGroup[key] ?? []).map((f) => f.id));
        groups.push({ key, groupName, memberIds });
      }
    }
    for (const groupName of Object.keys(localFriendFavorites.value)) {
      const selectedKey = `local:${groupName}`;
      if (hasFilter && !selectedGroups.includes(selectedKey)) continue;
      const userIds = localFriendFavorites.value[groupName];
      if (userIds?.length) {
        groups.push({ key: selectedKey, groupName, memberIds: new Set(userIds) });
      }
    }

    const result: { key: string; groupName: string; friends: FriendContext[] }[] = [];
    for (const { key, groupName, memberIds } of groups) {
      const filteredFriends = visibleFavoriteOnlineFriends.value.filter((friend) => memberIds.has(friend.id));
      if (filteredFriends.length > 0) {
        result.push({ key, groupName, friends: filteredFriends });
      }
    }

    const order = sidebarFavoriteGroupOrder.value;
    return result.sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.key.localeCompare(b.key);
    });
  });

  const searchableEntries = computed(() =>
    uniqueEntries([
      ...toEntries(allFavoriteOnlineFriends.value),
      ...toEntries(onlineFriends.value),
      ...toEntries(activeFriends.value),
      ...toEntries(offlineFriends.value),
    ])
  );

  function toggleGroupCollapse(groupKey: string) {
    if (collapsedGroups.has(groupKey)) {
      collapsedGroups.delete(groupKey);
    } else {
      collapsedGroups.add(groupKey);
    }
  }

  const filteredFriends = computed<FriendEntry[]>(() => {
    if (normalizedSearchTerm.value) {
      return searchableEntries.value.filter(({ friend }) => friend.name.toLowerCase().includes(normalizedSearchTerm.value));
    }

    switch (activeSegment.value) {
      case "online": {
        if (!showSameInstance.value) {
          const sameEntries = sameInstanceEntries.value.map((entry): FriendEntry => ({
            ...entry,
            section: "same-instance",
          }));

          const seenIds = new Set(sameEntries.map((entry) => entry.id));

          const remainingOnline = toEntries(onlineFriendsByGroupStatus.value)
            .filter((entry) => !entry.id || !seenIds.has(entry.id))
            .map((entry): FriendEntry => ({
              ...entry,
              section: "online",
            }));

          return [...sameEntries, ...remainingOnline];
        }

        return toEntries(onlineFriendsByGroupStatus.value);
      }
      case "favorite":
        return toEntries(visibleFavoriteOnlineFriends.value);
      case "same-instance":
        return sameInstanceEntries.value;
      case "active":
        return toEntries(activeFriends.value);
      case "offline":
        return toEntries(offlineFriends.value);
      default:
        return [];
    }
  });

  const isSameInstanceView = computed(() => showSameInstance.value && activeSegment.value === "same-instance" && !normalizedSearchTerm.value);

  const shouldMergeSameInstance = computed(() => !showSameInstance.value && activeSegment.value === "online" && !normalizedSearchTerm.value);

  const displayInstanceInfo = computed(() => activeSegment.value !== "active" && activeSegment.value !== "offline");

  const buildSameInstanceGroups = (entries: FriendEntry[]): SameInstanceGroup[] => {
    const grouped = new Map<string, FriendContext[]>();

    for (const entry of entries) {
      const bucketId = entry.instanceId ?? entry.friend.ref?.location;
      if (!bucketId) {
        continue;
      }
      const bucket = grouped.get(bucketId);
      if (bucket) {
        bucket.push(entry.friend);
      } else {
        grouped.set(bucketId, [entry.friend]);
      }
    }

    return sameInstanceGroups.value
      .filter((group) => grouped.has(group.instanceId))
      .map((group) => ({
        instanceId: group.instanceId,
        friends: grouped.get(group.instanceId) ?? [],
      }));
  };

  const sameInstanceGroupsForVirtual = computed<SameInstanceGroup[]>(() => {
    if (!isSameInstanceView.value) {
      return [];
    }
    return buildSameInstanceGroups(filteredFriends.value);
  });

  const mergedEntriesBySection = computed(() => {
    const sameInstance: FriendEntry[] = [];
    const online: FriendEntry[] = [];
    if (!shouldMergeSameInstance.value) {
      return { sameInstance, online };
    }

    for (const entry of filteredFriends.value) {
      if (entry.section === "same-instance") {
        sameInstance.push(entry);
      } else {
        online.push(entry);
      }
    }

    return {
      sameInstance,
      online,
    };
  });

  const mergedSameInstanceEntries = computed(() => {
    return mergedEntriesBySection.value.sameInstance;
  });

  const mergedOnlineEntries = computed(() => {
    return mergedEntriesBySection.value.online;
  });

  const mergedSameInstanceGroups = computed<SameInstanceGroup[]>(() => {
    if (!shouldMergeSameInstance.value) {
      return [];
    }
    return buildSameInstanceGroups(mergedSameInstanceEntries.value);
  });
  const isFavoriteDivideByGroup = computed(() => isSidebarDivideByFriendGroup.value && activeSegment.value === "favorite" && !normalizedSearchTerm.value);

  return {
    collapsedGroups,
    filteredFriends,
    isSameInstanceView,
    shouldMergeSameInstance,
    displayInstanceInfo,
    sameInstanceGroupsForVirtual,
    mergedSameInstanceGroups,
    mergedOnlineEntries,
    isFavoriteDivideByGroup,
    vipFriendsDivideByGroup,
    toggleGroupCollapse,
  };
}

export type FriendsLocationsLists = ReturnType<typeof useFriendsLocationsLists>;
