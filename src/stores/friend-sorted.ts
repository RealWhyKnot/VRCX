import { shallowRef } from "vue";
import type { ShallowRef } from "vue";

import { getFriendsSortFunction } from "../shared/utils/friend";
import type { FriendContext } from "./friend-types";

export type SortedFriends = {
  list: ShallowRef<FriendContext[]>;
  reset: () => void;
  rebuild: () => void;
  runInBatch: <T>(fn: () => T) => T;
  remove: (id: string) => void;
  reindex: (input: string | FriendContext) => void;
};

export function createSortedFriends(friends: ReadonlyMap<string, FriendContext>, getSortMethods: () => readonly string[]): SortedFriends {
  const list = shallowRef<FriendContext[]>([]);
  let batchDepth = 0;
  let isRebuildPending = false;

  function getComparator(): (a: unknown, b: unknown) => number {
    return getFriendsSortFunction(getSortMethods());
  }

  function rebuild(): void {
    list.value = Array.from(friends.values()).sort(getComparator());
    isRebuildPending = false;
  }

  function reset(): void {
    list.value = [];
    isRebuildPending = false;
  }

  function beginBatch(): void {
    batchDepth += 1;
  }

  function endBatch(): void {
    if (batchDepth === 0) {
      return;
    }
    batchDepth -= 1;
    if (batchDepth === 0 && isRebuildPending) {
      rebuild();
    }
  }

  function runInBatch<T>(fn: () => T): T {
    beginBatch();
    try {
      return fn();
    } finally {
      endBatch();
    }
  }

  function remove(id: string): void {
    if (batchDepth > 0) {
      isRebuildPending = true;
      return;
    }
    const index = list.value.findIndex((friend) => friend.id === id);
    if (index === -1) {
      return;
    }
    const next = list.value.slice();
    next.splice(index, 1);
    list.value = next;
  }

  function reindex(input: string | FriendContext): void {
    const ctx = typeof input === "string" ? friends.get(input) : input;
    if (!ctx) {
      return;
    }
    if (batchDepth > 0) {
      isRebuildPending = true;
      return;
    }
    const compare = getComparator();
    const next = list.value.slice();
    const existingIndex = next.findIndex((friend) => friend.id === ctx.id);
    if (existingIndex !== -1) {
      next.splice(existingIndex, 1);
    }
    let low = 0;
    let high = next.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (compare(next[mid], ctx) <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    next.splice(low, 0, ctx);
    list.value = next;
  }

  return { list, reset, rebuild, runInBatch, remove, reindex };
}
