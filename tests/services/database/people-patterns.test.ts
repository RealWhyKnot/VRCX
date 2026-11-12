import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  repeat: vi.fn((_selfId: string, _minPlaces: number, _limit: number) => Promise.resolve("repeat")),
  kicks: vi.fn((_limit: number) => Promise.resolve("kicks")),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
  },
}));

import { peoplePatterns } from "../../../src/services/database/people-patterns.ts";

const responses = new Map<string, unknown[][]>();

describe("peoplePatterns", () => {
  beforeEach(() => {
    responses.clear();
    vi.stubGlobal("DatabaseApi", {
      GetRepeatEncounters: mocks.repeat,
      GetFriendGatherings: vi.fn(() => Promise.resolve("stays")),
      GetFriendPresenceSince: vi.fn(() => Promise.resolve("presence")),
      GetOwnLocationsSince: vi.fn(() => Promise.resolve("own")),
      GetFirstMetByUserId: vi.fn(() => Promise.resolve("first")),
      GetVoteKickEvents: mocks.kicks,
    });
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
    mocks.repeat.mockClear();
  });

  test("maps repeat encounters and asks for at least three shared instances", async () => {
    responses.set("repeat", [
      ["usr_a", "Ann", 7, "2026-10-01T00:00:00.000Z", 9000],
      ["usr_b", null, null, null, null],
      [null, "Nobody", 5, "", 1],
    ]);
    expect(await peoplePatterns.getRepeatEncounters("usr_me")).toEqual([
      { id: "usr_a", displayName: "Ann", placeCount: 7, lastSeenAt: "2026-10-01T00:00:00.000Z", timeTogether: 9000 },
      { id: "usr_b", displayName: "usr_b", placeCount: 0, lastSeenAt: "", timeTogether: 0 },
    ]);
    expect(mocks.repeat).toHaveBeenCalledWith("usr_me", 3, 500);
  });

  test("maps friend stays and skips rows without a place, person or times", async () => {
    responses.set("stays", [
      ["wrld_a:1", "World", "Group", "usr_a", "Ann", 1000, 5000],
      ["wrld_a:1", null, null, "usr_b", null, 2000, 6000],
      ["wrld_a:1", "World", "", "usr_c", "Cy", null, 6000],
      [null, "World", "", "usr_d", "Di", 1, 2],
    ]);
    expect(await peoplePatterns.getFriendStays("2026-08-01")).toEqual([
      { location: "wrld_a:1", worldName: "World", groupName: "Group", userId: "usr_a", displayName: "Ann", startedAt: 1000, endedAt: 5000 },
      { location: "wrld_a:1", worldName: "", groupName: "", userId: "usr_b", displayName: "usr_b", startedAt: 2000, endedAt: 6000 },
    ]);
  });

  test("maps vote kick events, caps how many it reads and drops rows with no text", async () => {
    responses.set("kicks", [
      ["2026-11-01T10:00:00.000Z", "Vote to kick Rude succeeded", "Pub"],
      ["2026-11-01T11:00:00.000Z", "You have been kicked from the instance", null],
      ["2026-11-01T12:00:00.000Z", null, "Pub"],
      [null, "Vote to kick Ghost succeeded", "Pub"],
    ]);
    expect(await peoplePatterns.getVoteKickEvents()).toEqual([
      { at: "2026-11-01T10:00:00.000Z", text: "Vote to kick Rude succeeded", worldName: "Pub" },
      { at: "2026-11-01T11:00:00.000Z", text: "You have been kicked from the instance", worldName: "" },
    ]);
    expect(mocks.kicks).toHaveBeenCalledWith(2000);
  });

  test("maps presence events, my own time in instances and the first meeting", async () => {
    responses.set("presence", [
      ["usr_a", "Ann", 1000, "Online"],
      ["usr_a", "Ann", 4000, "Offline"],
      [null, "Ghost", 1, "Online"],
    ]);
    responses.set("own", [
      [1000, 500],
      [3000, 0],
      [null, 5],
    ]);
    responses.set("first", [["2025-06-20T05:12:48.986Z"]]);
    expect(await peoplePatterns.getFriendPresenceSince("2026-08-01")).toEqual([
      { userId: "usr_a", displayName: "Ann", at: 1000, isOnline: true },
      { userId: "usr_a", displayName: "Ann", at: 4000, isOnline: false },
    ]);
    expect(await peoplePatterns.getOwnLocationSpans("2026-08-01")).toEqual([{ startedAt: 1000, endedAt: 1500 }]);
    expect(await peoplePatterns.getFirstMet("usr_a")).toBe("2025-06-20T05:12:48.986Z");
    responses.set("first", [[null]]);
    expect(await peoplePatterns.getFirstMet("usr_z")).toBe("");
  });
});
