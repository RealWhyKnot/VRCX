import { getGroupName } from "../shared/utils/group";
import { getWorldName } from "../shared/utils/world";
import { isRealInstance } from "../shared/utils/instance";
import { AppDebug } from "../services/app-config";
import { database } from "../services/database";
import { useFeedStore } from "../stores/feed";
import { useFriendStore } from "../stores/friend";
import { useNotificationStore } from "../stores/notification";
import { syncFriendSearchIndex } from "./search-index-coordinator";
import { useSharedFeedStore } from "../stores/shared-feed";
import { useUserStore } from "../stores/user";
import userRequest from "../api/user";
import { watchState } from "../services/watch-state";

export async function runUpdateFriendDelayedCheckFlow(ctx, newState, location, $location_at, { now = Date.now, nowIso = () => new Date().toJSON() } = {}) {
  const friendStore = useFriendStore();
  const feedStore = useFeedStore();
  const notificationStore = useNotificationStore();
  const sharedFeedStore = useSharedFeedStore();
  const { friends, localFavoriteFriends } = friendStore;

  let feed;
  let groupName;
  let worldName;
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
  if (ctx.state !== newState && typeof ctx.ref !== "undefined") {
    if ((newState === "offline" || newState === "active") && ctx.state === "online") {
      ctx.ref.$online_for = "";
      ctx.ref.$offline_for = now();
      ctx.ref.$active_for = "";
      if (newState === "active") {
        ctx.ref.$active_for = now();
      }
      const ts = now();
      const time = ts - $location_at;
      worldName = await getWorldName(location);
      groupName = await getGroupName(location);
      feed = {
        created_at: nowIso(),
        type: "Offline",
        userId: ref.id,
        displayName: ref.displayName,
        location,
        worldName,
        groupName,
        time,
      };
      notificationStore.queueFeedNoty(feed);
      sharedFeedStore.addEntry(feed);
      const persistedFeed = await database.addOnlineOfflineToDatabase(feed);
      if (persistedFeed) {
        feedStore.addFeedEntry(persistedFeed);
      }
    } else if (newState === "online" && (ctx.state === "offline" || ctx.state === "active")) {
      ctx.ref.$previousLocation = "";
      ctx.ref.$travelingToTime = now();
      ctx.ref.$location_at = now();
      ctx.ref.$online_for = now();
      ctx.ref.$offline_for = "";
      ctx.ref.$active_for = "";
      worldName = await getWorldName(location);
      groupName = await getGroupName(location);
      feed = {
        created_at: nowIso(),
        type: "Online",
        userId: id,
        displayName: ctx.name,
        location,
        worldName,
        groupName,
        time: "",
      };
      notificationStore.queueFeedNoty(feed);
      sharedFeedStore.addEntry(feed);
      const persistedFeed = await database.addOnlineOfflineToDatabase(feed);
      if (persistedFeed) {
        feedStore.addFeedEntry(persistedFeed);
      }
    }
    if (newState === "active") {
      ctx.ref.$active_for = now();
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

export async function runUpdateFriendFlow(id, stateInput = undefined, { now = Date.now, nowIso = () => new Date().toJSON() } = {}) {
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
  let $location_at = undefined;
  if (typeof ref !== "undefined") {
    location = ref.location;
    $location_at = ref.$location_at;

    const currentState = stateInput || ctx.state;

    if (currentState !== "online" && isRealInstance(ref.location) && ref.$lastFetch < now() - 10000) {
      console.log(`Fetching offline friend in an instance ${ctx.name}`);
      userRequest.getUser({ userId: id });
    }

    if (currentState === "online" && ref.location === "offline" && ref.$lastFetch < now() - 10000) {
      console.log(`Fetching online friend in an offline location ${ctx.name}`);
      userRequest.getUser({ userId: id });
    }
  }
  if (typeof stateInput === "undefined" || ctx.state === stateInput) {
    if (ctx.ref !== ref) {
      ctx.ref = ref;

      if (ctx.state === "online") {
        if (watchState.isFriendsLoaded) {
          userRequest.getUser({ userId: id });
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
      await runUpdateFriendDelayedCheckFlow(ctx, stateInput, location, $location_at, { now, nowIso });
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
      previousLocationAt: $location_at,
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
    await runUpdateFriendDelayedCheckFlow(ctx, ctx.ref.state, location, $location_at, { now, nowIso });
  } else {
    friendStore.reindexSortedFriend(ctx);
  }
}

export async function runPendingOfflineTickFlow({ now = Date.now, nowIso = () => new Date().toJSON() } = {}) {
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
