import { computed, ref, shallowRef } from "vue";

import { buildGameLogSessions } from "../../views/GameLog/sessions/build-game-log-sessions";
import { gameLogDatabase } from "./game-log-database";
import {
  SESSIONS_EVENT_FILTER_ALL,
  SESSIONS_EVENT_FILTER_TYPES,
  applySessionsSearchFilter,
  clampSessionsDateRange,
  filterSessionsEventsByFilters,
  filterSessionsSegmentsByDateRange,
  firstItem,
  isSessionsCreatedAtInRange,
  lastItem,
  normalizeSessionsSearch,
  toSessionFilterList,
  toSessionsEpoch,
} from "./session-query";
import type { GameLogEntry, SessionLocation, SessionSegment, SessionsViewMode } from "./types";

type BuildGameLogSessions = (locations: SessionLocation[], events: GameLogEntry[]) => { segments: SessionSegment[] };

type SessionsSearchBatch = {
  beforeId: number | null;
  hasMore: boolean;
};

type SessionsDependencies = {
  vrcxStore: { maxTableSize: number; searchLimit: number };
  gameLogIsFriend: (row: GameLogEntry) => boolean;
  gameLogIsFavorite: (row: GameLogEntry) => boolean;
};

const buildSessions: BuildGameLogSessions = buildGameLogSessions;

const SESSIONS_GLOBAL_SEARCH_INITIAL_LOCATIONS = 50;
const SESSIONS_SEARCH_BATCH_ATTEMPTS = 3;

function logSessionsError(error: unknown) {
  console.error("Game log sessions update failed:", error);
}

export function createSessionsState({ vrcxStore, gameLogIsFriend, gameLogIsFavorite }: SessionsDependencies) {
  const sessionsViewMode = ref<SessionsViewMode>("sessions");
  const sessionsSegments = shallowRef<SessionSegment[]>([]);
  const sessionsCursor = ref<number | null>(null);
  const sessionsLoading = ref(false);
  const sessionsHasMore = ref(true);
  const sessionsVipFilter = ref(false);
  const sessionsEventFilters = ref<string[]>([]);
  const sessionsSearch = ref("");
  const sessionsDateFrom = ref("");
  const sessionsDateTo = ref("");
  const sessionsRawLocations = shallowRef<SessionLocation[]>([]);
  const sessionsRawEvents = shallowRef<GameLogEntry[]>([]);
  let isSessionsReloadPending = false;

  const sessionsDateRangeActive = computed(() => !!sessionsDateFrom.value || !!sessionsDateTo.value);

  const sessionsEventFilterSelection = computed({
    get() {
      return sessionsEventFilters.value.length === 0 ? [SESSIONS_EVENT_FILTER_ALL] : sessionsEventFilters.value;
    },
    set(value) {
      handleSessionsEventFilterChange(value).catch(logSessionsError);
    },
  });

  let rebuildSessionsTimer: ReturnType<typeof setTimeout> | null = null;

  function isGlobalSearchMode() {
    return !sessionsDateRangeActive.value && normalizeSessionsSearch(sessionsSearch.value).length > 0;
  }

  function rebuildSessions() {
    if (isSessionsReloadPending) {
      return;
    }
    const events = filterSessionsEventsByFilters(sessionsRawEvents.value, sessionsVipFilter.value, sessionsEventFilters.value);
    const result = buildSessions(sessionsRawLocations.value, events);
    sessionsSegments.value = applySessionsSearchFilter(
      filterSessionsSegmentsByDateRange(result.segments, sessionsDateFrom.value, sessionsDateTo.value),
      sessionsSearch.value,
      vrcxStore.searchLimit
    );
  }

  function rebuildSessionsDebounced() {
    if (rebuildSessionsTimer) {
      clearTimeout(rebuildSessionsTimer);
    }
    rebuildSessionsTimer = setTimeout(() => {
      rebuildSessionsTimer = null;
      rebuildSessions();
    }, 500);
  }

  async function handleSessionsEventFilterChange(value: unknown) {
    const selected = toSessionFilterList(value);
    const wasAll = sessionsEventFilters.value.length === 0;
    const hasAll = selected.includes(SESSIONS_EVENT_FILTER_ALL);
    const types = selected.filter((item) => item !== SESSIONS_EVENT_FILTER_ALL && SESSIONS_EVENT_FILTER_TYPES.includes(item));

    if (hasAll && !wasAll) {
      sessionsEventFilters.value = [];
    } else if (wasAll && types.length > 0) {
      sessionsEventFilters.value = types;
    } else {
      sessionsEventFilters.value = types.length === SESSIONS_EVENT_FILTER_TYPES.length ? [] : types;
    }
    if (isGlobalSearchMode()) {
      await loadSessionsSegments();
      return;
    }
    rebuildSessions();
  }

  async function setSessionsSearch(value: string | null | undefined) {
    sessionsSearch.value = value ?? "";
    await loadSessionsSegments();
  }

  async function setSessionsDateRange(from: string | null | undefined, to: string | null | undefined) {
    const [normalizedFrom, normalizedTo] = clampSessionsDateRange(from, to);
    sessionsDateFrom.value = normalizedFrom;
    sessionsDateTo.value = normalizedTo;
    await loadSessionsSegments();
  }

  async function clearSessionsDateRange() {
    sessionsDateFrom.value = "";
    sessionsDateTo.value = "";
    await loadSessionsSegments();
  }

  async function fetchEventsForLocations(locations: SessionLocation[]) {
    const locationTags = [...new Set(locations.map((location) => location.location))].filter((tag): tag is string => typeof tag === "string");
    const dates = locations.map((location) => new Date(location.created_at).getTime());
    const minDate = new Date(Math.min(...dates) - 86400000).toISOString();
    const maxDate = new Date(Math.max(...dates) + 86400000).toISOString();
    const events = await gameLogDatabase.getSessionsEventsForSegments(locationTags, minDate, maxDate);
    for (const event of events) {
      event.isFriend = gameLogIsFriend(event);
      event.isFavorite = gameLogIsFavorite(event);
    }
    return events;
  }

  async function loadSessionsSearchBatch(beforeId: number | null, fetchCount: number): Promise<SessionsSearchBatch> {
    const locations = await gameLogDatabase.getSessionsLocationSegments(beforeId, fetchCount);
    if (locations.length === 0) {
      return { beforeId, hasMore: false };
    }

    const hasExtraTail = locations.length >= fetchCount;
    if (hasExtraTail) {
      locations.pop();
    }
    if (locations.length === 0) {
      return { beforeId, hasMore: false };
    }

    const events = await fetchEventsForLocations(locations);
    sessionsRawLocations.value = [...sessionsRawLocations.value, ...locations];
    sessionsRawEvents.value = [...sessionsRawEvents.value, ...events];
    rebuildSessions();

    return {
      beforeId: lastItem(locations).id,
      hasMore: hasExtraTail && sessionsSegments.value.length < vrcxStore.searchLimit,
    };
  }

  async function finishSessionsLoad() {
    sessionsLoading.value = false;
    if (isSessionsReloadPending) {
      isSessionsReloadPending = false;
      await loadSessionsSegments();
    }
  }

  async function loadSessionsSegments() {
    if (sessionsLoading.value) {
      isSessionsReloadPending = true;
      return;
    }
    sessionsLoading.value = true;
    try {
      sessionsCursor.value = null;
      sessionsHasMore.value = true;

      const locationBudget = Math.max(5, Math.ceil(vrcxStore.maxTableSize / 50));
      let fetchCount = locationBudget + 1;

      if (isGlobalSearchMode()) {
        fetchCount = SESSIONS_GLOBAL_SEARCH_INITIAL_LOCATIONS + 1;
        let beforeId: number | null = null;
        let hasMore = true;
        let attempts = 0;
        sessionsRawLocations.value = [];
        sessionsRawEvents.value = [];
        sessionsSegments.value = [];

        while (hasMore && sessionsSegments.value.length === 0 && attempts < SESSIONS_SEARCH_BATCH_ATTEMPTS) {
          const nextBatch = await loadSessionsSearchBatch(beforeId, fetchCount);
          beforeId = nextBatch.beforeId;
          hasMore = nextBatch.hasMore;
          attempts += 1;
        }

        sessionsCursor.value = beforeId;
        sessionsHasMore.value = hasMore;
        return;
      }

      if (sessionsDateRangeActive.value) {
        let beforeId: number | null = null;
        let hasMore = true;
        sessionsRawLocations.value = [];
        sessionsRawEvents.value = [];
        sessionsSegments.value = [];
        while (hasMore && sessionsSegments.value.length === 0) {
          const locations: SessionLocation[] =
            beforeId === null
              ? await gameLogDatabase.getSessionsLocationSegmentsByAnchor(sessionsDateFrom.value || sessionsDateTo.value, fetchCount)
              : await gameLogDatabase.getSessionsLocationSegments(beforeId, fetchCount);
          if (locations.length === 0) {
            hasMore = false;
            break;
          }

          const hasExtraTail = locations.length >= fetchCount;
          if (hasExtraTail) {
            locations.pop();
          }
          if (locations.length === 0) {
            hasMore = false;
            break;
          }

          const inRangeLocations = locations.filter((location) =>
            isSessionsCreatedAtInRange(location.created_at, sessionsDateFrom.value, sessionsDateTo.value)
          );
          const newestLocationEpoch = toSessionsEpoch(firstItem(locations).created_at);
          const hasReachedRangeStart = Boolean(sessionsDateFrom.value) && newestLocationEpoch < toSessionsEpoch(sessionsDateFrom.value);

          if (inRangeLocations.length === 0) {
            if (hasReachedRangeStart || !hasExtraTail) {
              hasMore = false;
              break;
            }
            beforeId = lastItem(locations).id;
            hasMore = true;
            continue;
          }

          const events = await fetchEventsForLocations(inRangeLocations);
          sessionsRawLocations.value = [...sessionsRawLocations.value, ...inRangeLocations];
          sessionsRawEvents.value = [...sessionsRawEvents.value, ...events];
          beforeId = lastItem(locations).id;
          rebuildSessions();
          hasMore = hasExtraTail && !hasReachedRangeStart;
        }
        sessionsCursor.value = beforeId;
        sessionsHasMore.value = hasMore;
        return;
      }

      const locations = await gameLogDatabase.getSessionsLocationSegments(null, fetchCount);
      if (locations.length === 0) {
        sessionsRawLocations.value = [];
        sessionsRawEvents.value = [];
        sessionsSegments.value = [];
        sessionsHasMore.value = false;
        return;
      }

      const hasExtraTail = locations.length >= fetchCount;
      if (hasExtraTail) {
        locations.pop();
      }

      const events = await fetchEventsForLocations(locations);
      sessionsRawLocations.value = locations;
      sessionsRawEvents.value = events;
      rebuildSessions();

      sessionsCursor.value = lastItem(locations).id;
      sessionsHasMore.value = hasExtraTail;
    } finally {
      await finishSessionsLoad();
    }
  }

  async function loadMoreSessionsSegments() {
    if (sessionsLoading.value || !sessionsHasMore.value) return;
    sessionsLoading.value = true;
    try {
      const batchBudget = Math.max(3, Math.ceil(vrcxStore.maxTableSize / 100));
      const fetchCount = batchBudget + 1;

      if (isGlobalSearchMode()) {
        let beforeId = sessionsCursor.value;

        let hasMore = true;
        const previousCount = sessionsSegments.value.length;
        let attempts = 0;

        while (
          hasMore &&
          beforeId != null &&
          sessionsSegments.value.length < vrcxStore.searchLimit &&
          sessionsSegments.value.length === previousCount &&
          attempts < SESSIONS_SEARCH_BATCH_ATTEMPTS
        ) {
          const nextBatch = await loadSessionsSearchBatch(beforeId, fetchCount);
          beforeId = nextBatch.beforeId;
          hasMore = nextBatch.hasMore;
          attempts += 1;
        }

        sessionsCursor.value = beforeId;
        sessionsHasMore.value = hasMore;
        return;
      }

      const moreLocations = await gameLogDatabase.getSessionsLocationSegments(sessionsCursor.value, fetchCount);
      if (moreLocations.length === 0) {
        sessionsHasMore.value = false;
        return;
      }

      const hasExtraTail = moreLocations.length >= fetchCount;
      if (hasExtraTail) {
        moreLocations.pop();
      }

      const moreEvents = await fetchEventsForLocations(moreLocations);

      sessionsRawLocations.value = [...sessionsRawLocations.value, ...moreLocations];
      sessionsRawEvents.value = [...sessionsRawEvents.value, ...moreEvents];
      rebuildSessions();

      const lastLocation = lastItem(moreLocations);
      sessionsCursor.value = lastLocation.id;
      sessionsHasMore.value =
        hasExtraTail && (!sessionsDateRangeActive.value || toSessionsEpoch(lastLocation.created_at) >= toSessionsEpoch(sessionsDateFrom.value));
    } finally {
      await finishSessionsLoad();
    }
  }

  async function jumpToSessionsAnchor(hours: number) {
    if (sessionsLoading.value) return;
    sessionsLoading.value = true;
    try {
      const sinceDate = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const maxSegments = Math.max(10, Math.ceil(vrcxStore.maxTableSize / 25));

      const locations = await gameLogDatabase.getSessionsLocationSegmentsByAnchor(sinceDate, maxSegments + 1);
      if (locations.length === 0) {
        sessionsRawLocations.value = [];
        sessionsRawEvents.value = [];
        sessionsSegments.value = [];
        sessionsHasMore.value = false;
        sessionsCursor.value = null;
        return;
      }

      const hasExtraTail = locations.length > maxSegments;
      if (hasExtraTail) {
        locations.pop();
      }

      const events = await fetchEventsForLocations(locations);
      sessionsRawLocations.value = locations;
      sessionsRawEvents.value = events;
      rebuildSessions();

      sessionsCursor.value = lastItem(locations).id;
      sessionsHasMore.value = true;
    } finally {
      await finishSessionsLoad();
    }
  }

  async function toggleSessionsVipFilter() {
    sessionsVipFilter.value = !sessionsVipFilter.value;
    if (isGlobalSearchMode()) {
      await loadSessionsSegments();
      return;
    }
    rebuildSessions();
  }

  function appendSessionsEntry(entry: GameLogEntry) {
    const type = entry.type;
    if (type !== "OnPlayerJoined" && type !== "OnPlayerLeft" && type !== "VideoPlay" && type !== "Location") {
      return;
    }

    if (type === "Location") {
      sessionsRawLocations.value = [
        {
          id: entry.rowId ?? Date.now(),
          created_at: entry.created_at,
          location: entry.location,
          worldId: entry.worldId,
          worldName: entry.worldName,
          time: entry.time,
          groupName: entry.groupName ?? "",
        },
        ...sessionsRawLocations.value,
      ];
    } else {
      sessionsRawEvents.value = [
        ...sessionsRawEvents.value,
        {
          type,
          created_at: entry.created_at,
          displayName: entry.displayName,
          userId: entry.userId,
          location: entry.location,
          videoUrl: entry.videoUrl,
          videoName: entry.videoName,
          videoId: entry.videoId,
          isFriend: entry.isFriend,
          isFavorite: entry.isFavorite,
        },
      ];
    }
    rebuildSessionsDebounced();
  }

  function resetSessionsData() {
    sessionsSegments.value = [];
    sessionsRawLocations.value = [];
    sessionsRawEvents.value = [];
    sessionsCursor.value = null;
    sessionsHasMore.value = true;
  }

  return {
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
  };
}
