import { database } from "../services/database";
import { mergeSessions } from "../shared/utils/activity-engine.ts";
import { runActivityWorkerTask } from "../workers/activity-worker-runner.ts";

import { requireSessionsSnapshot } from "./activity-guards.ts";
import { clearDerivedViews, deferWrite, hydrateSnapshot, inFlightJobs } from "./activity-snapshot.ts";
import type { ActivitySnapshot } from "./activity-types.ts";

export async function ensureSnapshot(
  userId: string,
  { isSelf, rangeDays, forceRefresh = false }: { isSelf: boolean; rangeDays: number; forceRefresh?: boolean }
): Promise<ActivitySnapshot> {
  const jobKey = `${userId}:${isSelf}:${rangeDays}:${forceRefresh ? "force" : "normal"}`;
  const existingJob = inFlightJobs.get(jobKey);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    const snapshot = await hydrateSnapshot(userId, isSelf);
    if (forceRefresh || !snapshot.sync.updatedAt) {
      await fullRefresh(snapshot, rangeDays);
    } else {
      await incrementalRefresh(snapshot);
      if (rangeDays > snapshot.sync.cachedRangeDays) {
        await expandRange(snapshot, rangeDays);
      }
    }
    return snapshot;
  })().finally(() => {
    inFlightJobs.delete(jobKey);
  });

  inFlightJobs.set(jobKey, job);
  return job;
}

export async function fullRefresh(snapshot: ActivitySnapshot, rangeDays: number) {
  const sourceItems = await database.getActivitySourceSliceV2({
    userId: snapshot.userId,
    isSelf: snapshot.isSelf,
    fromDays: rangeDays,
  });
  const sourceLastCreatedAt = sourceItems.at(-1)?.created_at ?? "";
  const result = requireSessionsSnapshot(
    await runActivityWorkerTask("computeSessionsSnapshot", {
      sourceType: snapshot.isSelf ? "self_gamelog" : "friend_presence",
      rows: snapshot.isSelf ? sourceItems : undefined,
      events: snapshot.isSelf ? undefined : sourceItems,
      initialStart: null,
      nowMs: Date.now(),
      mayHaveOpenTail: snapshot.isSelf,
      sourceRevision: sourceLastCreatedAt,
    })
  );

  snapshot.sessions = result.sessions;
  snapshot.sync = {
    ...snapshot.sync,
    updatedAt: new Date().toISOString(),
    isSelf: snapshot.isSelf,
    sourceLastCreatedAt,
    pendingSessionStartAt: result.pendingSessionStartAt,
    cachedRangeDays: rangeDays,
  };
  clearDerivedViews(snapshot);

  deferWrite(() => database.replaceActivitySessionsV2(snapshot.userId, snapshot.sessions));
  deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}

async function incrementalRefresh(snapshot: ActivitySnapshot) {
  if (!snapshot.sync.sourceLastCreatedAt) {
    return;
  }

  const sourceItems = await database.getActivitySourceAfterV2({
    userId: snapshot.userId,
    isSelf: snapshot.isSelf,
    afterCreatedAt: snapshot.sync.sourceLastCreatedAt,
  });
  if (sourceItems.length === 0) {
    snapshot.sync.updatedAt = new Date().toISOString();
    deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
    return;
  }

  const sourceLastCreatedAt = sourceItems.at(-1)?.created_at ?? "";
  const result = requireSessionsSnapshot(
    await runActivityWorkerTask("computeSessionsSnapshot", {
      sourceType: snapshot.isSelf ? "self_gamelog" : "friend_presence",
      rows: snapshot.isSelf ? sourceItems : undefined,
      events: snapshot.isSelf ? undefined : sourceItems,
      initialStart: snapshot.isSelf ? null : snapshot.sync.pendingSessionStartAt,
      nowMs: Date.now(),
      mayHaveOpenTail: snapshot.isSelf,
      sourceRevision: sourceLastCreatedAt,
    })
  );

  const replaceFromStartAt = snapshot.sessions.at(-1)?.start ?? null;
  const merged = mergeSessions(snapshot.sessions, result.sessions);
  snapshot.sessions = merged;
  snapshot.sync = {
    ...snapshot.sync,
    updatedAt: new Date().toISOString(),
    sourceLastCreatedAt,
    pendingSessionStartAt: result.pendingSessionStartAt,
  };
  clearDerivedViews(snapshot);

  const tailSessions = replaceFromStartAt === null ? merged : merged.filter((session) => session.start >= replaceFromStartAt);
  deferWrite(() =>
    database.appendActivitySessionsV2({
      userId: snapshot.userId,
      sessions: tailSessions,
      replaceFromStartAt,
    })
  );
  deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}

export async function expandRange(snapshot: ActivitySnapshot, rangeDays: number) {
  const currentDays = snapshot.sync.cachedRangeDays;
  if (rangeDays <= currentDays) {
    return;
  }

  const sourceItems = await database.getActivitySourceSliceV2({
    userId: snapshot.userId,
    isSelf: snapshot.isSelf,
    fromDays: rangeDays,
    toDays: currentDays,
  });
  const result = requireSessionsSnapshot(
    await runActivityWorkerTask("computeSessionsSnapshot", {
      sourceType: snapshot.isSelf ? "self_gamelog" : "friend_presence",
      rows: snapshot.isSelf ? sourceItems : undefined,
      events: snapshot.isSelf ? undefined : sourceItems,
      initialStart: null,
      nowMs: Date.now(),
      mayHaveOpenTail: false,
      sourceRevision: snapshot.sync.sourceLastCreatedAt,
    })
  );

  if (result.sessions.length > 0) {
    snapshot.sessions = mergeSessions(result.sessions, snapshot.sessions);
    deferWrite(() => database.replaceActivitySessionsV2(snapshot.userId, snapshot.sessions));
  }
  snapshot.sync.cachedRangeDays = rangeDays;
  snapshot.sync.updatedAt = new Date().toISOString();
  clearDerivedViews(snapshot);

  deferWrite(() => database.upsertActivitySyncStateV2(snapshot.sync));
}
