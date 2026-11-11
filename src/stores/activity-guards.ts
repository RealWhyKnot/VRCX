import type { ActivityDailyTotal, ActivitySession } from "../types/activity.ts";

import type { ActivityOverlapBody, ActivityViewBody, CachedActivityView, CachedOverlapView, SessionsSnapshotResult } from "./activity-types.ts";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return isUnknownArray(value) && value.every((item) => typeof item === "number");
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isActivitySession(value: unknown): value is ActivitySession {
  return isObject(value) && "start" in value && typeof value.start === "number" && "end" in value && typeof value.end === "number";
}

function isDailyTotal(value: unknown): value is ActivityDailyTotal {
  return isObject(value) && "date" in value && typeof value.date === "string" && "totalMs" in value && typeof value.totalMs === "number";
}

export function parseActivityViewBody(value: unknown): ActivityViewBody | null {
  if (!isObject(value) || !("rawBuckets" in value) || !("normalizedBuckets" in value)) {
    return null;
  }
  if (!isNumberArray(value.rawBuckets) || !isNumberArray(value.normalizedBuckets)) {
    return null;
  }
  if (!("peakDay" in value) || !("peakTime" in value) || !("filteredEventCount" in value)) {
    return null;
  }
  if (typeof value.peakDay !== "string" || typeof value.peakTime !== "string" || typeof value.filteredEventCount !== "number") {
    return null;
  }
  return {
    rawBuckets: value.rawBuckets,
    normalizedBuckets: value.normalizedBuckets,
    peakDay: value.peakDay,
    peakTime: value.peakTime,
    filteredEventCount: value.filteredEventCount,
  };
}

export function parseOverlapViewBody(value: unknown): ActivityOverlapBody | null {
  if (!isObject(value) || !("rawBuckets" in value) || !("normalizedBuckets" in value)) {
    return null;
  }
  if (!isNumberArray(value.rawBuckets) || !isNumberArray(value.normalizedBuckets)) {
    return null;
  }
  if (!("overlapPercent" in value) || !("bestOverlapTime" in value)) {
    return null;
  }
  if (typeof value.overlapPercent !== "number" || typeof value.bestOverlapTime !== "string") {
    return null;
  }
  return {
    rawBuckets: value.rawBuckets,
    normalizedBuckets: value.normalizedBuckets,
    overlapPercent: value.overlapPercent,
    bestOverlapTime: value.bestOverlapTime,
  };
}

export function requireActivityViewBody(value: unknown): ActivityViewBody {
  const body = parseActivityViewBody(value);
  if (body === null) {
    throw new Error("Activity worker returned an invalid activity view");
  }
  return body;
}

export function requireOverlapViewBody(value: unknown): ActivityOverlapBody {
  const body = parseOverlapViewBody(value);
  if (body === null) {
    throw new Error("Activity worker returned an invalid overlap view");
  }
  return body;
}

function readPersistedFields(
  value: object
): { summary: object; rawBuckets: unknown; normalizedBuckets: unknown; builtFromCursor: unknown; builtAt: unknown } | null {
  if (!("summary" in value) || !isObject(value.summary)) {
    return null;
  }
  const rawBuckets: unknown = "rawBuckets" in value ? value.rawBuckets : undefined;
  const normalizedBuckets: unknown = "normalizedBuckets" in value ? value.normalizedBuckets : undefined;
  const builtFromCursor: unknown = "builtFromCursor" in value ? value.builtFromCursor : undefined;
  const builtAt: unknown = "builtAt" in value ? value.builtAt : undefined;
  return { summary: value.summary, rawBuckets, normalizedBuckets, builtFromCursor, builtAt };
}

export function parsePersistedActivityView(value: unknown): CachedActivityView | null {
  if (!isObject(value)) {
    return null;
  }
  const fields = readPersistedFields(value);
  if (fields === null || typeof fields.builtFromCursor !== "string" || typeof fields.builtAt !== "string") {
    return null;
  }
  const body = parseActivityViewBody({
    ...fields.summary,
    rawBuckets: fields.rawBuckets,
    normalizedBuckets: fields.normalizedBuckets,
  });
  if (body === null) {
    return null;
  }
  return {
    ...body,
    builtFromCursor: fields.builtFromCursor,
    builtAt: fields.builtAt,
  };
}

export function parsePersistedOverlapView(value: unknown): CachedOverlapView | null {
  if (!isObject(value)) {
    return null;
  }
  const fields = readPersistedFields(value);
  if (fields === null || typeof fields.builtFromCursor !== "string" || typeof fields.builtAt !== "string") {
    return null;
  }
  const body = parseOverlapViewBody({
    ...fields.summary,
    rawBuckets: fields.rawBuckets,
    normalizedBuckets: fields.normalizedBuckets,
  });
  if (body === null) {
    return null;
  }
  return {
    ...body,
    builtFromCursor: fields.builtFromCursor,
    builtAt: fields.builtAt,
  };
}

export function requireSessionsSnapshot(value: unknown): SessionsSnapshotResult {
  if (isObject(value) && "sessions" in value && "pendingSessionStartAt" in value) {
    const { sessions, pendingSessionStartAt } = value;
    if (isUnknownArray(sessions) && sessions.every(isActivitySession) && isNullableNumber(pendingSessionStartAt)) {
      return {
        sessions,
        pendingSessionStartAt,
      };
    }
  }
  throw new Error("Activity worker returned an invalid sessions snapshot");
}

export function requireDailySummary(value: unknown): ActivityDailyTotal[] {
  if (isObject(value) && "dailySummary" in value) {
    const { dailySummary } = value;
    if (isUnknownArray(dailySummary) && dailySummary.every(isDailyTotal)) {
      return dailySummary;
    }
  }
  throw new Error("Activity worker returned an invalid daily summary");
}
