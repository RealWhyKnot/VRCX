import {
  ONLINE_SESSION_MERGE_GAP_MS,
  buildSessionsFromEvents as engineBuildSessionsFromEvents,
  buildSessionsFromGamelog as engineBuildSessionsFromGamelog,
  buildHeatmapBuckets,
  buildOverlapBuckets,
  clipSessionsToRange,
  findBestOverlapTimeFromBuckets,
} from "./activity-engine.ts";
import type { ActivityEvent, ActivitySession, GamelogSessionRow } from "../../types/activity";

function createEmptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

export function buildSessionsFromEvents(events: ActivityEvent[]): ActivitySession[] {
  return engineBuildSessionsFromEvents(events).sessions;
}

export function buildSessionsFromGamelog(rows: GamelogSessionRow[], mergeGapMs = ONLINE_SESSION_MERGE_GAP_MS): ActivitySession[] {
  return engineBuildSessionsFromGamelog(rows, mergeGapMs);
}

export function filterSessionsByPeriod(sessions: ActivitySession[], cutoffMs: number): ActivitySession[] {
  return clipSessionsToRange(sessions, cutoffMs, Date.now());
}

export function calculateOverlapGrid(sessionsA: ActivitySession[], sessionsB: ActivitySession[]) {
  const nowMs = Date.now();
  const rawBuckets = buildOverlapBuckets(sessionsA, sessionsB, 0, nowMs);
  const grid = createEmptyGrid();
  let maxVal = 0;
  for (let slot = 0; slot < 168; slot++) {
    const value = rawBuckets[slot] ?? 0;
    if (value > maxVal) {
      maxVal = value;
    }
    const row = grid[Math.floor(slot / 24)];
    if (row) {
      row[slot % 24] = value;
    }
  }
  const totalOverlapMs = rawBuckets.reduce((sum, value) => sum + value, 0) * 60000;
  const totalUserAMs = sumDurations(sessionsA);
  const totalUserBMs = sumDurations(sessionsB);
  const minOnlineMs = Math.min(totalUserAMs, totalUserBMs);
  const overlapPercent = minOnlineMs > 0 ? Math.round((totalOverlapMs / minOnlineMs) * 100) : 0;
  return {
    grid,
    maxVal,
    totalOverlapMs,
    totalUserAMs,
    totalUserBMs,
    overlapPercent,
  };
}

export function aggregateSessionsToGrid(sessions: ActivitySession[]) {
  const rawBuckets = buildHeatmapBuckets(sessions, 0, Date.now());
  const grid = createEmptyGrid();
  let maxVal = 0;
  for (let slot = 0; slot < 168; slot++) {
    const value = rawBuckets[slot] ?? 0;
    if (value > maxVal) {
      maxVal = value;
    }
    const row = grid[Math.floor(slot / 24)];
    if (row) {
      row[slot % 24] = value;
    }
  }
  return { grid, maxVal };
}

export function findBestOverlapTime(grid: number[][], dayLabels: string[]): string {
  const buckets: number[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      buckets.push(grid[day]?.[hour] ?? 0);
    }
  }
  return findBestOverlapTimeFromBuckets(buckets, dayLabels);
}

function sumDurations(sessions: ActivitySession[]): number {
  return sessions.reduce((sum, session) => sum + (session.end - session.start), 0);
}
