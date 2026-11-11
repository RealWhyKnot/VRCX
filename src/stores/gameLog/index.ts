import { reactive, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "vue-router";

import { compareGameLogRows, gameLogSearchFilter } from "../../shared/utils/game-log";
import { findUserByDisplayName } from "../../shared/utils/user";
import { formatSeconds } from "../../shared/utils/base/format";
import { getGroupName } from "../../shared/utils/group";
import { createMediaParsers } from "./media-parsers";
import { createNowPlayingSpecHandler } from "./now-playing-spec";
import { gameLogDatabase } from "./game-log-database";
import { createSessionsState } from "./session-state";
import { SESSIONS_DATE_RANGE_MAX_DAYS, SESSIONS_EVENT_FILTER_TYPES, toSessionFilterList } from "./session-query";
import { tryLoadPlayerList } from "../../coordinators/game-log-coordinator";
import { useAdvancedSettingsStore } from "../settings/advanced";
import { useFriendStore } from "../friend";
import { useNotificationStore } from "../notification";
import { useDashboardStore } from "../dashboard";

import { useUserStore } from "../user";
import { useVrStore } from "../vr";
import { useVrcxStore } from "../vrcx";
import { watchState } from "../../services/watch-state";

import { configRepository } from "../../services/config";

import * as workerTimers from "worker-timers";

import type { NotyEntry } from "../notification/types";
import type { GameLogEntry, GameLogLocationInput, GameLogTableState, NowPlaying, NowPlayingUpdate, PersistedGameLogEntry } from "./types";

function createEmptyNowPlaying(): NowPlaying {
  return {
    url: "",
    name: "",
    videoName: "",
    length: 0,
    startTime: 0,
    offset: 0,
    elapsed: 0,
    percentage: 0,
    remainingText: "",
    playing: false,
    thumbnailUrl: "",
    speed: 1,
    paused: false,
    spec: false,
    urlHidden: false,
  };
}

function parseSavedFilters(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  return toSessionFilterList(parsed);
}

export const useGameLogStore = defineStore("GameLog", () => {
  const notificationStore = useNotificationStore();
  const vrStore = useVrStore();
  const friendStore = useFriendStore();
  const userStore = useUserStore();

  const vrcxStore = useVrcxStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const dashboardStore = useDashboardStore();

  const router = useRouter();

  const state = reactive({
    lastLocationAvatarList: new Map<string, string>(),
  });

  const gameLogTableData = shallowRef<GameLogEntry[]>([]);
  const gameLogTable = ref<GameLogTableState>({
    loading: false,
    search: "",
    filter: [],
    pageSize: 20,
    pageSizeLinked: true,
    vip: false,
  });

  const {
    sessionsViewMode,
    sessionsSegments,
    sessionsLoading,
    sessionsHasMore,
    sessionsVipFilter,
    sessionsEventFilters,
    sessionsSearch,
    sessionsDateFrom,
    sessionsDateTo,
    sessionsDateRangeActive,
    sessionsEventFilterSelection,
    sessionsRawEvents,
    loadSessionsSegments,
    loadMoreSessionsSegments,
    jumpToSessionsAnchor,
    toggleSessionsVipFilter,
    handleSessionsEventFilterChange,
    setSessionsSearch,
    setSessionsDateRange,
    clearSessionsDateRange,
    appendSessionsEntry,
    rebuildSessionsDebounced,
    resetSessionsData,
  } = createSessionsState({
    vrcxStore,
    gameLogIsFriend,
    gameLogIsFavorite,
  });

  const nowPlaying = ref<NowPlaying>(createEmptyNowPlaying());
  let nowPlayingTimer: ReturnType<typeof workerTimers.setTimeout> | null = null;
  let nowPlayingEntry: PersistedGameLogEntry | null = null;

  const lastVideoUrl = ref("");

  const lastResourceloadUrl = ref("");

  const latestGameLogEntry = ref<GameLogEntry | null>(null);
  let initPromise: Promise<void> = Promise.resolve();

  watch(
    () => watchState.isLoggedIn,
    () => {
      gameLogTableData.value = [];
      resetSessionsData();
    },
    { flush: "sync" }
  );

  watch(
    [router.currentRoute, () => dashboardStore.dashboards],
    async ([value]) => {
      await initPromise;
      const dashboardId = value.name === "dashboard" ? value.params["id"] : undefined;
      const isDashboardPanel = value.name === "dashboard" && typeof dashboardId === "string" && dashboardStore.getDashboard(dashboardId, "game-log");
      if (value.name === "game-log" || isDashboardPanel) {
        if (sessionsViewMode.value === "sessions") {
          await loadSessionsSegments();
        } else {
          await gameLogTableLookup();
        }
      } else {
        gameLogTableData.value = [];
        resetSessionsData();
      }
    },
    { immediate: true, deep: true }
  );

  watch(
    () => watchState.isFavoritesLoaded,
    async (isFavoritesLoaded) => {
      if (isFavoritesLoaded && gameLogTable.value.vip) {
        await gameLogTableLookup();
      }
    }
  );

  watch(
    () => watchState.isFriendsLoaded,
    async (isFriendsLoaded) => {
      if (isFriendsLoaded) {
        await tryLoadPlayerList();
      }
    },
    { flush: "sync" }
  );

  async function init() {
    gameLogTable.value.filter = parseSavedFilters(await configRepository.getString("VRCX_gameLogTableFilters", "[]"));
    gameLogTable.value.vip = await configRepository.getBool("VRCX_gameLogTableVIPFilter", false);
    const savedViewMode = await configRepository.getString("VRCX_gameLogViewMode", "table");
    if (savedViewMode === "sessions" || savedViewMode === "table") {
      sessionsViewMode.value = savedViewMode;
    }
  }

  initPromise = init();

  function insertGameLogSorted(entry: GameLogEntry) {
    const arr = gameLogTableData.value;
    if (arr.length === 0) {
      gameLogTableData.value = [entry];
      return;
    }
    if (compareGameLogRows(entry, arr[0]) < 0) {
      gameLogTableData.value = [entry, ...arr];
      return;
    }
    if (compareGameLogRows(entry, arr[arr.length - 1]) > 0) {
      gameLogTableData.value = [...arr, entry];
      return;
    }
    for (let i = 1; i < arr.length; i++) {
      if (compareGameLogRows(entry, arr[i]) < 0) {
        gameLogTableData.value = [...arr.slice(0, i), entry, ...arr.slice(i)];
        return;
      }
    }
    gameLogTableData.value = [...arr, entry];
  }

  function clearNowPlaying() {
    stopNowPlayingTicker();
    nowPlayingEntry = null;
    nowPlaying.value = createEmptyNowPlaying();
    vrStore.updateVrNowPlaying();
  }

  async function updateNowPlayingVideoName(videoName: string | null | undefined) {
    const entry = nowPlayingEntry;
    if (!entry || entry.videoName || !videoName) {
      return;
    }
    const updated: PersistedGameLogEntry = { ...entry, videoName };
    nowPlayingEntry = updated;
    await gameLogDatabase.updateGamelogVideoPlayName(entry.rowId, videoName);

    if (gameLogTableData.value.includes(entry)) {
      gameLogTableData.value = gameLogTableData.value.map((row) => (row === entry ? updated : row));
    }
    const isSameEvent = (event: GameLogEntry) => event.type === "VideoPlay" && event.created_at === entry.created_at && event.videoUrl === entry.videoUrl;
    if (sessionsRawEvents.value.some(isSameEvent)) {
      sessionsRawEvents.value = sessionsRawEvents.value.map((event) => (isSameEvent(event) ? { ...event, videoName } : event));
      rebuildSessionsDebounced();
    }
  }

  function resetLastMediaUrls() {
    lastVideoUrl.value = "";
    lastResourceloadUrl.value = "";
  }

  async function setNowPlaying(data: NowPlayingUpdate) {
    const ctx = structuredClone(data);
    if (nowPlaying.value.url !== ctx.videoUrl) {
      if (!ctx.userId && ctx.displayName) {
        ctx.userId = findUserByDisplayName(userStore.cachedUsers, ctx.displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "";
      }
      const logEntry = ctx.urlHidden ? { ...ctx, videoUrl: "" } : ctx;
      const videoEvent = { ...logEntry, type: "VideoPlay" };
      const { displayName, userId, location, videoName, ...rest } = logEntry;
      const notyEntry: NotyEntry = {
        ...rest,
        type: "VideoPlay",
        ...(typeof displayName === "string" ? { displayName } : {}),
        ...(typeof userId === "string" ? { userId } : {}),
        ...(typeof location === "string" ? { location } : {}),
        ...(typeof videoName === "string" ? { videoName } : {}),
      };
      notificationStore.queueGameLogNoty(notyEntry);
      const persisted = await gameLogDatabase.addGamelogVideoPlayToDatabase({
        created_at: logEntry.created_at,
        videoUrl: logEntry.videoUrl,
        videoName: logEntry.videoName ?? null,
        videoId: logEntry.videoId ?? null,
        location: logEntry.location ?? null,
        displayName: logEntry.displayName ?? null,
        userId: logEntry.userId ?? null,
      });
      const persistedEntry: PersistedGameLogEntry | undefined = persisted ? { ...videoEvent, rowId: persisted.rowId } : undefined;
      nowPlayingEntry = persistedEntry ?? null;
      if (persistedEntry) {
        addGameLog(persistedEntry);
      }

      let name = "";
      if (ctx.videoName) {
        name = ctx.displayName ? `${ctx.videoName} (${ctx.displayName})` : ctx.videoName;
      }
      nowPlaying.value = {
        ...createEmptyNowPlaying(),
        url: ctx.videoUrl,
        name,
        videoName: ctx.videoName ?? "",
        length: ctx.videoLength,
        startTime: Date.parse(ctx.created_at) / 1000,
        offset: ctx.videoPos,
        thumbnailUrl: ctx.thumbnailUrl,
      };
    } else {
      nowPlaying.value = {
        ...nowPlaying.value,
        length: ctx.videoLength,
        offset: ctx.videoPos,
        elapsed: 0,
        percentage: 0,
        remainingText: "",
        thumbnailUrl: ctx.thumbnailUrl,
      };
      if (ctx.updatedAt && ctx.videoPos) {
        nowPlaying.value.startTime = Date.parse(ctx.updatedAt) / 1000 - ctx.videoPos;
      } else {
        nowPlaying.value.startTime = Date.parse(ctx.created_at) / 1000 - ctx.videoPos;
      }
    }
    vrStore.updateVrNowPlaying();
    if (!nowPlaying.value.playing && ctx.videoLength > 0) {
      nowPlaying.value.playing = true;
      startNowPlayingTicker();
    }
  }

  const { addGameLogVideo, addGameLogVRDancing, addGameLogLSMedia, addGameLogPopcornPalace } = createMediaParsers({
    nowPlaying,
    setNowPlaying,
    clearNowPlaying,
    userStore,
    advancedSettingsStore,
  });

  const { handleNowPlayingEvent, resetNowPlayingProducers, hasNowPlayingProducer } = createNowPlayingSpecHandler({
    nowPlaying,
    setNowPlaying,
    clearNowPlaying,
    startNowPlayingTicker,
    updateNowPlayingVideoName,
    addGameLogVideo,
  });

  function stopNowPlayingTicker() {
    if (nowPlayingTimer !== null) {
      workerTimers.clearTimeout(nowPlayingTimer);
      nowPlayingTimer = null;
    }
  }

  function startNowPlayingTicker() {
    stopNowPlayingTicker();
    updateNowPlaying();
  }

  function updateNowPlaying() {
    nowPlayingTimer = null;
    const np = nowPlaying.value;
    if (!np.playing) {
      return;
    }

    if (!np.paused) {
      const now = Date.now() / 1000;
      np.elapsed = Math.round((now - np.startTime) * np.speed * 10) / 10;
    }
    if (np.elapsed >= np.length) {
      if (!np.spec) {
        clearNowPlaying();
        return;
      }
      np.elapsed = np.length;
    }
    np.remainingText = formatSeconds(np.length - np.elapsed);
    np.percentage = Math.round(((np.elapsed * 100) / np.length) * 10) / 10;
    vrStore.updateVrNowPlaying();
    if (!np.paused && np.elapsed < np.length) {
      nowPlayingTimer = workerTimers.setTimeout(() => updateNowPlaying(), 1000);
    }
  }

  function gameLogIsFriend(row: GameLogEntry): boolean {
    if (typeof row.isFriend !== "undefined") {
      return row.isFriend;
    }
    if (!row.userId) {
      return false;
    }
    return friendStore.friends.has(row.userId);
  }

  function gameLogIsFavorite(row: GameLogEntry): boolean {
    if (typeof row.isFavorite !== "undefined") {
      return row.isFavorite;
    }
    if (!row.userId) {
      return false;
    }
    return friendStore.localFavoriteFriends.has(row.userId);
  }

  async function gameLogTableLookup() {
    await configRepository.setString("VRCX_gameLogTableFilters", JSON.stringify(gameLogTable.value.filter));
    await configRepository.setBool("VRCX_gameLogTableVIPFilter", gameLogTable.value.vip);
    gameLogTable.value.loading = true;
    try {
      let vipList: string[] = [];
      if (gameLogTable.value.vip) {
        vipList = Array.from(friendStore.localFavoriteFriends.values());
      }
      const search = gameLogTable.value.search.trim();
      let rows: GameLogEntry[] = [];
      if (search) {
        rows = await gameLogDatabase.searchGameLogDatabase(search, gameLogTable.value.filter, vipList, vrcxStore.searchLimit);
      } else {
        rows = await gameLogDatabase.lookupGameLogDatabase(gameLogTable.value.filter, vipList);
      }

      for (const row of rows) {
        row.isFriend = gameLogIsFriend(row);
        row.isFavorite = gameLogIsFavorite(row);
      }
      gameLogTableData.value = rows;
    } finally {
      gameLogTable.value.loading = false;
    }
  }

  function addGameLog(entry: GameLogEntry) {
    entry.isFriend = gameLogIsFriend(entry);
    entry.isFavorite = gameLogIsFavorite(entry);

    latestGameLogEntry.value = entry;

    if (
      entry.type === "LocationDestination" ||
      entry.type === "AvatarChange" ||
      entry.type === "ChatBoxMessage" ||
      (entry.userId === userStore.currentUser.id && (entry.type === "OnPlayerJoined" || entry.type === "OnPlayerLeft"))
    ) {
      return;
    }
    if (sessionsViewMode.value === "table") {
      if (
        gameLogTable.value.vip &&
        (!entry.userId || !friendStore.localFavoriteFriends.has(entry.userId)) &&
        (entry.type === "OnPlayerJoined" ||
          entry.type === "OnPlayerLeft" ||
          entry.type === "VideoPlay" ||
          entry.type === "PortalSpawn" ||
          entry.type === "External")
      ) {
        return;
      }
      if (gameLogTable.value.filter.length > 0 && !gameLogTable.value.filter.includes(entry.type)) {
        return;
      }
      if (!gameLogSearch(entry)) {
        return;
      }
      insertGameLogSorted(entry);
      sweepGameLog();
    }

    if (sessionsViewMode.value === "sessions") {
      appendSessionsEntry(entry);
    }
  }

  async function addGamelogLocationToDatabase(input: GameLogLocationInput) {
    const groupName = await getGroupName(input.location);
    const entry = {
      ...input,
      groupName,
    };
    return gameLogDatabase.addGamelogLocationToDatabase(entry);
  }

  function gameLogSearch(row: GameLogEntry) {
    return gameLogSearchFilter(row, gameLogTable.value.search);
  }

  function sweepGameLog() {
    const j = gameLogTableData.value.length;
    if (j > vrcxStore.maxTableSize + 50) {
      gameLogTableData.value = gameLogTableData.value.slice(0, -50);
    }
  }

  function setLastVideoUrl(value: string) {
    lastVideoUrl.value = value;
  }

  function setLastResourceloadUrl(value: string) {
    lastResourceloadUrl.value = value;
  }

  async function setSessionsViewMode(mode: string) {
    if (mode !== "sessions" && mode !== "table") {
      return;
    }
    if (sessionsViewMode.value === mode) {
      return;
    }
    sessionsViewMode.value = mode;
    await configRepository.setString("VRCX_gameLogViewMode", mode);
    if (mode === "table") {
      await gameLogTableLookup();
    } else {
      gameLogTableData.value = [];
      await loadSessionsSegments();
    }
  }

  return {
    state,

    nowPlaying,
    gameLogTable,
    gameLogTableData,
    lastVideoUrl,
    lastResourceloadUrl,
    latestGameLogEntry,

    sessionsViewMode,
    sessionsSegments,
    sessionsLoading,
    sessionsHasMore,
    sessionsVipFilter,
    sessionsEventFilters,
    sessionsSearch,
    sessionsDateFrom,
    sessionsDateTo,
    sessionsEventFilterSelection,
    sessionsDateRangeActive,
    sessionsEventFilterTypes: SESSIONS_EVENT_FILTER_TYPES,
    sessionsDateRangeMaxDays: SESSIONS_DATE_RANGE_MAX_DAYS,

    clearNowPlaying,
    resetLastMediaUrls,
    gameLogIsFriend,
    gameLogIsFavorite,
    gameLogTableLookup,
    addGameLog,
    addGamelogLocationToDatabase,

    loadSessionsSegments,
    loadMoreSessionsSegments,
    jumpToSessionsAnchor,
    setSessionsViewMode,
    toggleSessionsVipFilter,
    handleSessionsEventFilterChange,
    setSessionsSearch,
    setSessionsDateRange,
    clearSessionsDateRange,

    addGameLogVideo,
    addGameLogVRDancing,
    addGameLogLSMedia,
    addGameLogPopcornPalace,
    handleNowPlayingEvent,
    resetNowPlayingProducers,
    hasNowPlayingProducer,
    setLastVideoUrl,
    setLastResourceloadUrl,
  };
});
