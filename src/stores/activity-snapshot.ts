import { database } from "../services/database";
import type { ActivityExcludeHours } from "../types/activity.ts";

import type { ActivityExcludeHoursOption, ActivitySnapshot } from "./activity-types.ts";

const MAX_SNAPSHOT_ENTRIES = 12;

export const snapshotMap = new Map<string, ActivitySnapshot>();
export const inFlightJobs = new Map<string, Promise<ActivitySnapshot>>();

let deferredWriteQueue: Promise<unknown> = Promise.resolve();

export function deferWrite(task: () => Promise<unknown>) {
  const run = () => {
    deferredWriteQueue = deferredWriteQueue.then(task).catch((error: unknown) => {
      console.error("[Activity] deferred write failed:", error);
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run);
    return;
  }
  setTimeout(run, 0);
}

export function isUserInFlight(userId: string) {
  for (const key of inFlightJobs.keys()) {
    if (key.startsWith(`${userId}:`)) {
      return true;
    }
  }
  return false;
}

function createSnapshot(userId: string, isSelf: boolean): ActivitySnapshot {
  return {
    userId,
    isSelf,
    sync: {
      userId,
      updatedAt: "",
      isSelf,
      sourceLastCreatedAt: "",
      pendingSessionStartAt: null,
      cachedRangeDays: 0,
    },
    sessions: [],
    activityViews: new Map(),
    overlapViews: new Map(),
  };
}

function touchSnapshot(userId: string, snapshot: ActivitySnapshot) {
  snapshotMap.delete(userId);
  snapshotMap.set(userId, snapshot);
}

function pruneSnapshots() {
  if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
    return;
  }

  for (const [userId] of snapshotMap) {
    if (isUserInFlight(userId)) {
      continue;
    }
    snapshotMap.delete(userId);
    if (snapshotMap.size <= MAX_SNAPSHOT_ENTRIES) {
      break;
    }
  }
}

export function getSnapshot(userId: string, isSelf: boolean): ActivitySnapshot {
  const existing = snapshotMap.get(userId);
  const snapshot = existing ?? createSnapshot(userId, isSelf);
  if (existing !== undefined) {
    snapshot.isSelf = isSelf;
    snapshot.sync.isSelf = isSelf;
  }
  touchSnapshot(userId, snapshot);
  pruneSnapshots();
  return snapshot;
}

export function clearDerivedViews(snapshot: ActivitySnapshot) {
  snapshot.activityViews.clear();
  snapshot.overlapViews.clear();
}

export function overlapExcludeKey(excludeHours: ActivityExcludeHoursOption | null | undefined) {
  if (!excludeHours?.enabled) {
    return "";
  }
  return `${excludeHours.startHour}-${excludeHours.endHour}`;
}

export function pairCursor(leftCursor: string, rightCursor: string) {
  return `${leftCursor}|${rightCursor}`;
}

export function toWorkerExcludeHours(excludeHours: ActivityExcludeHoursOption | null | undefined): ActivityExcludeHours | null {
  return excludeHours?.enabled ? excludeHours : null;
}

export async function hydrateSnapshot(userId: string, isSelf: boolean): Promise<ActivitySnapshot> {
  const snapshot = getSnapshot(userId, isSelf);
  if (snapshot.sync.updatedAt || snapshot.sessions.length > 0) {
    return snapshot;
  }

  const [syncState, sessions] = await Promise.all([database.getActivitySyncStateV2(userId), database.getActivitySessionsV2(userId)]);

  if (syncState) {
    snapshot.sync = {
      ...snapshot.sync,
      ...syncState,
    };
  }
  if (sessions.length > 0) {
    snapshot.sessions = sessions;
  }
  return snapshot;
}
