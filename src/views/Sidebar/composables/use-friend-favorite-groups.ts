import { computed } from "vue";
import type { Ref } from "vue";
import { storeToRefs } from "pinia";
import type { useFavoriteStore } from "../../../stores/favorite";

type FavoriteGroupSelection = { key: string; groupName: string; memberIds: Set<string> };

type FriendFavoriteGroupsDeps = {
  favoriteStore: ReturnType<typeof useFavoriteStore>;
  sidebarFavoriteGroups: Ref<string[]>;
};

export function useFriendFavoriteGroups({ favoriteStore, sidebarFavoriteGroups }: FriendFavoriteGroupsDeps) {
  const { favoriteFriendGroups, groupedByGroupKeyFavoriteFriends, localFriendFavorites } = storeToRefs(favoriteStore);

  const selectedFavoriteGroups = computed<FavoriteGroupSelection[]>(() => {
    const remoteFriendsByGroup = groupedByGroupKeyFavoriteFriends.value;
    const selectedGroups = new Set(sidebarFavoriteGroups.value);
    const hasFilter = selectedGroups.size > 0;
    const groups: FavoriteGroupSelection[] = [];

    for (const [key, members] of Object.entries(remoteFriendsByGroup)) {
      if (hasFilter && !selectedGroups.has(key)) continue;
      if (!members) continue;
      const groupName = favoriteFriendGroups.value.find((g) => g.key === key)?.displayName ?? "";
      const memberIds = new Set(members.map((f) => f.id));
      groups.push({ key, groupName, memberIds });
    }

    for (const [groupName, userIds] of Object.entries(localFriendFavorites.value)) {
      const key = `local:${groupName}`;
      if (hasFilter && !selectedGroups.has(key)) continue;
      if (userIds?.length) {
        groups.push({ key, groupName, memberIds: new Set(userIds) });
      }
    }
    return groups;
  });

  const selectedFavoriteGroupIds = computed(() => {
    const ids = new Set<string>();
    for (const { memberIds } of selectedFavoriteGroups.value) {
      for (const id of memberIds) ids.add(id);
    }
    return ids;
  });

  return { selectedFavoriteGroups, selectedFavoriteGroupIds };
}
