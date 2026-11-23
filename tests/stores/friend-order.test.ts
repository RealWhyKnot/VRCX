import { beforeEach, expect, test, vi } from "vitest";
import type { FriendLogHistoryRow, FriendStoreContext } from "../../src/stores/friend-types";

const mocks = vi.hoisted(() => ({
  history: vi.fn<() => Promise<FriendLogHistoryRow[]>>(),
  writes: vi.fn<() => Promise<unknown>>(() => Promise.resolve()),
  config: vi.fn<() => Promise<string>>(),
}));
vi.mock("../../src/services/config", () => ({ configRepository: { getString: mocks.config, setInt: () => Promise.resolve() } }));
vi.mock("../../src/services/database", () => ({
  database: { getFriendLogHistory: mocks.history, waitForFriendLogHistoryWrites: mocks.writes, setFriendLogCurrent: vi.fn() },
}));
import { applyFriendLogFriendOrder, applyFriendLogFriendOrderInReverse, getFriendLogFriendOrder, restoreFriendNumber } from "../../src/stores/friend-order";

const records: FriendLogHistoryRow[] = Array.from({ length: 7 }, (_, index) => ({
  rowId: index + 1,
  created_at: `2026-01-0${index + 1}T00:00:00Z`,
  type: "Friend",
  userId: `usr_${index % 6}`,
  displayName: String(index % 6),
  friendNumber: null,
})).reverse();

function context(data: FriendLogHistoryRow[]): FriendStoreContext {
  const friends: FriendStoreContext["friends"] = new Map();
  const friendLog: FriendStoreContext["friendLog"] = new Map();
  for (let index = 0; index < 6; index += 1) {
    const id = `usr_${index}`;
    friends.set(id, { id, name: id, state: "offline", isVIP: false, ref: undefined, pendingOffline: false, $nickName: "" });
    friendLog.set(id, { userId: id, displayName: id, trustLevel: null, friendNumber: 0 });
  }
  return {
    friends,
    friendLog,
    state: { friendNumber: 1 },
    friendLogTable: { data, filters: [], loading: false, pageSizeLinked: true },
    requestIds: { stats: 0, mutualCount: 0, mutualOptedOut: 0 },
    reindexSortedFriend: vi.fn(),
    runInSortedFriendsBatch: (work) => work(),
  };
}

beforeEach(() => {
  mocks.history.mockReset().mockResolvedValue(records);
  mocks.writes.mockReset().mockResolvedValue(undefined);
  mocks.config.mockReset().mockResolvedValue(JSON.stringify({ "20260101": ["usr_1", "usr_2", "usr_3", "usr_4", "usr_5", "usr_0"] }));
});

test.each(["forward", "reverse", "restore"])("%s order uses stored history regardless of the displayed page or filter", async (mode) => {
  const contexts = [context([]), context(records.slice(0, 1)), context(records.filter((row) => row.userId === "usr_4"))];
  for (const ctx of contexts) {
    if (mode === "forward") await applyFriendLogFriendOrder(ctx);
    else if (mode === "reverse") await applyFriendLogFriendOrderInReverse(ctx);
    else expect(await restoreFriendNumber(ctx, { id: "usr_self", friends: [...ctx.friends.keys()] })).toBe(true);
  }
  const numbers = contexts.map((ctx) => [...ctx.friendLog.values()].map((row) => row.friendNumber));
  expect(numbers[1]).toEqual(numbers[0]);
  expect(numbers[2]).toEqual(numbers[0]);
  expect(numbers[0]).toEqual(mode === "reverse" ? [6, 1, 2, 3, 4, 5] : [7, 2, 3, 4, 5, 6]);
  expect(mocks.history).toHaveBeenCalledTimes(3);
});

test("keeps the existing newest-observation deduplication and waits for pending writes", async () => {
  expect(getFriendLogFriendOrder(records).map((row) => row.id)).toEqual(["usr_1", "usr_2", "usr_3", "usr_4", "usr_5", "usr_0"]);
  const pending = Promise.withResolvers<undefined>();
  mocks.writes.mockReturnValueOnce(pending.promise);
  const applying = applyFriendLogFriendOrder(context([]));
  expect(mocks.history).not.toHaveBeenCalled();
  pending.resolve(undefined);
  await applying;
  expect(mocks.history).toHaveBeenCalledOnce();
});
