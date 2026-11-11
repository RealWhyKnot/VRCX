import { computed } from "vue";
import { storeToRefs } from "pinia";
import type { FriendContext } from "../../../stores/friend-types";
import { useFriendStore } from "../../../stores/friend";
import { useUserStore } from "../../../stores/user";

type NewInstanceCreatorPickersDeps = {
  t: (key: string) => string;
};

type CreatorUser = NonNullable<FriendContext["ref"]>;

export function useNewInstanceCreatorPickers({ t }: NewInstanceCreatorPickersDeps) {
  const { vipFriends, onlineFriends, activeFriends, offlineFriends } = storeToRefs(useFriendStore());
  const { currentUser } = storeToRefs(useUserStore());
  const { cachedUsers } = useUserStore();

  const friendSections = computed(() => [
    {
      key: "vip",
      label: t("side_panel.favorite"),
      friends: vipFriends.value,
    },
    {
      key: "online",
      label: t("side_panel.online"),
      friends: onlineFriends.value,
    },
    {
      key: "active",
      label: t("side_panel.active"),
      friends: activeFriends.value,
    },
    {
      key: "offline",
      label: t("side_panel.offline"),
      friends: offlineFriends.value,
    },
  ]);

  const friendById = computed(() => {
    const map = new Map<string, FriendContext>();
    for (const section of friendSections.value) {
      for (const friend of section.friends) {
        map.set(friend.id, friend);
      }
    }
    return map;
  });

  const creatorUserById = computed(() => {
    const map = new Map<string, CreatorUser>();
    const self = cachedUsers.get(currentUser.value.id);
    if (self) {
      map.set(currentUser.value.id, self);
    }
    for (const section of friendSections.value) {
      for (const friend of section.friends) {
        if (friend.ref) {
          map.set(friend.id, friend.ref);
        }
      }
    }
    return map;
  });

  function creatorUser(item: { value: string | number }) {
    return creatorUserById.value.get(String(item.value));
  }

  function resolveUserDisplayName(userId: string) {
    if (currentUser.value.id && currentUser.value.id === userId) {
      return currentUser.value.displayName;
    }
    const friend = friendById.value.get(userId);
    return friend?.ref?.displayName ?? friend?.name ?? userId;
  }

  const creatorPickerGroups = computed(() => {
    const groups: { key: string; label: string; items: { value: string; label: string; search: string }[] }[] = [];

    groups.push({
      key: "me",
      label: t("side_panel.me"),
      items: [
        {
          value: currentUser.value.id,
          label: currentUser.value.displayName,
          search: currentUser.value.displayName,
        },
      ],
    });

    const addFriendGroup = ({ key, label, friends }: { key: string; label: string; friends: FriendContext[] }) => {
      if (!friends.length) return;
      groups.push({
        key,
        label,
        items: friends.map((friend) => {
          const displayName = resolveUserDisplayName(friend.id);
          return {
            value: friend.id,
            label: displayName,
            search: displayName,
          };
        }),
      });
    };

    friendSections.value.forEach(addFriendGroup);

    return groups;
  });

  return { creatorUser, creatorPickerGroups };
}
