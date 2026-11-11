import { defineStore } from "pinia";
import { ref } from "vue";
import { watch } from "vue";

import { compareByCreatedAt } from "../shared/utils/compare";
import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { database } from "../services/database";
import { useFriendStore } from "./friend";
import { useInstanceStore } from "./instance";
import { useLocationStore } from "./location";
import { useModerationStore } from "./moderation";
import { useNotificationStore } from "./notification";
import { useNotificationsSettingsStore } from "./settings/notifications";
import { useUserStore } from "./user";
import { useWristOverlaySettingsStore } from "./settings/wrist-overlay";
import { watchState } from "../services/watch-state";

type SharedFeedEntry = {
  type?: string | null | undefined;
  created_at?: string | null | undefined;
  userId?: string | null | undefined;
  senderUserId?: string | null | undefined;
  displayName?: string | null | undefined;
  location?: string | null | undefined;
  details?: { location?: string | null; worldId?: string | null; worldName?: string | null } | null | undefined;
  isFriend?: boolean | undefined;
  isFavorite?: boolean | undefined;
  isTraveling?: boolean | undefined;
  tagColour?: string | undefined;
  instanceDisplayName?: string | null | undefined;
};

type SharedFeedTraveler = {
  id: string;
  displayName: string;
  created_at?: string;
  $location: { tag?: string; worldId?: string; groupId?: string | null };
};

function pickTruthy(primary: string | null | undefined, fallback: string | null | undefined): string | null | undefined {
  if (primary) {
    return primary;
  }
  return fallback;
}

export const useSharedFeedStore = defineStore("SharedFeed", () => {
  const friendStore = useFriendStore();
  const notificationsSettingsStore = useNotificationsSettingsStore();
  const locationStore = useLocationStore();
  const userStore = useUserStore();
  const wristOverlaySettingsStore = useWristOverlaySettingsStore();
  const instanceStore = useInstanceStore();
  const moderationStore = useModerationStore();
  const notificationStore = useNotificationStore();

  const onPlayerJoining = ref<SharedFeedEntry[]>([]);

  async function rebuildOnPlayerJoining() {
    const wristFilter = notificationsSettingsStore.sharedFeedFilters.wrist["OnPlayerJoining"];
    const newOnPlayerJoining: SharedFeedEntry[] = [];
    const travelers: Iterable<SharedFeedTraveler> = userStore.currentTravelers.values();
    for (const traveler of travelers) {
      if (!wristFilter || wristFilter === "Off") {
        break;
      }
      const isFavorite = friendStore.localFavoriteFriends.has(traveler.id);
      if (locationStore.lastLocation.playerList.has(traveler.id) || (wristFilter === "VIP" && !isFavorite)) {
        continue;
      }
      if (traveler.$location.tag === locationStore.lastLocation.location) {
        const feedEntry = {
          ...traveler,
          isFavorite,
          isFriend: true,
          type: "OnPlayerJoining",
        };
        newOnPlayerJoining.unshift(feedEntry);
        continue;
      }
      const worldName = await getWorldName(traveler.$location.worldId);
      const groupName = await getGroupName(traveler.$location.groupId);
      const feedEntry = {
        created_at: traveler.created_at,
        type: "GPS",
        userId: traveler.id,
        displayName: traveler.displayName,
        location: traveler.$location.tag,
        worldName,
        groupName,
        previousLocation: "",
        isFavorite,
        time: 0,
        isFriend: true,
        isTraveling: true,
      };
      newOnPlayerJoining.unshift(feedEntry);
    }
    onPlayerJoining.value = newOnPlayerJoining;

    sharedFeedData.value = sharedFeedData.value.filter((ctx) => !(ctx.type === "OnPlayerJoining" || (ctx.type === "GPS" && ctx.isTraveling)));
    sharedFeedData.value.unshift(...onPlayerJoining.value);
    if (sharedFeedData.value.length > maxEntries) {
      sharedFeedData.value.splice(maxEntries);
    }
    void sendSharedFeed().catch((err: unknown) => console.error(err));
  }

  watch(
    () => userStore.currentTravelers,
    () => rebuildOnPlayerJoining(),
    { deep: true }
  );

  watch(
    () => [watchState.isFriendsLoaded, watchState.isFavoritesLoaded],
    ([isFriendsLoaded, isFavoritesLoaded]) => {
      if (isFriendsLoaded && isFavoritesLoaded) {
        sharedFeedData.value = [];
        void loadSharedFeed().catch((err: unknown) => console.error(err));
      }
    },
    { flush: "sync" }
  );

  const sharedFeedData = ref<SharedFeedEntry[]>([]);
  const maxEntries = 25;

  async function loadSharedFeed() {
    let newFeed: SharedFeedEntry[] = [];
    const wristFilter: Record<string, string | undefined> = notificationsSettingsStore.sharedFeedFilters.wrist;

    const vipList = Array.from(friendStore.localFavoriteFriends.values());
    const friendList = Array.from(friendStore.friends.keys());

    const vipFilters = Object.keys(wristFilter).filter((key) => wristFilter[key] === "VIP");
    const friendsFilters = Object.keys(wristFilter).filter((key) => wristFilter[key] === "Friends");
    const everyoneFilters = Object.keys(wristFilter).filter((key) => wristFilter[key] === "On" || wristFilter[key] === "Everyone");
    const everyoneAndFriendsFilters = Object.keys(wristFilter).filter(
      (key) => wristFilter[key] === "Friends" || wristFilter[key] === "On" || wristFilter[key] === "Everyone"
    );

    if (vipFilters.length) {
      const vipFeedRows = await database.lookupFeedDatabase(vipFilters, vipList, maxEntries);
      newFeed = newFeed.concat(vipFeedRows);
    }
    if (everyoneAndFriendsFilters.length) {
      const friendsFeedRows = await database.lookupFeedDatabase(everyoneAndFriendsFilters, [], maxEntries);
      newFeed = newFeed.concat(friendsFeedRows);
    }

    if (vipFilters.length) {
      const vipGameLogRows = await database.lookupGameLogDatabase(vipFilters, vipList, maxEntries);
      newFeed = newFeed.concat(vipGameLogRows);
    }
    if (friendsFilters.length) {
      const friendsGameLogRows = await database.lookupGameLogDatabase(friendsFilters, friendList, maxEntries);
      newFeed = newFeed.concat(friendsGameLogRows);
    }
    if (everyoneFilters.length) {
      const everyoneGameLogRows = await database.lookupGameLogDatabase(everyoneFilters, [], maxEntries);
      newFeed = newFeed.concat(everyoneGameLogRows);
    }

    if (vipFilters.length) {
      const vipNotificationRows = await database.lookupNotificationDatabase("", vipFilters, vipList, maxEntries);
      newFeed = newFeed.concat(vipNotificationRows);
    }
    if (everyoneAndFriendsFilters.length) {
      const friendsNotificationRows = await database.lookupNotificationDatabase("", everyoneAndFriendsFilters, [], maxEntries);
      newFeed = newFeed.concat(friendsNotificationRows);
    }

    if (wristOverlaySettingsStore.hidePrivateFromFeed) {
      newFeed = newFeed.filter((ctx) => !(ctx.type === "GPS" && ctx.location === "private"));
    }

    newFeed = newFeed.filter((ctx) => ctx.userId !== userStore.currentUser.id);

    newFeed.sort(compareByCreatedAt);
    newFeed.splice(maxEntries);

    for (const entry of newFeed) {
      const userId = pickTruthy(entry.userId, entry.senderUserId);
      entry.isFriend = false;
      entry.isFavorite = false;
      entry.tagColour = "";
      if (userId) {
        entry.isFriend = friendStore.friends.has(userId);
        entry.isFavorite = friendStore.localFavoriteFriends.has(userId);
        entry.tagColour = userStore.customUserTags.get(userId)?.colour ?? "";
      }

      const location = pickTruthy(entry.location, entry.details?.location);
      if (location) {
        entry.instanceDisplayName = await instanceStore.getInstanceName(location);
      }
    }
    sharedFeedData.value = newFeed;
    void rebuildOnPlayerJoining().catch((err: unknown) => console.error(err));
  }

  async function addEntry(data: SharedFeedEntry) {
    const ctx = { ...data };
    const userId = pickTruthy(ctx.userId, ctx.senderUserId);
    const wristFilter: Record<string, string | undefined> = notificationsSettingsStore.sharedFeedFilters.wrist;
    if (userId === userStore.currentUser.id) {
      return;
    }
    if (wristOverlaySettingsStore.hidePrivateFromFeed && ctx.type === "GPS" && ctx.location === "private") {
      return;
    }
    if (ctx.type === "FriendRequest" || ctx.type === "Avatar") {
      return;
    }

    let isFriend = false;
    let isFavorite = false;
    let tagColour = "";
    if (userId) {
      isFriend = friendStore.friends.has(userId);
      isFavorite = friendStore.localFavoriteFriends.has(userId);
      tagColour = userStore.customUserTags.get(userId)?.colour ?? "";
    }

    const location = pickTruthy(ctx.location, ctx.details?.location);
    if (location) {
      ctx.instanceDisplayName = await instanceStore.getInstanceName(location);
    }

    if (ctx.type === "OnPlayerJoined" || ctx.type === "OnPlayerLeft") {
      moderationAgainstCheck({
        ...ctx,
        isFavorite,
        isFriend,
        tagColour,
      });
    }

    const entryType = ctx.type ?? "";
    if (
      wristFilter[entryType] &&
      (wristFilter[entryType] === "On" ||
        wristFilter[entryType] === "Everyone" ||
        (wristFilter[entryType] === "Friends" && isFriend) ||
        (wristFilter[entryType] === "VIP" && isFavorite))
    ) {
      addToSharedFeed({
        ...ctx,
        isFavorite,
        isFriend,
        tagColour,
      });
    }
  }

  function addToSharedFeed(entry: SharedFeedEntry) {
    sharedFeedData.value.unshift(entry);
    if (sharedFeedData.value.length > maxEntries) {
      sharedFeedData.value.splice(maxEntries);
    }
    void sendSharedFeed().catch((err: unknown) => console.error(err));
  }

  function moderationAgainstCheck(ctx: SharedFeedEntry) {
    const wristFilter: Record<string, string | undefined> = notificationsSettingsStore.sharedFeedFilters.wrist;

    for (const moderation of moderationStore.cachedPlayerModerations.values()) {
      if (moderation.targetUserId !== ctx.userId) {
        continue;
      }

      let type: string;
      if (moderation.type === "block") {
        type = `Blocked${String(ctx.type)}`;
      } else if (moderation.type === "mute") {
        type = `Muted${String(ctx.type)}`;
      } else {
        continue;
      }

      const entry = {
        created_at: ctx.created_at,
        type,
        displayName: ctx.displayName,
        userId: ctx.userId,
        isFavorite: ctx.isFavorite,
        isFriend: ctx.isFriend,
        tagColour: ctx.tagColour,
      };
      notificationStore.queueGameLogNoty({ ...entry, created_at: entry.created_at ?? "" });
      if (
        wristFilter[type] &&
        (wristFilter[type] === "Everyone" || (wristFilter[type] === "Friends" && ctx.isFriend) || (wristFilter[type] === "VIP" && ctx.isFavorite))
      ) {
        addToSharedFeed(entry);
      }
    }
  }

  function addTag(userId: string, colour: string) {
    let hasChanged = false;
    for (const entry of sharedFeedData.value) {
      if (entry.userId === userId) {
        entry.tagColour = colour;
        hasChanged = true;
      }
    }
    if (hasChanged) {
      void sendSharedFeed().catch((err: unknown) => console.error(err));
    }
  }

  async function sendSharedFeed() {
    await AppApi.ExecuteVrOverlayFunction("wristFeedUpdate", JSON.stringify(sharedFeedData.value));
  }

  return {
    loadSharedFeed,
    sendSharedFeed,
    addEntry,
    addTag,
    sharedFeedData,
  };
});
