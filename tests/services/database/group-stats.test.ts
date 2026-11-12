import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
  },
}));

import { groupStats } from "../../../src/services/database/group-stats.ts";

const responses = new Map<string, unknown[][]>();

describe("groupStats", () => {
  beforeEach(() => {
    responses.clear();
    vi.stubGlobal("DatabaseApi", {
      GetGroupVisitStats: vi.fn(() => Promise.resolve("visits")),
      GetGroupNotificationStats: vi.fn(() => Promise.resolve("notifications")),
    });
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
  });

  test("maps visit rows by group id", async () => {
    responses.set("visits", [
      ["grp_a", 3, "2026-10-01T00:00:00.000Z", 5000],
      ["grp_b", 1, null, null],
      [null, 9, "2026-01-01T00:00:00.000Z", 1],
    ]);
    const stats = await groupStats.getGroupVisitStats();
    expect([...stats]).toEqual([
      ["grp_a", { visitCount: 3, lastVisitAt: "2026-10-01T00:00:00.000Z", timeSpent: 5000 }],
      ["grp_b", { visitCount: 1, lastVisitAt: "", timeSpent: 0 }],
    ]);
  });

  test("maps notification rows by group id", async () => {
    responses.set("notifications", [
      ["grp_a", 40, "2026-11-01T00:00:00.000Z"],
      ["", 2, "2026-11-01T00:00:00.000Z"],
    ]);
    const stats = await groupStats.getGroupNotificationStats();
    expect([...stats]).toEqual([["grp_a", { notificationCount: 40, lastNotificationAt: "2026-11-01T00:00:00.000Z" }]]);
  });

  test("returns empty maps when nothing is recorded", async () => {
    await expect(groupStats.getGroupVisitStats()).resolves.toEqual(new Map());
    await expect(groupStats.getGroupNotificationStats()).resolves.toEqual(new Map());
  });
});
