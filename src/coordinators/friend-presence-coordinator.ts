import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { isRealInstance } from "../shared/utils/instance";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { useFeedStore } from "../stores/feed";
import { useFriendStore } from "../stores/friend";
import type { FriendContext, FriendState } from "../stores/friend-types";
import { useNotificationStore } from "../stores/notification";
import { logError } from "../stores/notification/errors";
import { syncFriendSearchIndex } from "./search-index-coordinator";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import { userRequest } from "../api/user";
import { watchState } from "../services/watch-state";

type PresenceFeedEntry = {
  created_at: string;
  type: "Online" | "Offline";
  userId: string;
  displayName: string;
  location: string;
  worldName: string;
  groupName: string;
  time: number | null;
};

type PresenceClock = {
  now?: () => number;
  nowIso?: () => string;
};

async function publishPresenceFeed(feed: PresenceFeedEntry): Promise<void> {
  const feedStore = useFeedStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();
  notificationStore.queueFeedNoty(feed);
  sharedFeedStore.addEntry(feed).catch(logError);
  const persistedFeed = await database.addOnlineOfflineToDatabase(feed);
  if (persistedFeed) {
    feedStore.addFeedEntry(persistedFeed);
  }
}

export async function runUpdateFriendDelayedCheckFlow(
  ctx: FriendContext,
  newState: FriendState | "",
  location: string,
  locationAt: number,
  { now = Date.now, nowIso = () => new Date().toJSON() }: PresenceClock = {}
): Promise<void> {
  const friendStore = useFriendStore();
  const { friends, localFavoriteFriends } = friendStore;

  const id = ctx.id;
  if (AppDebug.debugFriendState) {
    console.log(`${ctx.name} updateFriendState ${ctx.state} -> ${newState}`);
    if (typeof ctx.ref !== "undefined" && location !== ctx.ref.location) {
      console.log(`${ctx.name} pendingOfflineLocation ${location} -> ${ctx.ref.location}`);
    }
  }
  if (!friends.has(id)) {
    console.log("Friend not found", id);
    return;
  }
  const isVIP = localFavoriteFriends.has(id);
  const ref = ctx.ref;
  if (ctx.state !== newState && ref !== undefined) {
    if ((newState === "offline" || newState === "active") && ctx.state === "online") {
      ref.$online_for = 0;
      ref.$offline_for = now();
      ref.$active_for = 0;
      if (newState === "active") {
        ref.$active_for = now();
      }
      const ts = now();
      const time = ts - locationAt;
      const worldName = await getWorldName(location);
      const groupName = await getGroupName(location);
      await publishPresenceFeed({
        created_at: nowIso(),
        type: "Offline",
        userId: ref.id,
        displayName: ref.displayName,
        location,
        worldName,
        groupName,
        time,
      });
    } else if (newState === "online" && (ctx.state === "offline" || ctx.state === "active")) {
      ref.$previousLocation = "";
      ref.$travelingToTime = now();
      ref.$location_at = now();
      ref.$online_for = now();
      ref.$offline_for = 0;
      ref.$active_for = 0;
      const worldName = await getWorldName(location);
      const groupName = await getGroupName(location);
      await publishPresenceFeed({
        created_at: nowIso(),
        type: "Online",
        userId: id,
        displayName: ctx.name,
        location,
        worldName,
        groupName,
        time: null,
      });
    }
    if (newState === "active") {
      ref.$active_for = now();
    }
  }
  if (ctx.state !== newState) {
    ctx.state = newState;
    friendStore.updateOnlineFriendCounter();
  }
  if (ref?.displayName) {
    ctx.name = ref.displayName;
    syncFriendSearchIndex(ctx);
  }
  ctx.isVIP = isVIP;
  friendStore.reindexSortedFriend(ctx);
}

export async function runUpdateFriendFlow(
  id: string,
  stateInput?: FriendState,
  { now = Date.now, nowIso = () => new Date().toJSON() }: PresenceClock = {}
): Promise<void> {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const { friends, localFavoriteFriends, pendingOfflineMap } = friendStore;

  const ctx = friends.get(id);
  if (typeof ctx === "undefined") {
    return;
  }
  const ref = userStore.cachedUsers.get(id);

  if (stateInput === "online") {
    const pendingOffline = pendingOfflineMap.get(id);
    if (AppDebug.debugFriendState && pendingOffline) {
      const time = (now() - pendingOffline.startTime) / 1000;
      console.log(`${ctx.name} pendingOfflineCancelTime ${time}`);
    }
    ctx.pendingOffline = false;
    pendingOfflineMap.delete(id);
  }
  const isVIP = localFavoriteFriends.has(id);
  let location = "";
  let locationAt = Number.NaN;
  if (typeof ref !== "undefined") {
    location = ref.location;
    locationAt = ref.$location_at;

    const currentState = stateInput ?? ctx.state;

    if (currentState !== "online" && isRealInstance(ref.location) && ref.$lastFetch !== undefined && ref.$lastFetch < now() - 10000) {
      console.log(`Fetching offline friend in an instance ${ctx.name}`);
      userRequest.getUser({ userId: id }).catch(logError);
    }

    if (currentState === "online" && ref.location === "offline" && ref.$lastFetch !== undefined && ref.$lastFetch < now() - 10000) {
      console.log(`Fetching online friend in an offline location ${ctx.name}`);
      userRequest.getUser({ userId: id }).catch(logError);
    }
  }
  if (typeof stateInput === "undefined" || ctx.state === stateInput) {
    if (ctx.ref !== ref) {
      ctx.ref = ref;

      if (ctx.state === "online") {
        if (watchState.isFriendsLoaded) {
          userRequest.getUser({ userId: id }).catch(logError);
        }
      }
    }
    if (ctx.isVIP !== isVIP) {
      ctx.isVIP = isVIP;
    }
    if (typeof ref !== "undefined" && ctx.name !== ref.displayName) {
      ctx.name = ref.displayName;
      syncFriendSearchIndex(ctx);
    }
    friendStore.reindexSortedFriend(ctx);
    return;
  }
  if (ctx.state === "online" && (stateInput === "active" || stateInput === "offline")) {
    ctx.ref = ref;
    ctx.isVIP = isVIP;
    if (typeof ref !== "undefined") {
      ctx.name = ref.displayName;
      syncFriendSearchIndex(ctx);
    }
    if (!watchState.isFriendsLoaded) {
      await runUpdateFriendDelayedCheckFlow(ctx, stateInput, location, locationAt, { now, nowIso });
      return;
    }

    if (pendingOfflineMap.has(id)) {
      if (AppDebug.debugFriendState) {
        console.log(ctx.name, "pendingOfflineAlreadyWaiting");
      }
      return;
    }
    if (AppDebug.debugFriendState) {
      console.log(ctx.name, "pendingOfflineBegin");
    }
    pendingOfflineMap.set(id, {
      startTime: now(),
      newState: stateInput,
      previousLocation: location,
      previousLocationAt: locationAt,
    });
    ctx.pendingOffline = true;
    friendStore.reindexSortedFriend(ctx);
    return;
  }
  ctx.ref = ref;
  ctx.isVIP = isVIP;
  if (typeof ref !== "undefined") {
    ctx.name = ref.displayName;
    syncFriendSearchIndex(ctx);
    await runUpdateFriendDelayedCheckFlow(ctx, ref.state, location, locationAt, { now, nowIso });
  } else {
    friendStore.reindexSortedFriend(ctx);
  }
}

export async function runPendingOfflineTickFlow({ now = Date.now, nowIso = () => new Date().toJSON() }: PresenceClock = {}): Promise<void> {
  const friendStore = useFriendStore();
  const { friends, pendingOfflineMap, pendingOfflineDelay } = friendStore;

  const currentTime = now();
  for (const [id, pending] of pendingOfflineMap.entries()) {
    if (currentTime - pending.startTime >= pendingOfflineDelay) {
      const ctx = friends.get(id);
      if (typeof ctx === "undefined") {
        pendingOfflineMap.delete(id);
        continue;
      }
      ctx.pendingOffline = false;
      if (pending.newState === undefined) {
        pendingOfflineMap.delete(id);
        continue;
      }
      if (pending.newState === ctx.state) {
        console.error(ctx.name, "pendingOfflineCancelledStateMatched, this should never happen");
        pendingOfflineMap.delete(id);
        continue;
      }
      if (AppDebug.debugFriendState) {
        console.log(ctx.name, "pendingOfflineEnd");
      }
      pendingOfflineMap.delete(id);
      await runUpdateFriendDelayedCheckFlow(ctx, pending.newState, pending.previousLocation, pending.previousLocationAt, { now, nowIso });
    }
  }
}
