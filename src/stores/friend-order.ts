import { configRepository } from "../services/config";
import { database } from "../services/database";
import { compareByCreatedAtAscending } from "../shared/utils/compare";
import type { FriendContext, FriendLogHistoryRow, FriendOrderBackup, FriendOrderEntry, FriendOrderUser, FriendStoreContext } from "./friend-types";
import { isFriendOrderBackups } from "./friend-types";

function lerp(a: number, b: number, alpha: number): number {
  return a + alpha * (b - a);
}

function parseLeadingNumber(text: string): number {
  const match = /^\d+(?:\.\d*)?(?:e[+-]?\d+)?/i.exec(text);
  return match ? Number(match[0]) : Number.NaN;
}

export function getFriendLogFriendOrder(rows: readonly FriendLogHistoryRow[]): FriendOrderEntry[] {
  const result: FriendOrderEntry[] = [];
  for (const ref of rows) {
    if (ref.type !== "Friend" || ref.userId === null) {
      continue;
    }
    if (result.some((x) => x.id === ref.userId)) {
      continue;
    }
    result.push({
      id: ref.userId,
      displayName: ref.displayName,
      created_at: ref.created_at,
    });
  }
  result.sort(compareByCreatedAtAscending);
  return result;
}

export function parseFriendOrderBackup(
  friendLogOrder: readonly FriendOrderEntry[],
  createdAt: string,
  backupUserIds: readonly string[],
  friends: ReadonlyMap<string, FriendContext>
): FriendOrderBackup {
  const backupTable: { id: string; displayName: string }[] = [];
  for (const userId of backupUserIds) {
    const ctx = friends.get(userId);
    if (ctx) {
      backupTable.push({
        id: ctx.id,
        displayName: ctx.name,
      });
    }
  }

  let maxMatches = 0;
  let currentMatches = 0;
  let backupIndex = 0;
  for (const ref of friendLogOrder) {
    if (backupIndex <= 0) {
      backupIndex = backupTable.findIndex((x) => x.id === ref.id);
      if (backupIndex !== -1) {
        currentMatches = 1;
      }
    } else if (backupTable[backupIndex]?.id === ref.id) {
      currentMatches++;
    } else {
      backupIndex = backupTable.findIndex((x) => x.id === ref.id);
      if (backupIndex !== -1) {
        currentMatches = 1;
      }
    }
    if (backupIndex === backupTable.length - 1) {
      backupIndex = 0;
    } else {
      backupIndex++;
    }
    if (currentMatches > maxMatches) {
      maxMatches = currentMatches;
    }
  }

  return {
    matches: parseLeadingNumber(`${maxMatches}.${createdAt}`),
    table: backupUserIds,
    isValid: maxMatches > lerp(4, 10, backupTable.length / 1000),
  };
}

export function setFriendNumber(ctx: FriendStoreContext, friendNumber: number, userId: string): void {
  const ref = ctx.friendLog.get(userId);
  if (!ref) {
    return;
  }
  ref.friendNumber = friendNumber;
  ctx.friendLog.set(ref.userId, ref);
  database.setFriendLogCurrent(ref);
  const friendRef = ctx.friends.get(userId);
  if (friendRef?.ref) {
    friendRef.ref.$friendNumber = friendNumber;
    ctx.reindexSortedFriend(friendRef);
  }
}

export async function tryApplyFriendOrder(ctx: FriendStoreContext, currentUser: FriendOrderUser): Promise<void> {
  const lastUpdate = await configRepository.getString(`VRCX_lastStoreTime_${currentUser.id}`);
  if (lastUpdate === "-5") {
    return;
  }

  ctx.state.friendNumber = 0;
  for (const ref of ctx.friendLog.values()) {
    ref.friendNumber = 0;
  }

  const friendOrder = currentUser.friends;
  ctx.runInSortedFriendsBatch(() => {
    for (const userId of friendOrder) {
      ctx.state.friendNumber++;
      setFriendNumber(ctx, ctx.state.friendNumber, userId);
    }
  });
  if (ctx.state.friendNumber === 0) {
    ctx.state.friendNumber = ctx.friends.size;
  }
  console.log("Applied friend order from API", ctx.state.friendNumber);
  await configRepository.setInt(`VRCX_friendNumber_${currentUser.id}`, ctx.state.friendNumber);
  await configRepository.setString(`VRCX_lastStoreTime_${currentUser.id}`, "-5");
}

export async function tryRestoreFriendNumber(ctx: FriendStoreContext, currentUser: FriendOrderUser): Promise<void> {
  const lastUpdate = await configRepository.getString(`VRCX_lastStoreTime_${currentUser.id}`);
  if (lastUpdate === "-4") {
    return;
  }
  ctx.state.friendNumber = 0;
  for (const ref of ctx.friendLog.values()) {
    ref.friendNumber = 0;
  }
  try {
    if (lastUpdate) {
      await restoreFriendNumber(ctx, currentUser);
    }

    applyFriendLogFriendOrderInReverse(ctx);
  } catch (err) {
    console.error(err);
  }

  await configRepository.setString(`VRCX_lastStoreTime_${currentUser.id}`, "-4");
}

export async function restoreFriendNumber(ctx: FriendStoreContext, currentUser: FriendOrderUser): Promise<boolean> {
  let storedData: unknown = null;
  try {
    const data = await configRepository.getString(`VRCX_friendOrder_${currentUser.id}`);
    if (data) {
      storedData = JSON.parse(data);
    }
  } catch (err) {
    console.error(err);
  }
  if (!isFriendOrderBackups(storedData)) {
    console.error("whomp whomp, no friend order backup found");
    return false;
  }

  const friendLogOrder = getFriendLogFriendOrder(ctx.friendLogTable.data);

  const machList: FriendOrderBackup[] = [];
  for (const [createdAt, backupUserIds] of Object.entries<string[]>(storedData)) {
    machList.push(parseFriendOrderBackup(friendLogOrder, createdAt, backupUserIds, ctx.friends));
  }
  machList.sort((a, b) => b.matches - a.matches);
  console.log(`friendLog: ${friendLogOrder.length} friendOrderBackups:`, machList);

  const bestBackup = machList[0];
  if (!bestBackup?.isValid) {
    console.error("whomp whomp, no valid backup found");
    return false;
  }

  applyFriendOrderBackup(ctx, bestBackup.table);
  applyFriendLogFriendOrder(ctx);
  await configRepository.setInt(`VRCX_friendNumber_${currentUser.id}`, ctx.state.friendNumber);
  return true;
}

export function applyFriendLogFriendOrderInReverse(ctx: FriendStoreContext): void {
  ctx.state.friendNumber = ctx.friends.size + 1;
  const friendLogOrder = getFriendLogFriendOrder(ctx.friendLogTable.data);
  for (const friendLogEntry of [...friendLogOrder].reverse()) {
    const ref = ctx.friendLog.get(friendLogEntry.id);
    if (!ref) {
      continue;
    }
    if (ref.friendNumber) {
      break;
    }
    const friendNumber = ctx.state.friendNumber - 1;
    ctx.state.friendNumber = friendNumber;
    ref.friendNumber = friendNumber;
    ctx.friendLog.set(ref.userId, ref);
    database.setFriendLogCurrent(ref);
    const friendRef = ctx.friends.get(friendLogEntry.id);
    if (friendRef?.ref) {
      friendRef.ref.$friendNumber = friendNumber;
    }
  }
  ctx.state.friendNumber = ctx.friends.size;
  console.log("Applied friend order from friendLog");
}

export function applyFriendOrderBackup(ctx: FriendStoreContext, userIdOrder: readonly string[]): void {
  for (const [i, userId] of userIdOrder.entries()) {
    const ctxFriend = ctx.friends.get(userId);
    const ref = ctxFriend?.ref;
    if (!ref || ref.$friendNumber) {
      continue;
    }
    const friendLogCurrent = {
      userId,
      displayName: ref.displayName,
      trustLevel: ref.$trustLevel,
      friendNumber: i + 1,
    };
    ctx.friendLog.set(userId, friendLogCurrent);
    database.setFriendLogCurrent(friendLogCurrent);
    ctx.state.friendNumber = i + 1;
  }
}

export function applyFriendLogFriendOrder(ctx: FriendStoreContext): void {
  const friendLogOrder = getFriendLogFriendOrder(ctx.friendLogTable.data);
  if (ctx.state.friendNumber === 0) {
    console.log("No backup applied, applying friend log in reverse");

    return;
  }
  for (const friendLogEntry of friendLogOrder) {
    const ref = ctx.friendLog.get(friendLogEntry.id);
    if (!ref || ref.friendNumber) {
      continue;
    }
    ctx.state.friendNumber++;
    const friendNumber = ctx.state.friendNumber;
    ref.friendNumber = friendNumber;
    ctx.friendLog.set(ref.userId, ref);
    database.setFriendLogCurrent(ref);
    const friendRef = ctx.friends.get(friendLogEntry.id);
    if (friendRef?.ref) {
      friendRef.ref.$friendNumber = friendNumber;
    }
  }
}
