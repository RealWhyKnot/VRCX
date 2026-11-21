import { ref } from "vue";
import { beforeEach, expect, test, vi } from "vitest";

import type { FriendLogHistoryRow, FriendLogTable } from "../../src/stores/friend-types";

const mocks = vi.hoisted(() => ({
  count: vi.fn<(...args: unknown[]) => Promise<number>>(),
  page: vi.fn<(...args: unknown[]) => Promise<FriendLogHistoryRow[]>>(),
}));
vi.mock("../../src/services/database", () => ({ database: { getFriendLogHistoryCount: mocks.count, getFriendLogHistoryPage: mocks.page } }));
import { createFriendHistory } from "../../src/stores/friend-history";

const makeRow = (rowId: number): FriendLogHistoryRow => ({
  rowId,
  created_at: "2026-11-20T01:00:00Z",
  type: "Friend",
  userId: "usr_one",
  displayName: "One",
  friendNumber: null,
});
const createTable = () =>
  ref<FriendLogTable>({
    data: [],
    filters: [
      { prop: "type", value: [] },
      { prop: "displayName", value: "" },
      { prop: "type", value: false },
    ],
    pageSizeLinked: true,
    loading: false,
  });
beforeEach(() => {
  mocks.count.mockReset().mockResolvedValue(5);
  mocks.page.mockReset();
});

test("loads a first page, next cursor, and retains the filtered total", async () => {
  const table = createTable();
  const history = createFriendHistory(table);
  mocks.page.mockResolvedValueOnce([makeRow(9), makeRow(7)]).mockResolvedValueOnce([makeRow(5), makeRow(3)]);
  await history.load(0, 2);
  expect(table.value.data.map((row) => row.rowId)).toEqual([9, 7]);
  await history.load(1, 2);
  expect(mocks.page.mock.calls[1]).toEqual([2, 7, expect.objectContaining({ beforeDate: "2026-11-20T01:00:00Z" })]);
  expect(history.total.value).toBe(5);
  expect(mocks.count).toHaveBeenCalledTimes(1);
  expect(table.value.data.map((row) => row.rowId)).toEqual([5, 3]);
});

test("applies filters in the database and discards a superseded result", async () => {
  const table = createTable();
  const history = createFriendHistory(table);
  const old = Promise.withResolvers<FriendLogHistoryRow[]>();
  mocks.page.mockReturnValueOnce(old.promise).mockResolvedValueOnce([makeRow(4)]);
  const first = history.load(0, 2);
  await vi.waitFor(() => expect(mocks.page).toHaveBeenCalledOnce());
  const search = table.value.filters[1];
  const hidden = table.value.filters[2];
  if (search !== undefined) search.value = "Someone";
  if (hidden !== undefined) hidden.value = true;
  const second = history.load(0, 2, true);
  await second;
  old.resolve([makeRow(10)]);
  await first;
  expect(table.value.data.map((row) => row.rowId)).toEqual([4]);
  expect(mocks.count.mock.lastCall).toEqual([expect.objectContaining({ search: "someone", hideUnfriends: true, ascending: true })]);
  expect(table.value.loading).toBe(false);
});

test("retains the filtered count when pagination overlaps a pending count", async () => {
  const table = createTable();
  const history = createFriendHistory(table);
  const count = Promise.withResolvers<number>();
  mocks.count.mockReturnValueOnce(count.promise);
  mocks.page.mockResolvedValue([makeRow(9), makeRow(7)]);
  const first = history.load(0, 2);
  const second = history.load(0, 2);
  count.resolve(5);
  await Promise.all([first, second]);
  expect(mocks.count).toHaveBeenCalledTimes(1);
  expect(history.total.value).toBe(5);
  expect(table.value.data.map((row) => row.rowId)).toEqual([9, 7]);
});

test("jumps to an uncached page in one read and resumes using its cursor", async () => {
  const table = createTable();
  const history = createFriendHistory(table);
  mocks.count.mockResolvedValueOnce(100);
  mocks.page.mockResolvedValueOnce([makeRow(15), makeRow(12)]).mockResolvedValueOnce([makeRow(10), makeRow(9)]);
  await history.load(10, 2);
  expect(mocks.page).toHaveBeenCalledExactlyOnceWith(2, null, expect.objectContaining({ offset: 20 }));
  await history.load(11, 2);
  expect(mocks.page.mock.lastCall).toEqual([2, 12, expect.objectContaining({ offset: 0 })]);
});
