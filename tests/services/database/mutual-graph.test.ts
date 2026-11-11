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

import { mutualGraph } from "../../../src/services/database/mutual-graph.ts";

function callsTo(method: string): unknown[][] {
  return mocks.calls.filter((call) => call.method === method).map((call) => call.args);
}

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
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mutualGraph reads", () => {
  test("builds the snapshot with empty lists for friends that have no links", async () => {
    mocks.rowQueue.push(
      [["f1"], ["f2"], [null]],
      [
        ["f1", "m1"],
        ["f1", "m2"],
        ["f3", "m1"],
        ["f1", null],
      ]
    );

    const snapshot = await mutualGraph.getMutualGraphSnapshot();

    expect(snapshot).toEqual(
      new Map([
        ["f1", ["m1", "m2"]],
        ["f2", []],
        ["f3", ["m1"]],
      ])
    );
  });

  test("maps meta rows with a null last fetch time and skips rows without a friend id", async () => {
    mocks.rowQueue.push([
      ["f1", "2026-01-01T00:00:00Z", 1],
      ["f2", null, 0],
      [null, "2026-01-01T00:00:00Z", 0],
    ]);

    const meta = await mutualGraph.getMutualGraphMeta();

    expect(meta).toEqual(
      new Map([
        ["f1", { lastFetchedAt: "2026-01-01T00:00:00Z", optedOut: true }],
        ["f2", { lastFetchedAt: null, optedOut: false }],
      ])
    );
  });
});

describe("mutualGraph writes", () => {
  test("flattens the snapshot into parallel edge columns and skips empty ids", async () => {
    await mutualGraph.saveMutualGraphSnapshot(
      new Map<string, Iterable<string>>([
        ["f1", ["m1", "", "m2"]],
        ["", ["m9"]],
        ["f2", []],
      ])
    );

    expect(callsTo("SaveMutualGraph")).toEqual([
      [
        ["f1", "f2"],
        ["f1", "f1"],
        ["m1", "m2"],
      ],
    ]);
  });

  test("drops empty mutual ids before updating one friend", async () => {
    await mutualGraph.updateMutualsForFriend("f1", ["m1", "", "m2"]);
    await mutualGraph.updateMutualsForFriend("", ["m3"]);

    expect(callsTo("UpdateMutualsForFriend")).toEqual([["f1", ["m1", "m2"]]]);
  });

  test("uses the current time when no last fetch time is given", async () => {
    await mutualGraph.upsertMutualGraphMeta("f1", { optedOut: true });
    await mutualGraph.upsertMutualGraphMeta("f2", { lastFetchedAt: "", optedOut: false });

    expect(callsTo("UpsertMutualGraphMeta")).toEqual([
      ["f1", "2026-01-01T00:00:00.000Z", true],
      ["f2", "2026-01-01T00:00:00.000Z", false],
    ]);
  });

  test("splits bulk meta into opted-in and opted-out friend ids", async () => {
    await mutualGraph.bulkUpsertMutualGraphMeta(
      new Map([
        ["f1", { optedOut: false }],
        ["f2", { optedOut: true }],
        ["", { optedOut: false }],
      ])
    );

    expect(callsTo("BulkUpsertMutualGraphMeta")).toEqual([["2026-01-01T00:00:00.000Z", ["f1"], ["f2"]]]);
  });
});
