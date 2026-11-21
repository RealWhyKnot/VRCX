import { ref } from "vue";
import type { Ref } from "vue";

import { database } from "../services/database";
import type { FriendLogHistoryOptions } from "../services/database/friend-log-history";
import type { FriendLogTable } from "./friend-types";

type Cursor = { id: number | null; date: string | null };

export function createFriendHistory(table: Ref<FriendLogTable>) {
  const total = ref(0);
  let version = 0;
  let query = "";
  let pageSize = 0;
  let countPromise: Promise<number> | undefined;
  const cursors = new Map<number, Cursor>([[0, { id: null, date: null }]]);

  function reset(): void {
    version += 1;
    query = "";
    countPromise = undefined;
    total.value = 0;
    cursors.clear();
    cursors.set(0, { id: null, date: null });
  }

  function options(isAscending: boolean): FriendLogHistoryOptions {
    const rawTypes = table.value.filters[0]?.value;
    const rawSearch = table.value.filters[1]?.value;
    return {
      types: Array.isArray(rawTypes) ? rawTypes.filter((value): value is string => typeof value === "string") : [],
      search: typeof rawSearch === "string" ? rawSearch.trim().toLowerCase() : "",
      hideUnfriends: table.value.filters[2]?.value === true,
      ascending: isAscending,
    };
  }

  async function load(page = 0, size = 50, isAscending = false, shouldRefresh = false): Promise<void> {
    const request = ++version;
    const filters = options(isAscending);
    const key = JSON.stringify(filters);
    const hasNewQuery = shouldRefresh || key !== query || size !== pageSize;
    if (hasNewQuery) {
      query = key;
      pageSize = size;
      cursors.clear();
      cursors.set(0, { id: null, date: null });
      countPromise = database.getFriendLogHistoryCount(filters);
    }
    table.value.loading = true;
    try {
      const pendingCount = countPromise;
      if (pendingCount !== undefined) {
        const count = await pendingCount;
        if (request !== version) return;
        total.value = count;
        if (countPromise === pendingCount) {
          countPromise = undefined;
        }
      }
      const target = Math.min(page, Math.max(0, Math.ceil(total.value / size) - 1));
      const cursor = cursors.get(target);
      const rows = await database.getFriendLogHistoryPage(size, cursor?.id ?? null, {
        ...filters,
        beforeDate: cursor?.date ?? null,
        offset: cursor === undefined ? target * size : 0,
      });
      if (request !== version) return;
      const last = rows.at(-1);
      if (last !== undefined) {
        cursors.set(target + 1, { id: last.rowId, date: last.created_at });
      }
      if (request === version) {
        table.value.data = rows;
      }
    } catch (error) {
      if (request === version) {
        query = "";
        countPromise = undefined;
      }
      throw error;
    } finally {
      if (request === version) {
        table.value.loading = false;
      }
    }
  }

  return { total, load, reset };
}
