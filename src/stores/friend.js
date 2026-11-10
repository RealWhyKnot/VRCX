import { computed, reactive, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "vue-router";

import { i18n } from "../plugins/i18n";
import { compareByCreatedAtAscending, createRateLimiter, executeWithBackoff, getFriendsSortFunction, isRealInstance } from "../shared/utils";
import { getUserMemo } from "../coordinators/memoCoordinator";
import { friendRequest, userRequest } from "../api";
import { runInitFriendsListFlow } from "../coordinators/friendSyncCoordinator";
import { runPendingOfflineTickFlow, runUpdateFriendFlow } from "../coordinators/friendPresenceCoordinator";
import { updateFriendship, runUpdateFriendshipsFlow } from "../coordinators/friendRelationshipCoordinator";
import { applyUser } from "../coordinators/userCoordinator";
import { AppDebug } from "../services/appConfig";
import { database } from "../services/database";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useFavoriteStore } from "./favorite";
import { useGeneralSettingsStore } from "./settings/general";
import { useGroupStore } from "./group";
import { useLocationStore } from "./location";
import { useUserStore } from "./user";
import { useDashboardStore } from "./dashboard";
import { watchState } from "../services/watchState";

import configRepository from "../services/config";

import * as workerTimers from "worker-timers";

export const useFriendStore = defineStore("Friend", () => {
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const userStore = useUserStore();
  const groupStore = useGroupStore();
  const locationStore = useLocationStore();
  const dashboardStore = useDashboardStore();

  const router = useRouter();

  const state = reactive({
    friendNumber: 0,
  });

  const friendLog = new Map();

  const friends = reactive(new Map());

  const localFavoriteFriends = reactive(new Set());
  const sortedFriends = shallowRef([]);
  let sortedFriendsBatchDepth = 0;
  let pendingSortedFriendsRebuild = false;
  let allUserStatsRequestId = 0;
  let allUserMutualCountRequestId = 0;
  let allUserMutualOptedOutRequestId = 0;

  const derivedDebugCounters = reactive({
    allFavoriteFriendIds: 0,
    allFavoriteOnlineFriends: 0,
    vipFriends: 0,
    onlineFriends: 0,
    activeFriends: 0,
    offlineFriends: 0,
    friendsInSameInstance: 0,
  });

  function trackDerivedDebug(name, resultSize) {
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

  function resetDerivedDebugCounters() {
    for (const key in derivedDebugCounters) {
      derivedDebugCounters[key] = 0;
    }
    if (AppDebug.debugRecompute) {
      console.log("[friendStore derived] counters reset");
    }
  }

  function getDerivedDebugCounters() {
    const snapshot = { ...derivedDebugCounters };
    if (AppDebug.debugRecompute) {
      console.log("[friendStore derived] counters snapshot", snapshot);
    }
    return snapshot;
  }

  const allFavoriteFriendIds = computed(() => {
    const favoriteStore = useFavoriteStore();
    const groups = generalSettingsStore.localFavoriteFriendsGroups;
    const set = new Set();
    for (const ref of favoriteStore.cachedFavorites.values()) {
      if (ref.type === "friend" && (groups.length === 0 || groups.includes(ref.$groupKey))) {
        set.add(ref.favoriteId);
      }
    }
    let localGroups = groups.filter((key) => key.startsWith("local:")).map((key) => key.replace("local:", ""));
    if (groups.length === 0) {
      localGroups = Object.keys(favoriteStore.localFriendFavorites);
    }
    for (const groupName of localGroups) {
      const userIds = favoriteStore.localFriendFavorites[groupName];
      if (userIds) {
        for (const id of userIds) {
          set.add(id);
        }
      }
    }
    trackDerivedDebug("allFavoriteFriendIds", set.size);
    return set;
  });

  function getSortedFriendsComparator() {
    return getFriendsSortFunction(appearanceSettingsStore.sidebarSortMethods);
  }

  function findSortedFriendIndex(id) {
    return sortedFriends.value.findIndex((friend) => friend.id === id);
  }

  function rebuildSortedFriends() {
    sortedFriends.value = Array.from(friends.values()).sort(getSortedFriendsComparator());
    pendingSortedFriendsRebuild = false;
  }

  function beginSortedFriendsBatch() {
    sortedFriendsBatchDepth += 1;
  }

  function endSortedFriendsBatch() {
    if (sortedFriendsBatchDepth === 0) {
      return;
    }
    sortedFriendsBatchDepth -= 1;
    if (sortedFriendsBatchDepth === 0 && pendingSortedFriendsRebuild) {
      rebuildSortedFriends();
    }
  }

  function runInSortedFriendsBatch(fn) {
    beginSortedFriendsBatch();
    try {
      return fn();
    } finally {
      endSortedFriendsBatch();
    }
  }

  function removeSortedFriend(id) {
    if (sortedFriendsBatchDepth > 0) {
      pendingSortedFriendsRebuild = true;
      return;
    }
    const index = findSortedFriendIndex(id);
    if (index === -1) {
      return;
    }
    const next = sortedFriends.value.slice();
    next.splice(index, 1);
    sortedFriends.value = next;
  }

  function reindexSortedFriend(input) {
    const ctx = typeof input === "string" ? friends.get(input) : input;
    if (!ctx) {
      return;
    }
    if (sortedFriendsBatchDepth > 0) {
      pendingSortedFriendsRebuild = true;
      return;
    }
    const compare = getSortedFriendsComparator();
    const next = sortedFriends.value.slice();
    const existingIndex = next.findIndex((friend) => friend.id === ctx.id);
    if (existingIndex !== -1) {
      next.splice(existingIndex, 1);
    }
    let low = 0;
    let high = next.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compare(next[mid], ctx) <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    next.splice(low, 0, ctx);
    sortedFriends.value = next;
  }

  const allFavoriteOnlineFriends = computed(() => {
    const favoriteIds = allFavoriteFriendIds.value;
    const result = sortedFriends.value.filter((f) => f.state === "online" && favoriteIds.has(f.id));
    trackDerivedDebug("allFavoriteOnlineFriends", result.length);
    return result;
  });

  const isRefreshFriendsLoading = ref(false);
  const onlineFriendCount = ref(0);

  const pendingOfflineDelay = 170000;
  let pendingOfflineWorker = null;
  const pendingOfflineMap = new Map();

  const friendLogTable = ref({
    data: [],
    filters: [
      {
        prop: "type",
        value: [],
      },
      {
        prop: "displayName",
        value: "",
      },
      {
        prop: "type",
        value: false,
        filterFn: (row, filter) => !(filter.value && row.type === "Unfriend"),
      },
    ],
    pageSizeLinked: true,
    loading: false,
  });

  watch(
    [router.currentRoute, () => dashboardStore.dashboards],
    ([value]) => {
      const isDashboardPanel = value.name === "dashboard" && dashboardStore.getDashboard(value.params.id, "friend-log");
      if (value.name === "friend-log" || isDashboardPanel) {
        initFriendLogHistoryTable();
      } else {
        friendLogTable.value.data = [];
      }
    },
    { immediate: true, deep: true }
  );

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
    const friendsList = {};

    sortedFriends.value.forEach((friend) => {
      if (friend.state !== "online") {
        return;
      }
      if (!friend.ref?.$location) {
        return;
      }

      let locationTag = friend.ref.$location.tag;
      if (!friend.ref.$location.isRealInstance && locationStore.lastLocation.friendList.has(friend.id)) {
        locationTag = locationStore.lastLocation.location;
      }
      const isReal = isRealInstance(locationTag);
      if (!isReal) {
        return;
      }

      if (!friendsList[locationTag]) {
        friendsList[locationTag] = [];
      }
      friendsList[locationTag].push(friend);
    });

    const sortedFriendsList = [];
    for (const group of Object.values(friendsList)) {
      if (group.length > 1) {
        sortedFriendsList.push(group);
      }
    }

    const result = sortedFriendsList.sort((a, b) => b.length - a.length);
    trackDerivedDebug("friendsInSameInstance", result.length);
    return result;
  });

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      friends.clear();
      sortedFriends.value = [];
      pendingSortedFriendsRebuild = false;
      state.friendNumber = 0;
      friendLog.clear();
      friendLogTable.value.data = [];
      groupStore.clearGroupInstances();
      onlineFriendCount.value = 0;
      pendingOfflineMap.clear();
      if (isLoggedIn) {
        runInitFriendsListFlow(i18n.global.t);
        pendingOfflineWorkerFunction();
      } else {
        if (pendingOfflineWorker !== null) {
          workerTimers.clearInterval(pendingOfflineWorker);
          pendingOfflineWorker = null;
        }
      }
    },
    { flush: "sync" }
  );

  watch(
    () => appearanceSettingsStore.sidebarSortMethods,
    () => {
      rebuildSortedFriends();
    },
    { deep: true }
  );

  watch(
    () => watchState.isFriendsLoaded,
    (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        updateOnlineFriendCounter();
      }
    },
    { flush: "sync" }
  );

  async function init() {
    const friendLogTableFiltersValue = JSON.parse(await configRepository.getString("VRCX_friendLogTableFilters", "[]"));
    friendLogTable.value.filters[0].value = friendLogTableFiltersValue;
  }

  init();

  function updateLocalFavoriteFriends() {
    localFavoriteFriends.clear();
    for (const id of allFavoriteFriendIds.value) {
      localFavoriteFriends.add(id);
    }
    updateSidebarFavorites();
  }

  function updateSidebarFavorites() {
    runInSortedFriendsBatch(() => {
      for (const ctx of friends.values()) {
        const isVIP = localFavoriteFriends.has(ctx.id);
        if (ctx.isVIP === isVIP) {
          continue;
        }
        ctx.isVIP = isVIP;
        reindexSortedFriend(ctx);
      }
    });
  }

  async function pendingOfflineWorkerFunction() {
    pendingOfflineWorker = workerTimers.setInterval(() => {
      runPendingOfflineTickFlow();
    }, 1000);
  }

  function deleteFriend(id) {
    const ctx = friends.get(id);
    if (typeof ctx === "undefined") {
      return;
    }
    friends.delete(id);
    removeSortedFriend(id);
  }

  function refreshFriendsStatus(ref) {
    return runInSortedFriendsBatch(() => {
      let id;
      const map = new Map();
      for (id of ref.friends) {
        map.set(id, "offline");
      }
      for (id of ref.offlineFriends) {
        map.set(id, "offline");
      }
      for (id of ref.activeFriends) {
        map.set(id, "active");
      }
      for (id of ref.onlineFriends) {
        map.set(id, "online");
      }
      const added = [];
      const removed = [];
      for (const friend of map) {
        const [id, state_input] = friend;
        if (friends.has(id)) {
          runUpdateFriendFlow(id, state_input);
        } else {
          addFriend(id, state_input);
          added.push(id);
        }
      }
      for (id of friends.keys()) {
        if (map.has(id) === false) {
          deleteFriend(id);
          removed.push(id);
        }
      }
      return { added, removed };
    });
  }

  function addFriend(id, state_input = undefined) {
    if (friends.has(id)) {
      return;
    }
    const ref = userStore.cachedUsers.get(id);
    const isVIP = localFavoriteFriends.has(id);
    let name = "";
    const friend = friendLog.get(id);
    if (friend) {
      name = friend.displayName;
    }
    const ctx = reactive({
      id,
      state: state_input || "offline",
      isVIP,
      ref,
      name,
      pendingOffline: false,
      $nickName: "",
    });
    if (watchState.isFriendsLoaded) {
      getUserMemo(id);
    }
    if (typeof ref === "undefined") {
      const friendLogRef = friendLog.get(id);
      if (friendLogRef?.displayName) {
        ctx.name = friendLogRef.displayName;
      }
    } else {
      ctx.name = ref.name;
    }
    friends.set(id, ctx);
    watchState.isLoggedIn = true;

    reindexSortedFriend(ctx);
  }

  async function refreshFriends() {
    isRefreshFriendsLoading.value = true;
    try {
      const onlineFriends = await bulkRefreshFriends({
        offline: false,
      });
      const offlineFriends = await bulkRefreshFriends({
        offline: true,
      });
      let friends = onlineFriends.concat(offlineFriends);
      friends = await refetchBrokenFriends(friends);
      if (!watchState.isFriendsLoaded) {
        friends = await refreshRemainingFriends(friends);
      }

      isRefreshFriendsLoading.value = false;
      return friends;
    } catch (err) {
      isRefreshFriendsLoading.value = false;
      throw err;
    }
  }

  async function bulkRefreshFriends(args) {
    const MAX_OFFSET = 7500;
    const PAGE_SIZE = 50;
    const CONCURRENCY = 5;
    const RATE_PER_MINUTE = 60;
    const MAX_RETRY = 5;
    const RETRY_BASE_DELAY = 1000;

    const rateLimiter = createRateLimiter({
      limitPerInterval: RATE_PER_MINUTE,
      intervalMs: 60_000,
    });

    async function fetchPage(offset) {
      const result = await executeWithBackoff(
        async () => {
          const { json } = await friendRequest.getFriends({
            ...args,
            n: PAGE_SIZE,
            offset,
          });
          return Array.isArray(json) ? json : [];
        },
        {
          maxRetries: MAX_RETRY,
          baseDelay: RETRY_BASE_DELAY,
          shouldRetry: (err) => err?.status === 429 || (err?.message || "").includes("429"),
        }
      );
      return result;
    }

    let nextOffset = 0;
    let stopFlag = false;
    const friends = [];

    function getNextOffset() {
      if (stopFlag) return null;
      const cur = nextOffset;
      nextOffset += PAGE_SIZE;
      if (cur > MAX_OFFSET) return null;
      return cur;
    }

    async function worker() {
      while (true) {
        const offset = getNextOffset();
        if (offset === null) break;

        await rateLimiter.wait();

        const page = await fetchPage(offset);
        if (page.length === 0) {
          stopFlag = true;
          break;
        }
        friends.push(...page);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    return friends;
  }

  async function refetchBrokenFriends(friendsArray) {
    for (let i = 0; i < friendsArray.length; i++) {
      const friend = friendsArray[i];
      try {
        let state_input = "offline";
        if (friend.platform === "web") {
          state_input = "active";
        } else if (friend.platform) {
          state_input = "online";
        }
        const ref = friends.get(friend.id);
        if (ref?.state !== state_input) {
          if (AppDebug.debugFriendState) {
            console.log(`Refetching friend state it does not match ${friend.displayName} from ${ref?.state} to ${state_input}`, friend);
          }
          const args = await userRequest.getUser({
            userId: friend.id,
          });
          friendsArray[i] = args.json;
        } else if (friend.location === "traveling") {
          if (AppDebug.debugFriendState) {
            console.log("Refetching traveling friend", friend.displayName);
          }
          const args = await userRequest.getUser({
            userId: friend.id,
          });
          friendsArray[i] = args.json;
        }
      } catch (err) {
        console.error(err);
      }
    }
    return friendsArray;
  }

  async function refreshRemainingFriends(friends) {
    const friendsSet = new Set(friends.map((x) => x.id));
    for (const userId of userStore.currentUser.friends) {
      if (!friendsSet.has(userId)) {
        try {
          if (!watchState.isLoggedIn) {
            console.error(`User isn't logged in`);
            return friends;
          }
          console.log("Fetching remaining friend", userId);
          const args = await userRequest.getUser({ userId });
          friends.push(args.json);
        } catch (err) {
          console.error(err);
        }
      }
    }
    return friends;
  }

  function updateOnlineFriendCounter(forceUpdate = false) {
    const onlineFriendCounts = vipFriends.value.length + onlineFriends.value.length;
    if (onlineFriendCounts !== onlineFriendCount.value || forceUpdate) {
      AppApi.ExecuteVrOverlayFunction("updateOnlineFriendCount", `${onlineFriendCounts}`);
      onlineFriendCount.value = onlineFriendCounts;
    }
  }

  async function getAllUserStats() {
    let ref;
    let item;
    const userIds = [];
    const displayNames = [];
    for (const ctx of friends.values()) {
      userIds.push(ctx.id);
      if (ctx.ref?.displayName) {
        displayNames.push(ctx.ref.displayName);
      }
    }
    if (!userIds.length) {
      return;
    }

    const requestId = ++allUserStatsRequestId;

    const data = await database.getAllUserStats(userIds, displayNames);
    if (requestId !== allUserStatsRequestId) {
      return;
    }

    const dataByDisplayName = new Map();
    const friendsByDisplayName = new Map();

    for (const ref of data) {
      if (ref.displayName && ref.userId) {
        dataByDisplayName.set(ref.displayName, ref.userId);
      }
    }

    for (const ref of friends.values()) {
      if (ref?.ref?.id && ref.ref.displayName) {
        friendsByDisplayName.set(ref.ref.displayName, ref.id);
      }
    }

    const friendListMap = new Map();
    for (item of data) {
      if (!item.userId) {
        item.userId = dataByDisplayName.get(item.displayName);

        if (!item.userId) {
          item.userId = friendsByDisplayName.get(item.displayName);
        }

        if (!item.userId) {
          continue;
        }
      }

      const friend = friendListMap.get(item.userId);
      if (!friend) {
        friendListMap.set(item.userId, item);
        continue;
      }
      if (Date.parse(item.lastSeen) > Date.parse(friend.lastSeen)) {
        friend.lastSeen = item.lastSeen;
      }
      friend.timeSpent += item.timeSpent;
      friend.joinCount += item.joinCount;
      friend.displayName = item.displayName;
      friendListMap.set(item.userId, friend);
    }
    runInSortedFriendsBatch(() => {
      for (item of friendListMap.values()) {
        ref = friends.get(item.userId);
        if (ref?.ref) {
          ref.ref.$joinCount = item.joinCount;
          ref.ref.$lastSeen = item.lastSeen;
          ref.ref.$timeSpent = item.timeSpent;
          reindexSortedFriend(ref);
        }
      }
    });
  }

  function updateFriendLastSeen(userId, lastSeen) {
    const ctx = friends.get(userId);
    if (!ctx?.ref || !lastSeen) {
      return;
    }
    ctx.ref.$lastSeen = lastSeen;
    reindexSortedFriend(ctx);
  }

  async function getAllUserMutualCount() {
    if (!friends.size) {
      return;
    }
    const requestId = ++allUserMutualCountRequestId;
    const mutualCountMap = await database.getMutualCountForAllUsers();
    if (requestId !== allUserMutualCountRequestId) {
      return;
    }
    runInSortedFriendsBatch(() => {
      for (const ctx of friends.values()) {
        if (ctx?.ref) {
          ctx.ref.$mutualCount = 0;
        }
      }
      for (const [userId, mutualCount] of mutualCountMap.entries()) {
        const ref = friends.get(userId);
        if (ref?.ref) {
          ref.ref.$mutualCount = mutualCount;
          reindexSortedFriend(ref);
        }
      }
    });
  }

  async function getAllUserMutualOptedOut() {
    if (!friends.size) {
      return;
    }
    const requestId = ++allUserMutualOptedOutRequestId;
    const metaMap = await database.getMutualGraphMeta();
    if (requestId !== allUserMutualOptedOutRequestId) {
      return;
    }
    runInSortedFriendsBatch(() => {
      for (const ctx of friends.values()) {
        if (ctx?.ref) {
          ctx.ref.$mutualOptedOut = false;
        }
      }
      for (const [userId, meta] of metaMap.entries()) {
        const ref = friends.get(userId);
        if (ref?.ref) {
          ref.ref.$mutualOptedOut = Boolean(meta.optedOut);
        }
      }
    });
  }

  async function initFriendLog(currentUser) {
    refreshFriendsStatus(currentUser);
    const sqlValues = [];
    const friends = await refreshFriends();
    runInSortedFriendsBatch(() => {
      for (const friend of friends) {
        const ref = applyUser(friend);
        const row = {
          userId: ref.id,
          displayName: ref.displayName,
          trustLevel: ref.$trustLevel,
          friendNumber: 0,
        };
        friendLog.set(friend.id, row);
        sqlValues.unshift(row);
      }
    });
    database.setFriendLogCurrentArray(sqlValues);
    await configRepository.setBool(`friendLogInit_${currentUser.id}`, true);
    watchState.isFriendsLoaded = true;
  }

  async function migrateFriendLog(userId) {
    VRCXStorage.Remove(`${userId}_friendLogUpdatedAt`);
    VRCXStorage.Remove(`${userId}_friendLog`);
    friendLogTable.value.data = await VRCXStorage.GetArray(`${userId}_friendLogTable`);
    database.addFriendLogHistoryArray(friendLogTable.value.data);
    VRCXStorage.Remove(`${userId}_friendLogTable`);
    await configRepository.setBool(`friendLogInit_${userId}`, true);
  }

  async function getFriendLog(currentUser) {
    let friend;
    state.friendNumber = await configRepository.getInt(`VRCX_friendNumber_${currentUser.id}`, 0);
    const maxFriendLogNumber = await database.getMaxFriendLogNumber();
    if (state.friendNumber < maxFriendLogNumber) {
      state.friendNumber = maxFriendLogNumber;
    }

    const friendLogCurrentArray = await database.getFriendLogCurrent();
    for (friend of friendLogCurrentArray) {
      friendLog.set(friend.userId, friend);
    }
    refreshFriendsStatus(currentUser);

    await refreshFriends();
    watchState.isFriendsLoaded = true;

    for (friend of friendLogCurrentArray) {
      const ref = userStore.cachedUsers.get(friend.userId);
      if (typeof ref !== "undefined") {
        updateFriendship(ref);
      }
    }
    if (typeof currentUser.friends !== "undefined") {
      runUpdateFriendshipsFlow(currentUser);
    }
  }

  async function initFriendLogHistoryTable() {
    friendLogTable.value.loading = true;
    friendLogTable.value.data = await database.getFriendLogHistory();
    friendLogTable.value.loading = false;
  }

  function setFriendNumber(friendNumber, userId) {
    const ref = friendLog.get(userId);
    if (!ref) {
      return;
    }
    ref.friendNumber = friendNumber;
    friendLog.set(ref.userId, ref);
    database.setFriendLogCurrent(ref);
    const friendRef = friends.get(userId);
    if (friendRef?.ref) {
      friendRef.ref.$friendNumber = friendNumber;
      reindexSortedFriend(friendRef);
    }
  }

  async function tryApplyFriendOrder() {
    const lastUpdate = await configRepository.getString(`VRCX_lastStoreTime_${userStore.currentUser.id}`);
    if (lastUpdate === "-5") {
      return;
    }

    state.friendNumber = 0;
    for (const ref of friendLog.values()) {
      ref.friendNumber = 0;
    }

    const friendOrder = userStore.currentUser.friends;
    runInSortedFriendsBatch(() => {
      for (let i = 0; i < friendOrder.length; i++) {
        const userId = friendOrder[i];
        state.friendNumber++;
        setFriendNumber(state.friendNumber, userId);
      }
    });
    if (state.friendNumber === 0) {
      state.friendNumber = friends.size;
    }
    console.log("Applied friend order from API", state.friendNumber);
    await configRepository.setInt(`VRCX_friendNumber_${userStore.currentUser.id}`, state.friendNumber);
    await configRepository.setString(`VRCX_lastStoreTime_${userStore.currentUser.id}`, "-5");
  }

  async function _tryRestoreFriendNumber() {
    const lastUpdate = await configRepository.getString(`VRCX_lastStoreTime_${userStore.currentUser.id}`);
    if (lastUpdate === "-4") {
      return;
    }
    let _status = false;
    state.friendNumber = 0;
    for (const ref of friendLog.values()) {
      ref.friendNumber = 0;
    }
    try {
      if (lastUpdate) {
        _status = await restoreFriendNumber();
      }

      applyFriendLogFriendOrderInReverse();
    } catch (err) {
      console.error(err);
    }

    await configRepository.setString(`VRCX_lastStoreTime_${userStore.currentUser.id}`, "-4");
  }

  async function restoreFriendNumber() {
    let message;
    let storedData = null;
    try {
      const data = await configRepository.getString(`VRCX_friendOrder_${userStore.currentUser.id}`);
      if (data) {
        storedData = JSON.parse(data);
      }
    } catch (err) {
      console.error(err);
    }
    if (!storedData || storedData.length === 0) {
      message = "whomp whomp, no friend order backup found";
      console.error(message);
      return false;
    }

    const friendLogTable = getFriendLogFriendOrder();

    const machList = [];
    for (let i = 0; i < Object.keys(storedData).length; i++) {
      const key = Object.keys(storedData)[i];
      const value = storedData[key];
      const item = parseFriendOrderBackup(friendLogTable, key, value);
      machList.push(item);
    }
    machList.sort((a, b) => b.matches - a.matches);
    console.log(`friendLog: ${friendLogTable.length} friendOrderBackups:`, machList);

    const bestBackup = machList[0];
    if (!bestBackup?.isValid) {
      message = "whomp whomp, no valid backup found";
      console.error(message);
      return false;
    }

    applyFriendOrderBackup(bestBackup.table);
    applyFriendLogFriendOrder();
    await configRepository.setInt(`VRCX_friendNumber_${userStore.currentUser.id}`, state.friendNumber);
    return true;
  }

  function applyFriendLogFriendOrderInReverse() {
    state.friendNumber = friends.size + 1;
    const friendLogTable = getFriendLogFriendOrder();
    for (let i = friendLogTable.length - 1; i > -1; i--) {
      const friendLogEntry = friendLogTable[i];
      const ref = friendLog.get(friendLogEntry.id);
      if (!ref) {
        continue;
      }
      if (ref.friendNumber) {
        break;
      }
      ref.friendNumber = --state.friendNumber;
      friendLog.set(ref.userId, ref);
      database.setFriendLogCurrent(ref);
      const friendRef = friends.get(friendLogEntry.id);
      if (friendRef?.ref) {
        friendRef.ref.$friendNumber = ref.friendNumber;
      }
    }
    state.friendNumber = friends.size;
    console.log("Applied friend order from friendLog");
  }

  function getFriendLogFriendOrder() {
    const result = [];
    for (let i = 0; i < friendLogTable.value.data.length; i++) {
      const ref = friendLogTable.value.data[i];
      if (ref.type !== "Friend") {
        continue;
      }
      if (result.findIndex((x) => x.id === ref.userId) !== -1) {
        continue;
      }
      result.push({
        id: ref.userId,
        displayName: ref.displayName,
        created_at: ref.created_at,
      });
    }
    result.sort(compareByCreatedAtAscending);
    return result;
  }

  function parseFriendOrderBackup(friendLogTable, created_at, backupUserIds) {
    let i;
    const backupTable = [];
    for (i = 0; i < backupUserIds.length; i++) {
      const userId = backupUserIds[i];
      const ctx = friends.get(userId);
      if (ctx) {
        backupTable.push({
          id: ctx.id,
          displayName: ctx.name,
        });
      }
    }

    let maxMatches = 0;
    let currentMatches = 0;
    let backupIndex = 0;
    for (i = 0; i < friendLogTable.length; i++) {
      let _isMatch = false;
      const ref = friendLogTable[i];
      if (backupIndex <= 0) {
        backupIndex = backupTable.findIndex((x) => x.id === ref.id);
        if (backupIndex !== -1) {
          currentMatches = 1;
        }
      } else if (backupTable[backupIndex].id === ref.id) {
        currentMatches++;
        _isMatch = true;
      } else {
        backupIndex = backupTable.findIndex((x) => x.id === ref.id);
        if (backupIndex !== -1) {
          currentMatches = 1;
        }
      }
      if (backupIndex === backupTable.length - 1) {
        backupIndex = 0;
      } else {
        backupIndex++;
      }
      if (currentMatches > maxMatches) {
        maxMatches = currentMatches;
      }
    }

    const lerp = (a, b, alpha) => {
      return a + alpha * (b - a);
    };
    return {
      matches: parseFloat(`${maxMatches}.${created_at}`),
      table: backupUserIds,
      isValid: maxMatches > lerp(4, 10, backupTable.length / 1000),
    };
  }

  function applyFriendOrderBackup(userIdOrder) {
    for (let i = 0; i < userIdOrder.length; i++) {
      const userId = userIdOrder[i];
      const ctx = friends.get(userId);
      const ref = ctx?.ref;
      if (!ref || ref.$friendNumber) {
        continue;
      }
      const friendLogCurrent = {
        userId,
        displayName: ref.displayName,
        trustLevel: ref.$trustLevel,
        friendNumber: i + 1,
      };
      friendLog.set(userId, friendLogCurrent);
      database.setFriendLogCurrent(friendLogCurrent);
      state.friendNumber = i + 1;
    }
  }

  function applyFriendLogFriendOrder() {
    const friendLogTable = getFriendLogFriendOrder();
    if (state.friendNumber === 0) {
      console.log("No backup applied, applying friend log in reverse");

      return;
    }
    for (const friendLogEntry of friendLogTable) {
      const ref = friendLog.get(friendLogEntry.id);
      if (!ref || ref.friendNumber) {
        continue;
      }
      ref.friendNumber = ++state.friendNumber;
      friendLog.set(ref.userId, ref);
      database.setFriendLogCurrent(ref);
      const friendRef = friends.get(friendLogEntry.id);
      if (friendRef?.ref) {
        friendRef.ref.$friendNumber = ref.friendNumber;
      }
    }
  }

  function resetFriendLog() {
    friendLog.clear();
  }

  function setIsRefreshFriendsLoading(value) {
    isRefreshFriendsLoading.value = value;
  }

  return {
    state,

    friends,

    vipFriends,
    onlineFriends,
    activeFriends,
    offlineFriends,
    friendsInSameInstance,

    allFavoriteFriendIds,
    allFavoriteOnlineFriends,
    localFavoriteFriends,
    isRefreshFriendsLoading,
    onlineFriendCount,
    friendLog,
    friendLogTable,
    pendingOfflineMap,
    pendingOfflineDelay,

    updateLocalFavoriteFriends,
    updateSidebarFavorites,
    deleteFriend,
    refreshFriendsStatus,
    addFriend,
    refreshFriends,
    updateOnlineFriendCounter,
    getAllUserStats,
    updateFriendLastSeen,
    getAllUserMutualCount,
    getAllUserMutualOptedOut,
    initFriendLog,
    migrateFriendLog,
    getFriendLog,
    tryApplyFriendOrder,
    resetFriendLog,
    reindexSortedFriend,
    resetDerivedDebugCounters,
    getDerivedDebugCounters,
    initFriendLogHistoryTable,
    setIsRefreshFriendsLoading,
  };
});
