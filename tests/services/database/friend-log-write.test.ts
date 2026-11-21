import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: { run: (call: Promise<void>) => call },
}));

import { friendLogHistory } from "../../../src/services/database/friend-log-history";

afterEach(() => vi.unstubAllGlobals());

test("waits for committed live rows before refreshing a history page", async () => {
  const write = Promise.withResolvers<undefined>();
  vi.stubGlobal("DatabaseApi", { AddFriendLogHistory: () => write.promise });
  friendLogHistory.addFriendLogHistory({
    created_at: "2026-11-20T00:00:00Z",
    type: "Friend",
    userId: "usr_one",
    displayName: "One",
  });
  let isComplete = false;
  const reload = friendLogHistory.waitForFriendLogHistoryWrites().then(() => {
    isComplete = true;
  });
  await Promise.resolve();
  expect(isComplete).toBe(false);
  write.resolve(undefined);
  await reload;
  expect(isComplete).toBe(true);
});

test("returns a deletion promise for the view to await", async () => {
  const write = Promise.withResolvers<undefined>();
  const remove = vi.fn(() => write.promise);
  vi.stubGlobal("DatabaseApi", { DeleteFriendLogHistoryById: remove });
  let isComplete = false;
  const deletion = friendLogHistory
    .deleteFriendLogHistory({
      rowId: 7,
      created_at: "2026-11-20T00:00:00Z",
      type: "Friend",
      userId: "usr_one",
    })
    .then(() => {
      isComplete = true;
    });
  expect(remove).toHaveBeenCalledWith(7);
  await Promise.resolve();
  expect(isComplete).toBe(false);
  write.resolve(undefined);
  await deletion;
  expect(isComplete).toBe(true);
});
