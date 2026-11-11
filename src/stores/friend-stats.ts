import { database } from "../services/database";
import type { FriendStoreContext } from "./friend-types";

type FriendStat = {
  userId: string;
  displayName: string | null;
  lastSeen: string;
  timeSpent: number;
  joinCount: number;
};

function lookupByDisplayName(map: ReadonlyMap<string, string>, displayName: string | null): string | undefined {
  return displayName === null ? undefined : map.get(displayName);
}

export async function getAllUserStats(ctx: FriendStoreContext): Promise<void> {
  const userIds: string[] = [];
  const displayNames: string[] = [];
  for (const friend of ctx.friends.values()) {
    userIds.push(friend.id);
    if (friend.ref?.displayName) {
      displayNames.push(friend.ref.displayName);
    }
  }
  if (!userIds.length) {
    return;
  }

  const requestId = ++ctx.requestIds.stats;

  const data = await database.getAllUserStats(userIds, displayNames);
  if (requestId !== ctx.requestIds.stats) {
    return;
  }

  const dataByDisplayName = new Map<string, string>();
  const friendsByDisplayName = new Map<string, string>();

  for (const row of data) {
    if (row.displayName && row.userId) {
      dataByDisplayName.set(row.displayName, row.userId);
    }
  }

  for (const friend of ctx.friends.values()) {
    if (friend.ref?.id && friend.ref.displayName) {
      friendsByDisplayName.set(friend.ref.displayName, friend.id);
    }
  }

  const friendListMap = new Map<string, FriendStat>();
  for (const item of data) {
    const lookedUpUserId = lookupByDisplayName(dataByDisplayName, item.displayName) ?? lookupByDisplayName(friendsByDisplayName, item.displayName);
    const userId = item.userId === "" ? lookedUpUserId : (item.userId ?? lookedUpUserId);
    if (!userId) {
      continue;
    }

    const friend = friendListMap.get(userId);
    if (!friend) {
      friendListMap.set(userId, {
        userId,
        displayName: item.displayName,
        lastSeen: item.lastSeen ?? "",
        timeSpent: item.timeSpent ?? 0,
        joinCount: item.joinCount ?? 0,
      });
      continue;
    }
    if (Date.parse(item.lastSeen ?? "") > Date.parse(friend.lastSeen)) {
      friend.lastSeen = item.lastSeen ?? "";
    }
    friend.timeSpent += item.timeSpent ?? 0;
    friend.joinCount += item.joinCount ?? 0;
    friend.displayName = item.displayName;
    friendListMap.set(userId, friend);
  }
  ctx.runInSortedFriendsBatch(() => {
    for (const item of friendListMap.values()) {
      const friend = ctx.friends.get(item.userId);
      if (friend?.ref) {
        friend.ref.$joinCount = item.joinCount;
        friend.ref.$lastSeen = item.lastSeen;
        friend.ref.$timeSpent = item.timeSpent;
        ctx.reindexSortedFriend(friend);
      }
    }
  });
}

export function updateFriendLastSeen(ctx: FriendStoreContext, userId: string, lastSeen: string | null): void {
  const friend = ctx.friends.get(userId);
  if (!friend?.ref || !lastSeen) {
    return;
  }
  friend.ref.$lastSeen = lastSeen;
  ctx.reindexSortedFriend(friend);
}

export async function getAllUserMutualCount(ctx: FriendStoreContext): Promise<void> {
  if (!ctx.friends.size) {
    return;
  }
  const requestId = ++ctx.requestIds.mutualCount;
  const mutualCountMap = await database.getMutualCountForAllUsers();
  if (requestId !== ctx.requestIds.mutualCount) {
    return;
  }
  ctx.runInSortedFriendsBatch(() => {
    for (const friend of ctx.friends.values()) {
      if (friend.ref) {
        friend.ref.$mutualCount = 0;
      }
    }
    for (const [userId, mutualCount] of mutualCountMap.entries()) {
      const friend = ctx.friends.get(userId);
      if (friend?.ref) {
        friend.ref.$mutualCount = mutualCount;
        ctx.reindexSortedFriend(friend);
      }
    }
  });
}

export async function getAllUserMutualOptedOut(ctx: FriendStoreContext): Promise<void> {
  if (!ctx.friends.size) {
    return;
  }
  const requestId = ++ctx.requestIds.mutualOptedOut;
  const metaMap = await database.getMutualGraphMeta();
  if (requestId !== ctx.requestIds.mutualOptedOut) {
    return;
  }
  ctx.runInSortedFriendsBatch(() => {
    for (const friend of ctx.friends.values()) {
      if (friend.ref) {
        friend.ref.$mutualOptedOut = false;
      }
    }
    for (const [userId, meta] of metaMap.entries()) {
      const friend = ctx.friends.get(userId);
      if (friend?.ref) {
        friend.ref.$mutualOptedOut = meta.optedOut;
      }
    }
  });
}
