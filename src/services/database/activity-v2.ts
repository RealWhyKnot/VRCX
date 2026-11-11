import type { ActivitySession } from "../../types/activity.ts";

import { cellNumber, cellText } from "./cells.ts";
import { sqliteService } from "../sqlite.ts";
import type { DatabaseRow } from "../sqlite.ts";

const ACTIVITY_VIEW_KIND = {
  ACTIVITY: "activity",
  OVERLAP: "overlap",
};

type FriendPresenceRow = {
  created_at: string;
  type: string;
};

type CurrentUserLocationRow = {
  created_at: string;
  time: number;
};

type ActivitySourceRow = FriendPresenceRow | CurrentUserLocationRow;

type ActivitySourceSliceRequest = {
  userId: string;
  isSelf: boolean;
  fromDays: number;
  toDays?: number;
};

type ActivitySourceAfterRequest = {
  userId: string;
  isSelf: boolean;
  afterCreatedAt: string;
  isInclusive?: boolean;
};

type ActivitySyncState = {
  userId: string;
  updatedAt: string;
  isSelf: boolean;
  sourceLastCreatedAt: string;
  pendingSessionStartAt: number | null;
  cachedRangeDays: number;
};

type ActivitySyncStateEntry = {
  userId: string;
  updatedAt?: string;
  isSelf?: boolean;
  sourceLastCreatedAt?: string;
  pendingSessionStartAt?: number | null;
  cachedRangeDays?: number;
};

type ActivityBucketCache = {
  ownerUserId: string;
  targetUserId: string;
  rangeDays: number;
  viewKind: string;
  excludeKey: string;
  bucketVersion: number;
  builtFromCursor: string;
  rawBuckets: unknown;
  normalizedBuckets: unknown;
  summary: unknown;
  builtAt: string;
};

type ActivityBucketCacheRequest = {
  ownerUserId: string;
  targetUserId?: string;
  rangeDays: number;
  viewKind: string;
  excludeKey?: string;
};

type ActivityBucketCacheEntry = ActivityBucketCacheRequest & {
  bucketVersion?: number;
  builtFromCursor?: string;
  rawBuckets?: unknown;
  normalizedBuckets?: unknown;
  summary?: unknown;
  builtAt?: string;
};

type SessionColumns = {
  startAt: string[];
  endAt: string[];
  isOpenTail: string[];
  sourceRevision: string[];
};

function textOr(cell: unknown, fallback: string): string {
  const text = cellText(cell) ?? "";
  return text.length > 0 ? text : fallback;
}

function numberOr(cell: unknown, fallback: number): number {
  const value = cellNumber(cell);
  return value === null || value === 0 ? fallback : value;
}

function flagOf(cell: unknown): boolean {
  return numberOr(cell, 0) !== 0;
}

function parseJson(cell: unknown, fallback: unknown): unknown {
  const text = cellText(cell);
  if (!text) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fallback;
    }
    throw error;
  }
}

function mapFriendPresenceRows(rows: DatabaseRow[]): FriendPresenceRow[] {
  return rows.map((row) => ({ created_at: textOr(row[0], ""), type: textOr(row[1], "") }));
}

function mapCurrentUserLocationRows(rows: DatabaseRow[]): CurrentUserLocationRow[] {
  return rows.map((row) => ({ created_at: textOr(row[0], ""), time: numberOr(row[1], 0) }));
}

function sessionColumns(sessions: ActivitySession[]): SessionColumns {
  return {
    startAt: sessions.map((session) => String(session.start)),
    endAt: sessions.map((session) => String(session.end)),
    isOpenTail: sessions.map((session) => (session.isOpenTail ? "1" : "0")),
    sourceRevision: sessions.map((session) => session.sourceRevision ?? ""),
  };
}

const activityV2 = {
  ACTIVITY_VIEW_KIND,

  async getActivitySourceSliceV2({ userId, isSelf, fromDays, toDays = 0 }: ActivitySourceSliceRequest): Promise<ActivitySourceRow[]> {
    const fromDateIso = new Date(Date.now() - fromDays * 86400000).toISOString();
    const toDateIso = toDays > 0 ? new Date(Date.now() - toDays * 86400000).toISOString() : "";
    return isSelf ? this.getCurrentUserLocationSliceV2(fromDateIso, toDateIso) : this.getFriendPresenceSliceV2(userId, fromDateIso, toDateIso);
  },

  async getActivitySourceAfterV2({ userId, isSelf, afterCreatedAt, isInclusive = false }: ActivitySourceAfterRequest): Promise<ActivitySourceRow[]> {
    return isSelf ? this.getCurrentUserLocationAfterV2(afterCreatedAt, isInclusive) : this.getFriendPresenceAfterV2(userId, afterCreatedAt);
  },

  async getFriendPresenceSliceV2(userId: string, fromDateIso: string, toDateIso = ""): Promise<FriendPresenceRow[]> {
    const rows = mapFriendPresenceRows(await sqliteService.rows(DatabaseApi.GetFriendPresenceSliceWindow(userId, fromDateIso, toDateIso)));
    if (toDateIso) {
      rows.push(...mapFriendPresenceRows(await sqliteService.rows(DatabaseApi.GetFriendPresenceSliceEnd(userId, toDateIso))));
    }
    return rows.sort((left, right) => left.created_at.localeCompare(right.created_at));
  },

  async getFriendPresenceAfterV2(userId: string, afterCreatedAt: string): Promise<FriendPresenceRow[]> {
    return mapFriendPresenceRows(await sqliteService.rows(DatabaseApi.GetFriendPresenceAfter(userId, afterCreatedAt)));
  },

  async getCurrentUserLocationSliceV2(fromDateIso: string, toDateIso = ""): Promise<CurrentUserLocationRow[]> {
    return mapCurrentUserLocationRows(await sqliteService.rows(DatabaseApi.GetCurrentUserLocationSlice(fromDateIso, toDateIso)));
  },

  async getCurrentUserLocationAfterV2(afterCreatedAt: string, isInclusive = false): Promise<CurrentUserLocationRow[]> {
    return mapCurrentUserLocationRows(await sqliteService.rows(DatabaseApi.GetCurrentUserLocationAfter(afterCreatedAt, isInclusive)));
  },

  async getActivitySyncStateV2(userId: string): Promise<ActivitySyncState | null> {
    const row = (await sqliteService.rows(DatabaseApi.GetActivitySyncState(userId))).at(-1);
    if (!row) {
      return null;
    }
    return {
      userId: textOr(row[0], ""),
      updatedAt: textOr(row[1], ""),
      isSelf: flagOf(row[2]),
      sourceLastCreatedAt: textOr(row[3], ""),
      pendingSessionStartAt: cellNumber(row[4]),
      cachedRangeDays: numberOr(row[5], 0),
    };
  },

  async upsertActivitySyncStateV2(entry: ActivitySyncStateEntry): Promise<void> {
    await sqliteService.run(
      DatabaseApi.UpsertActivitySyncState(
        entry.userId,
        entry.updatedAt ?? "",
        entry.isSelf === true,
        entry.sourceLastCreatedAt ?? "",
        entry.pendingSessionStartAt ?? null,
        entry.cachedRangeDays ?? 0
      )
    );
  },

  async getActivitySessionsV2(userId: string): Promise<ActivitySession[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetActivitySessions(userId));
    return rows.map((row) => ({
      start: numberOr(row[0], 0),
      end: numberOr(row[1], 0),
      isOpenTail: flagOf(row[2]),
      sourceRevision: textOr(row[3], ""),
    }));
  },

  async replaceActivitySessionsV2(userId: string, sessions: ActivitySession[] = []): Promise<void> {
    const columns = sessionColumns(sessions);
    await sqliteService.run(DatabaseApi.ReplaceActivitySessions(userId, columns.startAt, columns.endAt, columns.isOpenTail, columns.sourceRevision));
  },

  async appendActivitySessionsV2({
    userId,
    sessions = [],
    replaceFromStartAt = null,
  }: {
    userId: string;
    sessions?: ActivitySession[];
    replaceFromStartAt?: number | null;
  }): Promise<void> {
    const columns = sessionColumns(sessions);
    if (replaceFromStartAt !== null) {
      await sqliteService.run(
        DatabaseApi.AppendActivitySessionsFrom(userId, replaceFromStartAt, columns.startAt, columns.endAt, columns.isOpenTail, columns.sourceRevision)
      );
      return;
    }
    await sqliteService.run(DatabaseApi.AppendActivitySessions(userId, columns.startAt, columns.endAt, columns.isOpenTail, columns.sourceRevision));
  },

  async getActivityBucketCacheV2({
    ownerUserId,
    targetUserId = "",
    rangeDays,
    viewKind,
    excludeKey = "",
  }: ActivityBucketCacheRequest): Promise<ActivityBucketCache | null> {
    const row = (await sqliteService.rows(DatabaseApi.GetActivityBucketCache(ownerUserId, targetUserId, rangeDays, viewKind, excludeKey))).at(-1);
    if (!row) {
      return null;
    }
    return {
      ownerUserId: textOr(row[0], ""),
      targetUserId: textOr(row[1], ""),
      rangeDays: numberOr(row[2], 0),
      viewKind: textOr(row[3], ""),
      excludeKey: textOr(row[4], ""),
      bucketVersion: numberOr(row[5], 1),
      builtFromCursor: textOr(row[6], ""),
      rawBuckets: parseJson(row[7], []),
      normalizedBuckets: parseJson(row[8], []),
      summary: parseJson(row[9], {}),
      builtAt: textOr(row[10], ""),
    };
  },

  async upsertActivityBucketCacheV2(entry: ActivityBucketCacheEntry): Promise<void> {
    await sqliteService.run(
      DatabaseApi.UpsertActivityBucketCache(
        entry.ownerUserId,
        entry.targetUserId ?? "",
        entry.rangeDays,
        entry.viewKind,
        entry.excludeKey ?? "",
        entry.bucketVersion ?? 1,
        entry.builtFromCursor ?? "",
        JSON.stringify(entry.rawBuckets ?? []),
        JSON.stringify(entry.normalizedBuckets ?? []),
        JSON.stringify(entry.summary ?? {}),
        entry.builtAt ?? ""
      )
    );
  },
};

export { activityV2 };
