import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));

import { friendLogCurrent } from "../../../src/services/database/friend-log-current.ts";
import { friendLogHistory } from "../../../src/services/database/friend-log-history.ts";

function createBridge() {
  return {
    GetFriendLogHistory: vi.fn(() => Promise.resolve("[]")),
    AddFriendLogHistory: vi.fn(() => Promise.resolve()),
    AddFriendLogHistoryArray: vi.fn(() => Promise.resolve()),
    GetFriendLogHistoryForUserId: vi.fn(() => Promise.resolve("[]")),
    DeleteFriendLogHistoryById: vi.fn(() => Promise.resolve()),
    DeleteFriendLogHistoryByKey: vi.fn(() => Promise.resolve()),
    GetFriendLogCurrent: vi.fn(() => Promise.resolve("[]")),
    SetFriendLogCurrent: vi.fn(() => Promise.resolve()),
    SetFriendLogCurrentArray: vi.fn(() => Promise.resolve()),
  };
}

describe("friendLogHistory", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  test("returns the newest row first and keeps only the previous name for DisplayName rows", async () => {
    mocks.rows.mockResolvedValueOnce([
      [1, "2026-01-01T00:00:00.000Z", "DisplayName", "usr_a", "New", "Old", null, null, 3],
      [2, "2026-01-02T00:00:00.000Z", "TrustLevel", "usr_a", "Name", null, "Visitor", "Known", 4],
    ]);

    const result = await friendLogHistory.getFriendLogHistory();

    expect(result).toEqual([
      {
        rowId: 2,
        created_at: "2026-01-02T00:00:00.000Z",
        type: "TrustLevel",
        userId: "usr_a",
        displayName: "Name",
        friendNumber: 4,
        trustLevel: "Visitor",
        previousTrustLevel: "Known",
      },
      {
        rowId: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        type: "DisplayName",
        userId: "usr_a",
        displayName: "New",
        friendNumber: 3,
        previousDisplayName: "Old",
      },
    ]);
    expect(result[0]).not.toHaveProperty("previousDisplayName");
    expect(result[1]).not.toHaveProperty("trustLevel");
  });

  test("batch insert sends one column array per field and nulls for non-string values", () => {
    friendLogHistory.addFriendLogHistoryArray([
      { created_at: "2026-01-01T00:00:00.000Z", type: "Friend", userId: "usr_a", displayName: "A", friendNumber: 5 },
      { created_at: "2026-01-02T00:00:00.000Z", type: "TrustLevel", userId: "usr_b", displayName: "B", trustLevel: "Known", previousTrustLevel: "Visitor" },
    ]);

    expect(bridge.AddFriendLogHistoryArray).toHaveBeenCalledWith(
      ["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"],
      ["Friend", "TrustLevel"],
      ["usr_a", "usr_b"],
      ["A", "B"],
      [null, null],
      [null, "Known"],
      [null, "Visitor"],
      [null, null]
    );
  });

  test("batch insert does nothing for an empty list", () => {
    friendLogHistory.addFriendLogHistoryArray([]);

    expect(bridge.AddFriendLogHistoryArray).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  test("passes the type filter list through, and an empty list means no filter", async () => {
    mocks.rows.mockResolvedValue([]);

    await friendLogHistory.getFriendLogHistoryForUserId("usr_a", ["DisplayName", "Friend"]);
    await friendLogHistory.getFriendLogHistoryForUserId("usr_a", []);

    expect(bridge.GetFriendLogHistoryForUserId).toHaveBeenNthCalledWith(1, "usr_a", ["DisplayName", "Friend"]);
    expect(bridge.GetFriendLogHistoryForUserId).toHaveBeenNthCalledWith(2, "usr_a", []);
  });

  test("deletes by row id when one is present, otherwise by created_at, type and user", () => {
    friendLogHistory.deleteFriendLogHistory({ rowId: 7, created_at: "c", type: "Friend", userId: "usr_a" });
    friendLogHistory.deleteFriendLogHistory({ rowId: null, created_at: "c", type: "Friend", userId: "usr_a" });

    expect(bridge.DeleteFriendLogHistoryById).toHaveBeenCalledWith(7);
    expect(bridge.DeleteFriendLogHistoryByKey).toHaveBeenCalledWith("c", "Friend", "usr_a");
  });
});

describe("friendLogCurrent", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  test("returns the rows last-first with a numeric friend number", async () => {
    mocks.rows.mockResolvedValueOnce([
      ["usr_a", "A", "Visitor", 1],
      ["usr_b", "B", "Known", 2],
    ]);

    const result = await friendLogCurrent.getFriendLogCurrent();

    expect(result).toEqual([
      { userId: "usr_b", displayName: "B", trustLevel: "Known", friendNumber: 2 },
      { userId: "usr_a", displayName: "A", trustLevel: "Visitor", friendNumber: 1 },
    ]);
  });

  test("batch write sends the friend number as text and empty strings for missing text", () => {
    friendLogCurrent.setFriendLogCurrentArray([
      { userId: "usr_a", displayName: "A", trustLevel: "Visitor", friendNumber: 0 },
      { userId: undefined, displayName: 3, trustLevel: "Known", friendNumber: 12 },
    ]);

    expect(bridge.SetFriendLogCurrentArray).toHaveBeenCalledWith(["usr_a", ""], ["A", ""], ["Visitor", "Known"], ["0", "12"]);
  });

  test("batch write does nothing for an empty list", () => {
    friendLogCurrent.setFriendLogCurrentArray([]);

    expect(bridge.SetFriendLogCurrentArray).not.toHaveBeenCalled();
  });
});
