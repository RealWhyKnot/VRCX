import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "vue-router";

import { i18n } from "../plugins/i18n";
import { getUserMemo } from "../coordinators/memo-coordinator";
import { runInitFriendsListFlow } from "../coordinators/friend-sync-coordinator";
import { runPendingOfflineTickFlow, runUpdateFriendFlow } from "../coordinators/friend-presence-coordinator";
import { updateFriendship, runUpdateFriendshipsFlow } from "../coordinators/friend-relationship-coordinator";
import { applyUser } from "../coordinators/user-profile-apply";
import { database } from "../services/database";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useGeneralSettingsStore } from "./settings/general";
import { useGroupStore } from "./group";
import { useLocationStore } from "./location";
import { useUserStore } from "./user";
import { useDashboardStore } from "./dashboard";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";

import * as workerTimers from "worker-timers";

import { createSortedFriends } from "./friend-sorted";
import { bulkRefreshFriends, refetchBrokenFriends, refreshRemainingFriends } from "./friend-refresh";
import { tryApplyFriendOrder as applyFriendOrderFromApi } from "./friend-order";
import {
  getAllUserMutualCount as fetchMutualCount,
  getAllUserMutualOptedOut as fetchMutualOptedOut,
  getAllUserStats as fetchAllUserStats,
  updateFriendLastSeen as applyFriendLastSeen,
} from "./friend-stats";
import type {
  FriendContext,
  FriendCurrentUser,
  FriendListEntry,
  FriendLogRow,
  FriendLogSnapshotRow,
  FriendLogTable,
  FriendRequestIds,
  FriendState,
  FriendStatusSource,
  FriendStoreContext,
  FriendStoreState,
  PendingOfflineEntry,
} from "./friend-types";
import { isFriendLogHistoryRow, isVrcxUser } from "./friend-types";
import { createFriendDerived } from "./friend-derived";
import { markStartup, reportStartup } from "../services/startup-trace";
import type { VrcxUser } from "../types/vrcx";

function logFailure(err: unknown): void {
  console.error(err);
}

export const useFriendStore = defineStore("Friend", () => {
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const generalSettingsStore = useGeneralSettingsStore();
  const userStore = useUserStore();
  const groupStore = useGroupStore();
  const locationStore = useLocationStore();
  const dashboardStore = useDashboardStore();

  const router = useRouter();

  const state = reactive<FriendStoreState>({
    friendNumber: 0,
  });

  const friendLog = new Map<string, FriendLogRow>();

  const friends = reactive(new Map<string, FriendContext>());

  const localFavoriteFriends = reactive(new Set<string>());
  const sorted = createSortedFriends(friends, () => appearanceSettingsStore.sidebarSortMethods);
  const sortedFriends = sorted.list;
  const requestIds: FriendRequestIds = {
    stats: 0,
    mutualCount: 0,
    mutualOptedOut: 0,
  };

  const {
    allFavoriteFriendIds,
    allFavoriteOnlineFriends,
    vipFriends,
    onlineFriends,
    activeFriends,
    offlineFriends,
    friendsInSameInstance,
    resetDerivedDebugCounters,
    getDerivedDebugCounters,
  } = createFriendDerived({ friends, sortedFriends, appearanceSettingsStore, generalSettingsStore, locationStore });

  function findCachedUser(userId: string): VrcxUser | undefined {
    const cached: unknown = userStore.cachedUsers.get(userId);
    return isVrcxUser(cached) ? cached : undefined;
  }

  const isRefreshFriendsLoading = ref(false);
  const onlineFriendCount = ref(0);

  const pendingOfflineDelay = 170000;
  let pendingOfflineWorker: number | null = null;
  const pendingOfflineMap = new Map<string, PendingOfflineEntry>();

  const friendLogTable = ref<FriendLogTable>({
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

  const friendContext: FriendStoreContext = {
    state,
    friends,
    friendLog,
    friendLogTable: friendLogTable.value,
    requestIds,
    reindexSortedFriend: sorted.reindex,
    runInSortedFriendsBatch: sorted.runInBatch,
  };

  watch(
    [router.currentRoute, () => dashboardStore.dashboards],
    ([value]) => {
      const dashboardId = value.name === "dashboard" ? value.params["id"] : undefined;
      const isDashboardPanel = value.name === "dashboard" && typeof dashboardId === "string" && dashboardStore.getDashboard(dashboardId, "friend-log");
      if (value.name === "friend-log" || isDashboardPanel) {
        initFriendLogHistoryTable().catch(logFailure);
      } else {
        friendLogTable.value.data = [];
      }
    },
    { immediate: true, deep: true }
  );

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      friends.clear();
      sorted.reset();
      state.friendNumber = 0;
      friendLog.clear();
      friendLogTable.value.data = [];
      groupStore.clearGroupInstances();
      onlineFriendCount.value = 0;
      pendingOfflineMap.clear();
      if (isLoggedIn) {
        runInitFriendsListFlow(i18n.global.t).catch(logFailure);
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
      sorted.rebuild();
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

  async function init(): Promise<void> {
    const friendLogTableFiltersValue: unknown = JSON.parse(await configRepository.getString("VRCX_friendLogTableFilters", "[]"));
    const typeFilter = friendLogTable.value.filters[0];
    if (typeFilter) {
      typeFilter.value = friendLogTableFiltersValue;
    }
  }

  init().catch(logFailure);

  function updateLocalFavoriteFriends(): void {
    localFavoriteFriends.clear();
    for (const id of allFavoriteFriendIds.value) {
      localFavoriteFriends.add(id);
    }
    updateSidebarFavorites();
  }

  function updateSidebarFavorites(): void {
    sorted.runInBatch(() => {
      for (const ctx of friends.values()) {
        const isVIP = localFavoriteFriends.has(ctx.id);
        if (ctx.isVIP === isVIP) {
          continue;
        }
        ctx.isVIP = isVIP;
        sorted.reindex(ctx);
      }
    });
  }

  function pendingOfflineWorkerFunction(): void {
    pendingOfflineWorker = workerTimers.setInterval(() => {
      runPendingOfflineTickFlow().catch(logFailure);
    }, 1000);
  }

  function deleteFriend(id: string): void {
    const ctx = friends.get(id);
    if (typeof ctx === "undefined") {
      return;
    }
    friends.delete(id);
    sorted.remove(id);
  }

  function refreshFriendsStatus(source: FriendStatusSource): { added: string[]; removed: string[] } {
    return sorted.runInBatch(() => {
      const map = new Map<string, FriendState>();
      for (const id of source.friends) {
        map.set(id, "offline");
      }
      for (const id of source.offlineFriends) {
        map.set(id, "offline");
      }
      for (const id of source.activeFriends) {
        map.set(id, "active");
      }
      for (const id of source.onlineFriends) {
        map.set(id, "online");
      }
      const added: string[] = [];
      const removed: string[] = [];
      for (const [id, stateInput] of map) {
        if (friends.has(id)) {
          runUpdateFriendFlow(id, stateInput).catch(logFailure);
        } else {
          addFriend(id, stateInput);
          added.push(id);
        }
      }
      for (const id of friends.keys()) {
        if (!map.has(id)) {
          deleteFriend(id);
          removed.push(id);
        }
      }
      return { added, removed };
    });
  }

  function addFriend(id: string, stateInput?: FriendState | ""): void {
    if (friends.has(id)) {
      return;
    }
    const ref = findCachedUser(id);
    const isVIP = localFavoriteFriends.has(id);
    let name = "";
    const friend = friendLog.get(id);
    if (friend) {
      name = friend.displayName ?? "";
    }
    const ctx: FriendContext = reactive({
      id,
      state: stateInput === "" || stateInput === undefined ? "offline" : stateInput,
      isVIP,
      ref,
      name,
      pendingOffline: false,
      $nickName: "",
    });
    if (watchState.isFriendsLoaded) {
      getUserMemo(id).catch(logFailure);
    }
    if (typeof ref === "undefined") {
      const friendLogRef = friendLog.get(id);
      if (friendLogRef?.displayName) {
        ctx.name = friendLogRef.displayName;
      }
    } else {
      ctx.name = ref.displayName;
    }
    friends.set(id, ctx);
    watchState.isLoggedIn = true;

    sorted.reindex(ctx);
  }

  async function refreshFriends(): Promise<FriendListEntry[]> {
    isRefreshFriendsLoading.value = true;
    try {
      const onlineFriendsList = await bulkRefreshFriends({
        offline: false,
      });
      const offlineFriendsList = await bulkRefreshFriends({
        offline: true,
      });
      let friendsList = onlineFriendsList.concat(offlineFriendsList);
      friendsList = await refetchBrokenFriends(friendsList, friends);
      if (!watchState.isFriendsLoaded) {
        friendsList = await refreshRemainingFriends(friendsList, userStore.currentUser.friends);
      }

      isRefreshFriendsLoading.value = false;
      return friendsList;
    } catch (err) {
      isRefreshFriendsLoading.value = false;
      throw err;
    }
  }

  function updateOnlineFriendCounter(shouldForceUpdate = false): void {
    const onlineFriendCounts = vipFriends.value.length + onlineFriends.value.length;
    if (onlineFriendCounts !== onlineFriendCount.value || shouldForceUpdate) {
      AppApi.ExecuteVrOverlayFunction("updateOnlineFriendCount", `${onlineFriendCounts}`).catch(logFailure);
      onlineFriendCount.value = onlineFriendCounts;
    }
  }

  function getAllUserStats(): Promise<void> {
    return fetchAllUserStats(friendContext);
  }

  function updateFriendLastSeen(userId: string, lastSeen: string | null): void {
    applyFriendLastSeen(friendContext, userId, lastSeen);
  }

  function getAllUserMutualCount(): Promise<void> {
    return fetchMutualCount(friendContext);
  }

  function getAllUserMutualOptedOut(): Promise<void> {
    return fetchMutualOptedOut(friendContext);
  }

  async function initFriendLog(currentUser: FriendCurrentUser): Promise<void> {
    refreshFriendsStatus(currentUser);
    const sqlValues: FriendLogSnapshotRow[] = [];
    const friendList = await refreshFriends();
    sorted.runInBatch(() => {
      for (const friend of friendList) {
        const ref = applyUser(friend);
        const row: FriendLogSnapshotRow = {
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
    markStartup("friends loaded");
    reportStartup();
  }

  async function migrateFriendLog(userId: string): Promise<void> {
    await VRCXStorage.Remove(`${userId}_friendLogUpdatedAt`);
    await VRCXStorage.Remove(`${userId}_friendLog`);
    const legacyRows = await VRCXStorage.GetArray(`${userId}_friendLogTable`);
    friendLogTable.value.data = legacyRows.filter(isFriendLogHistoryRow);
    database.addFriendLogHistoryArray(friendLogTable.value.data);
    await VRCXStorage.Remove(`${userId}_friendLogTable`);
    await configRepository.setBool(`friendLogInit_${userId}`, true);
  }

  async function getFriendLog(currentUser: FriendCurrentUser): Promise<void> {
    state.friendNumber = await configRepository.getInt(`VRCX_friendNumber_${currentUser.id}`, 0);
    const maxFriendLogNumber = await database.getMaxFriendLogNumber();
    if (maxFriendLogNumber !== null && state.friendNumber < maxFriendLogNumber) {
      state.friendNumber = maxFriendLogNumber;
    }

    const friendLogCurrentArray = await database.getFriendLogCurrent();
    for (const friend of friendLogCurrentArray) {
      if (friend.userId === null) {
        continue;
      }
      friendLog.set(friend.userId, {
        userId: friend.userId,
        displayName: friend.displayName,
        trustLevel: friend.trustLevel,
        friendNumber: friend.friendNumber,
      });
    }
    refreshFriendsStatus(currentUser);

    await refreshFriends();
    watchState.isFriendsLoaded = true;
    markStartup("friends loaded");
    reportStartup();

    for (const friend of friendLogCurrentArray) {
      if (friend.userId === null) {
        continue;
      }
      const ref = findCachedUser(friend.userId);
      if (typeof ref !== "undefined") {
        updateFriendship(ref);
      }
    }
    if (typeof currentUser.friends !== "undefined") {
      runUpdateFriendshipsFlow(currentUser);
    }
  }

  async function initFriendLogHistoryTable(): Promise<void> {
    friendLogTable.value.loading = true;
    friendLogTable.value.data = await database.getFriendLogHistory();
    friendLogTable.value.loading = false;
  }

  function tryApplyFriendOrder(): Promise<void> {
    return applyFriendOrderFromApi(friendContext, userStore.currentUser);
  }

  function resetFriendLog(): void {
    friendLog.clear();
  }

  function setIsRefreshFriendsLoading(isLoading: boolean): void {
    isRefreshFriendsLoading.value = isLoading;
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
    reindexSortedFriend: sorted.reindex,
    resetDerivedDebugCounters,
    getDerivedDebugCounters,
    initFriendLogHistoryTable,
    setIsRefreshFriendsLoading,
  };
});
