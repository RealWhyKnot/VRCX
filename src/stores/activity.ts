import { defineStore } from "pinia";
import { ref } from "vue";

import { database } from "../services/database";
import type { ActivityDailyTotal } from "../types/activity.ts";
import { runActivityWorkerTask } from "../workers/activity-worker-runner.ts";

import {
  parsePersistedActivityView,
  parsePersistedOverlapView,
  requireActivityViewBody,
  requireDailySummary,
  requireOverlapViewBody,
} from "./activity-guards.ts";
import { pickActivityNormalizeConfig, pickOverlapNormalizeConfig } from "./activity-normalize.ts";
import { ensureSnapshot, expandRange, fullRefresh } from "./activity-refresh.ts";
import { deferWrite, hydrateSnapshot, isUserInFlight, overlapExcludeKey, pairCursor, snapshotMap, toWorkerExcludeHours } from "./activity-snapshot.ts";
import type {
  ActivityCache,
  ActivityLoadOptions,
  ActivityOverlapOptions,
  ActivityOverlapViewRequest,
  ActivityResponse,
  ActivitySnapshot,
  ActivityViewRequest,
  ActivityViewSummary,
  CachedActivityView,
  CachedOverlapView,
  OverlapViewSummary,
  TopWorldsOptions,
  TopWorldsRequest,
  UserActivityState,
} from "./activity-types.ts";

const FULL_CACHE_BATCH_DAYS = 30;
const FULL_CACHE_MAX_DAYS = 3650;

function waitForIdle() {
  return new Promise<void>((resolve) => {
    const finish = () => {
      resolve();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(finish);
      return;
    }
    setTimeout(finish, 0);
  });
}

function buildActivityResponse(snapshot: ActivitySnapshot, view: CachedActivityView): ActivityResponse {
  return {
    userId: snapshot.userId,
    isSelf: snapshot.isSelf,
    cachedRangeDays: snapshot.sync.cachedRangeDays,
    sessions: snapshot.sessions,
    view,
  };
}

export const useActivityStore = defineStore("Activity", () => {
  const fullCacheReady = ref(false);
  let isFullCacheBuildRunning = false;
  let isFullCacheBuildAborted = false;

  function markFullCacheBuildStarted() {
    isFullCacheBuildRunning = true;
    isFullCacheBuildAborted = false;
    fullCacheReady.value = false;
  }

  const userActivity = ref<UserActivityState>({
    lastLoadedUserId: "",
    activeRequestId: 0,
    activeOverlapRequestId: 0,
    activeTopWorldsRequestId: 0,
  });

  async function getCache(userId: string, isSelf = false): Promise<ActivityCache> {
    const snapshot = await hydrateSnapshot(userId, isSelf);
    return {
      userId: snapshot.userId,
      isSelf: snapshot.isSelf,
      updatedAt: snapshot.sync.updatedAt,
      sourceLastCreatedAt: snapshot.sync.sourceLastCreatedAt,
      pendingSessionStartAt: snapshot.sync.pendingSessionStartAt,
      cachedRangeDays: snapshot.sync.cachedRangeDays,
      sessions: snapshot.sessions,
    };
  }

  function getCachedDays(userId: string): number {
    return snapshotMap.get(userId)?.sync.cachedRangeDays ?? 0;
  }

  function isRefreshing(userId: string): boolean {
    return isUserInFlight(userId);
  }

  async function loadActivity(userId: string, { isSelf = false, rangeDays = 30, normalizeConfig, dayLabels, forceRefresh = false }: ActivityLoadOptions) {
    const snapshot = await ensureSnapshot(userId, {
      isSelf,
      rangeDays,
      forceRefresh,
    });
    const cacheKey = String(rangeDays);
    const currentCursor = snapshot.sync.sourceLastCreatedAt;

    const cachedView = snapshot.activityViews.get(cacheKey);
    if (!forceRefresh && cachedView?.builtFromCursor === currentCursor) {
      return buildActivityResponse(snapshot, cachedView);
    }

    if (!forceRefresh) {
      const persisted = await database.getActivityBucketCacheV2({
        ownerUserId: userId,
        rangeDays,
        viewKind: database.ACTIVITY_VIEW_KIND.ACTIVITY,
      });
      const persistedView = parsePersistedActivityView(persisted);
      if (persistedView !== null && persistedView.builtFromCursor === currentCursor) {
        snapshot.activityViews.set(cacheKey, persistedView);
        return buildActivityResponse(snapshot, persistedView);
      }
    }

    const computed = requireActivityViewBody(
      await runActivityWorkerTask("computeActivityView", {
        sessions: snapshot.sessions,
        dayLabels,
        rangeDays,
        normalizeConfig,
      })
    );
    const view: CachedActivityView = {
      ...computed,
      builtFromCursor: currentCursor,
      builtAt: new Date().toISOString(),
    };
    snapshot.activityViews.set(cacheKey, view);
    deferWrite(() =>
      database.upsertActivityBucketCacheV2({
        ownerUserId: userId,
        rangeDays,
        viewKind: database.ACTIVITY_VIEW_KIND.ACTIVITY,
        builtFromCursor: currentCursor,
        rawBuckets: view.rawBuckets,
        normalizedBuckets: view.normalizedBuckets,
        summary: {
          peakDay: view.peakDay,
          peakTime: view.peakTime,
          filteredEventCount: view.filteredEventCount,
        },
        builtAt: view.builtAt,
      })
    );
    return buildActivityResponse(snapshot, view);
  }

  async function loadOverlap(
    currentUserId: string,
    targetUserId: string,
    { rangeDays = 30, dayLabels, normalizeConfig, excludeHours, forceRefresh = false }: ActivityOverlapOptions
  ): Promise<CachedOverlapView> {
    const [selfSnapshot, targetSnapshot] = await Promise.all([
      ensureSnapshot(currentUserId, {
        isSelf: true,
        rangeDays,
        forceRefresh,
      }),
      ensureSnapshot(targetUserId, {
        isSelf: false,
        rangeDays,
        forceRefresh,
      }),
    ]);

    const excludeKey = overlapExcludeKey(excludeHours);
    const cacheKey = `${targetUserId}:${rangeDays}:${excludeKey}`;
    const cursor = pairCursor(selfSnapshot.sync.sourceLastCreatedAt, targetSnapshot.sync.sourceLastCreatedAt);

    const cachedView = targetSnapshot.overlapViews.get(cacheKey);
    if (!forceRefresh && cachedView?.builtFromCursor === cursor) {
      return cachedView;
    }

    if (!forceRefresh) {
      const persisted = await database.getActivityBucketCacheV2({
        ownerUserId: currentUserId,
        targetUserId,
        rangeDays,
        viewKind: database.ACTIVITY_VIEW_KIND.OVERLAP,
        excludeKey,
      });
      const persistedView = parsePersistedOverlapView(persisted);
      if (persistedView !== null && persistedView.builtFromCursor === cursor) {
        targetSnapshot.overlapViews.set(cacheKey, persistedView);
        return persistedView;
      }
    }

    const computed = requireOverlapViewBody(
      await runActivityWorkerTask("computeOverlapView", {
        selfSessions: selfSnapshot.sessions,
        targetSessions: targetSnapshot.sessions,
        dayLabels,
        rangeDays,
        excludeHours: toWorkerExcludeHours(excludeHours),
        normalizeConfig,
      })
    );
    const view: CachedOverlapView = {
      ...computed,
      builtFromCursor: cursor,
      builtAt: new Date().toISOString(),
    };
    targetSnapshot.overlapViews.set(cacheKey, view);
    deferWrite(() =>
      database.upsertActivityBucketCacheV2({
        ownerUserId: currentUserId,
        targetUserId,
        rangeDays,
        viewKind: database.ACTIVITY_VIEW_KIND.OVERLAP,
        excludeKey,
        builtFromCursor: cursor,
        rawBuckets: view.rawBuckets,
        normalizedBuckets: view.normalizedBuckets,
        summary: {
          overlapPercent: view.overlapPercent,
          bestOverlapTime: view.bestOverlapTime,
        },
        builtAt: view.builtAt,
      })
    );
    return view;
  }

  async function loadTopWorlds(_userId: string, { rangeDays = 30, limit = 5, sortBy = "time", excludeWorldId = "" }: TopWorldsOptions) {
    return database.getMyTopWorlds(rangeDays, limit, sortBy, excludeWorldId);
  }

  async function refreshActivity(userId: string, options: ActivityLoadOptions) {
    return loadActivity(userId, { ...options, forceRefresh: true });
  }

  async function loadActivityView({
    userId,
    isSelf = false,
    rangeDays = 30,
    dayLabels,
    forceRefresh = false,
  }: ActivityViewRequest): Promise<ActivityViewSummary> {
    const response = await loadActivity(userId, {
      isSelf,
      rangeDays,
      dayLabels,
      forceRefresh,
      normalizeConfig: pickActivityNormalizeConfig(rangeDays),
    });
    return {
      hasAnyData: response.sessions.length > 0,
      filteredEventCount: response.view.filteredEventCount,
      peakDay: response.view.peakDay,
      peakTime: response.view.peakTime,
      rawBuckets: response.view.rawBuckets,
      normalizedBuckets: response.view.normalizedBuckets,
    };
  }

  async function loadOverlapView({
    currentUserId,
    targetUserId,
    rangeDays = 30,
    dayLabels,
    excludeHours,
    forceRefresh = false,
  }: ActivityOverlapViewRequest): Promise<OverlapViewSummary> {
    const response = await loadOverlap(currentUserId, targetUserId, {
      rangeDays,
      dayLabels,
      excludeHours,
      forceRefresh,
      normalizeConfig: pickOverlapNormalizeConfig(rangeDays),
    });
    return {
      hasOverlapData: response.rawBuckets.some((value) => value > 0),
      overlapPercent: response.overlapPercent,
      bestOverlapTime: response.bestOverlapTime,
      rawBuckets: response.rawBuckets,
      normalizedBuckets: response.normalizedBuckets,
    };
  }

  async function loadTopWorldsView({ userId, rangeDays = 30, limit = 5, sortBy = "time", excludeWorldId = "" }: TopWorldsRequest) {
    return loadTopWorlds(userId, {
      rangeDays,
      limit,
      sortBy,
      excludeWorldId,
    });
  }

  function invalidateUser(userId: string) {
    if (!userId) {
      return;
    }
    snapshotMap.delete(userId);
  }

  async function startFullCacheBuild(userId: string) {
    if (isFullCacheBuildRunning) {
      return;
    }
    markFullCacheBuildStarted();

    try {
      const snapshot = await hydrateSnapshot(userId, true);

      if (!snapshot.sync.updatedAt) {
        await fullRefresh(snapshot, 90);
      }

      const currentDays = snapshot.sync.cachedRangeDays || 90;

      const probeItems = await database.getActivitySourceSliceV2({
        userId,
        isSelf: true,
        fromDays: FULL_CACHE_MAX_DAYS,
        toDays: currentDays,
      });

      const earliestItem = probeItems.at(0);
      if (earliestItem === undefined) {
        fullCacheReady.value = true;
        isFullCacheBuildRunning = false;
        return;
      }

      const earliestDate = new Date(earliestItem.created_at);
      const totalDays = Math.ceil((Date.now() - earliestDate.getTime()) / 86400000);

      let targetDays = currentDays;
      while (targetDays < totalDays && !isFullCacheBuildAborted) {
        targetDays = Math.min(targetDays + FULL_CACHE_BATCH_DAYS, totalDays);
        const nextTarget = targetDays;

        await waitForIdle();
        try {
          await expandRange(snapshot, nextTarget);
        } catch (error) {
          console.error("[Activity] full cache batch failed:", error);
        }
      }

      if (!isFullCacheBuildAborted) {
        fullCacheReady.value = true;
      }
    } catch (error) {
      console.error("[Activity] full cache build error:", error);
    } finally {
      isFullCacheBuildRunning = false;
    }
  }

  function stopFullCacheBuild() {
    isFullCacheBuildAborted = true;
  }

  async function getDailySummary(userId: string): Promise<ActivityDailyTotal[]> {
    const snapshot = await hydrateSnapshot(userId, true);
    const firstSession = snapshot.sessions.at(0);
    if (firstSession === undefined) {
      return [];
    }

    const rangeStartMs = firstSession.start;
    const rangeEndMs = Date.now();

    return requireDailySummary(
      await runActivityWorkerTask("computeDailySummary", {
        sessions: snapshot.sessions,
        rangeStartMs,
        rangeEndMs,
      })
    );
  }

  return {
    fullCacheReady,
    getCache,
    getCachedDays,
    isRefreshing,
    userActivity,
    loadActivity,
    loadActivityView,
    loadOverlap,
    loadOverlapView,
    loadTopWorlds,
    loadTopWorldsView,
    refreshActivity,
    invalidateUser,
    startFullCacheBuild,
    stopFullCacheBuild,
    getDailySummary,
    workerCall: runActivityWorkerTask,
  };
});
