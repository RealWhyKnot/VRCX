import { afterAll, describe, test } from "vitest";

import {
  buildHeatmapBuckets,
  buildOverlapBuckets,
  buildSessionsFromEvents,
  buildSessionsFromGamelog,
  normalizeBuckets,
} from "../../src/shared/utils/activity-engine";
import { searchFriends } from "../../src/shared/utils/quick-search-utils";

import type { ActivityEvent, ActivitySession, GamelogSessionRow } from "../../src/types/activity";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW_MS = Date.UTC(2026, 10, 1);
const EVENT_COUNT = 200_000;
const GAMELOG_ROWS = 50_000;
const SESSION_COUNT = 20_000;
const FRIEND_COUNT = 5000;

function makeEvents(count: number): ActivityEvent[] {
  const startMs = NOW_MS - count * HOUR_MS;
  return Array.from({ length: count }, (_, index) => ({
    created_at: new Date(startMs + index * HOUR_MS).toISOString(),
    type: index % 2 === 0 ? "Online" : "Offline",
  }));
}

function makeGamelogRows(count: number): GamelogSessionRow[] {
  const startMs = NOW_MS - count * 3 * HOUR_MS;
  return Array.from({ length: count }, (_, index) => ({
    created_at: new Date(startMs + index * 3 * HOUR_MS).toISOString(),
    time: (index % 5) * 20 * 60 * 1000,
  }));
}

function makeSessions(count: number, offsetMs: number): ActivitySession[] {
  const startMs = NOW_MS - count * 4 * HOUR_MS;
  return Array.from({ length: count }, (_, index) => {
    const start = startMs + index * 4 * HOUR_MS + offsetMs;
    return { start, end: start + 2 * HOUR_MS };
  });
}

function makeFriends(count: number) {
  return new Map(
    Array.from({ length: count }, (_, index) => {
      const id = `usr_${String(index).padStart(8, "0")}`;
      return [
        id,
        {
          id,
          name: `Friend ${String(index)} ${index % 7 === 0 ? "Åsa" : "Kim"}`,
          memo: index % 11 === 0 ? "met at the club" : "",
          ref: {
            currentAvatarThumbnailImageUrl: `img_${id}`,
            note: index % 13 === 0 ? "roommate" : "",
            $userColour: "#fff",
          },
        },
      ] as const;
    })
  );
}

const events = makeEvents(EVENT_COUNT);
const gamelogRows = makeGamelogRows(GAMELOG_ROWS);
const selfSessions = makeSessions(SESSION_COUNT, 0);
const targetSessions = makeSessions(SESSION_COUNT, HOUR_MS);
const windowStartMs = NOW_MS - 365 * DAY_MS;
const buckets = buildHeatmapBuckets(selfSessions, windowStartMs, NOW_MS);
const friends = makeFriends(FRIEND_COUNT);
const comparer = new Intl.Collator(undefined, { usage: "search", sensitivity: "base" });

const rows: { name: string; meanMs: string; p99Ms: string; runs: number }[] = [];

function record(result: { name: string; latency: { mean: number; p99: number; samplesCount: number } }): void {
  rows.push({
    name: result.name,
    meanMs: result.latency.mean.toFixed(3),
    p99Ms: result.latency.p99.toFixed(3),
    runs: result.latency.samplesCount,
  });
}

afterAll(() => {
  const lines = rows.map((row) => `${row.meanMs.padStart(10)} ${row.p99Ms.padStart(10)} ${String(row.runs).padStart(7)}  ${row.name}`);
  const header = `${"mean ms".padStart(10)} ${"p99 ms".padStart(10)} ${"runs".padStart(7)}  benchmark`;
  process.stdout.write(`\n${[header, ...lines].join("\n")}\n`);
});

describe("activity", () => {
  test(`sessions from ${String(EVENT_COUNT)} online/offline events`, async ({ bench }) => {
    record(
      await bench(`sessions from ${String(EVENT_COUNT)} online/offline events`, () => {
        buildSessionsFromEvents(events);
      }).run()
    );
  });

  test(`sessions from ${String(GAMELOG_ROWS)} game log rows`, async ({ bench }) => {
    record(
      await bench(`sessions from ${String(GAMELOG_ROWS)} game log rows`, () => {
        buildSessionsFromGamelog(gamelogRows, undefined, NOW_MS);
      }).run()
    );
  });

  test(`heatmap from ${String(SESSION_COUNT)} sessions`, async ({ bench }) => {
    record(
      await bench(`heatmap from ${String(SESSION_COUNT)} sessions`, () => {
        buildHeatmapBuckets(selfSessions, windowStartMs, NOW_MS);
      }).run()
    );
  });

  test(`overlap of two lists of ${String(SESSION_COUNT)} sessions`, async ({ bench }) => {
    record(
      await bench(`overlap of two lists of ${String(SESSION_COUNT)} sessions`, () => {
        buildOverlapBuckets(selfSessions, targetSessions, windowStartMs, NOW_MS);
      }).run()
    );
  });

  test("normalize one week of buckets", async ({ bench }) => {
    record(
      await bench("normalize one week of buckets", () => {
        normalizeBuckets(buckets, { rangeDays: 365 });
      }).run()
    );
  });
});

describe("quick search", () => {
  test(`name match across ${String(FRIEND_COUNT)} friends`, async ({ bench }) => {
    record(
      await bench(`name match across ${String(FRIEND_COUNT)} friends`, () => {
        searchFriends("friend 49", friends, comparer);
      }).run()
    );
  });

  test(`no match across ${String(FRIEND_COUNT)} friends`, async ({ bench }) => {
    record(
      await bench(`no match across ${String(FRIEND_COUNT)} friends`, () => {
        searchFriends("zzzzzz", friends, comparer);
      }).run()
    );
  });

  test(`note match across ${String(FRIEND_COUNT)} friends`, async ({ bench }) => {
    record(
      await bench(`note match across ${String(FRIEND_COUNT)} friends`, () => {
        searchFriends("roommate", friends, comparer);
      }).run()
    );
  });
});
