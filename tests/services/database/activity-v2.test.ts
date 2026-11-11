import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DatabaseRow } from "../../../src/services/sqlite.ts";

const mocks = vi.hoisted(() => ({
  rowQueue: [] as DatabaseRow[][],
  calls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: () => Promise.resolve(mocks.rowQueue.shift() ?? []),
    run: () => Promise.resolve(),
  },
}));

import { activityV2 } from "../../../src/services/database/activity-v2.ts";

function queueRows(...batches: DatabaseRow[][]): void {
  mocks.rowQueue.push(...batches);
}

function callsTo(method: string): unknown[][] {
  return mocks.calls.filter((call) => call.method === method).map((call) => call.args);
}

describe("activityV2 reads", () => {
  beforeEach(() => {
    mocks.rowQueue.splice(0);
    mocks.calls.splice(0);
    vi.stubGlobal(
      "DatabaseApi",
      new Proxy(
        {},
        {
          get:
            (_target, method) =>
            (...args: unknown[]) => {
              mocks.calls.push({ method: String(method), args });
              return Promise.resolve("");
            },
        }
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("merges the window slice with the end boundary row in time order", async () => {
    queueRows(
      [
        ["2026-01-01T10:00:00Z", "Online"],
        ["2026-01-01T12:00:00Z", "Offline"],
      ],
      [["2026-01-01T11:00:00Z", "Online"]]
    );

    const rows = await activityV2.getFriendPresenceSliceV2("usr_1", "2026-01-01T09:00:00Z", "2026-01-01T13:00:00Z");

    expect(rows).toEqual([
      { created_at: "2026-01-01T10:00:00Z", type: "Online" },
      { created_at: "2026-01-01T11:00:00Z", type: "Online" },
      { created_at: "2026-01-01T12:00:00Z", type: "Offline" },
    ]);
    expect(callsTo("GetFriendPresenceSliceWindow")).toEqual([["usr_1", "2026-01-01T09:00:00Z", "2026-01-01T13:00:00Z"]]);
    expect(callsTo("GetFriendPresenceSliceEnd")).toEqual([["usr_1", "2026-01-01T13:00:00Z"]]);
  });

  test("skips the end boundary query when no end date is given", async () => {
    queueRows([["2026-01-01T10:00:00Z", "Online"]]);

    await activityV2.getFriendPresenceSliceV2("usr_1", "2026-01-01T09:00:00Z");

    expect(callsTo("GetFriendPresenceSliceEnd")).toEqual([]);
  });

  test("reads the current user location with the inclusive flag passed through", async () => {
    queueRows([["2026-01-01T10:00:00Z", 1234]]);

    const rows = await activityV2.getActivitySourceAfterV2({
      userId: "usr_1",
      isSelf: true,
      afterCreatedAt: "2026-01-01T09:00:00Z",
      isInclusive: true,
    });

    expect(rows).toEqual([{ created_at: "2026-01-01T10:00:00Z", time: 1234 }]);
    expect(callsTo("GetCurrentUserLocationAfter")).toEqual([["2026-01-01T09:00:00Z", true]]);
  });

  test("maps the sync state from the last row and keeps a null pending start", async () => {
    queueRows([["usr_1", "2026-01-01T00:00:00Z", 1, "2025-12-31T00:00:00Z", null, 30]]);

    const state = await activityV2.getActivitySyncStateV2("usr_1");

    expect(state).toEqual({
      userId: "usr_1",
      updatedAt: "2026-01-01T00:00:00Z",
      isSelf: true,
      sourceLastCreatedAt: "2025-12-31T00:00:00Z",
      pendingSessionStartAt: null,
      cachedRangeDays: 30,
    });
  });

  test("returns null when no sync state row exists", async () => {
    queueRows([]);

    expect(await activityV2.getActivitySyncStateV2("usr_1")).toBeNull();
  });

  test("parses cached bucket JSON and falls back when a cell is empty or invalid", async () => {
    queueRows([["usr_1", "usr_2", 7, "activity", "", 2, "cursor", "[1,2]", "not json", "", "2026-01-01T00:00:00Z"]]);

    const cache = await activityV2.getActivityBucketCacheV2({
      ownerUserId: "usr_1",
      targetUserId: "usr_2",
      rangeDays: 7,
      viewKind: "activity",
    });

    expect(cache).toEqual({
      ownerUserId: "usr_1",
      targetUserId: "usr_2",
      rangeDays: 7,
      viewKind: "activity",
      excludeKey: "",
      bucketVersion: 2,
      builtFromCursor: "cursor",
      rawBuckets: [1, 2],
      normalizedBuckets: [],
      summary: {},
      builtAt: "2026-01-01T00:00:00Z",
    });
  });

  test("reads sessions with the open tail flag as a boolean", async () => {
    queueRows([
      [1000, 2000, 1, "r1"],
      [3000, 4000, 0, "r2"],
    ]);

    expect(await activityV2.getActivitySessionsV2("usr_1")).toEqual([
      { start: 1000, end: 2000, isOpenTail: true, sourceRevision: "r1" },
      { start: 3000, end: 4000, isOpenTail: false, sourceRevision: "r2" },
    ]);
  });
});

describe("activityV2 writes", () => {
  beforeEach(() => {
    mocks.calls.splice(0);
    vi.stubGlobal(
      "DatabaseApi",
      new Proxy(
        {},
        {
          get:
            (_target, method) =>
            (...args: unknown[]) => {
              mocks.calls.push({ method: String(method), args });
              return Promise.resolve("");
            },
        }
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends session columns as parallel strings with open tails as 1 or 0", async () => {
    await activityV2.replaceActivitySessionsV2("usr_1", [
      { start: 1000, end: 2000, isOpenTail: true, sourceRevision: "r1" },
      { start: 3000, end: 4000, isOpenTail: false, sourceRevision: "r2" },
    ]);

    expect(callsTo("ReplaceActivitySessions")).toEqual([["usr_1", ["1000", "3000"], ["2000", "4000"], ["1", "0"], ["r1", "r2"]]]);
  });

  test("appends from a cut-off start only when replaceFromStartAt is set", async () => {
    await activityV2.appendActivitySessionsV2({ userId: "usr_1", sessions: [], replaceFromStartAt: 5000 });
    await activityV2.appendActivitySessionsV2({ userId: "usr_1", sessions: [] });

    expect(callsTo("AppendActivitySessionsFrom")).toEqual([["usr_1", 5000, [], [], [], []]]);
    expect(callsTo("AppendActivitySessions")).toEqual([["usr_1", [], [], [], []]]);
  });

  test("fills missing bucket cache fields with empty JSON defaults", async () => {
    await activityV2.upsertActivityBucketCacheV2({ ownerUserId: "usr_1", rangeDays: 7, viewKind: "activity" });

    expect(callsTo("UpsertActivityBucketCache")).toEqual([["usr_1", "", 7, "activity", "", 1, "", "[]", "[]", "{}", ""]]);
  });

  test("passes a missing pending session start as null", async () => {
    await activityV2.upsertActivitySyncStateV2({ userId: "usr_1", isSelf: false });

    expect(callsTo("UpsertActivitySyncState")).toEqual([["usr_1", "", false, "", null, 0]]);
  });
});
