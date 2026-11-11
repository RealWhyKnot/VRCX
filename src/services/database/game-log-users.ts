import { cellNumber, cellText } from "./cells.ts";
import { sumCells } from "./game-log-union.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

type GameLogUserRef = {
  id: string;
  displayName?: string | null;
};

type InstanceGroup = {
  created_at: string | null;
  location: string | null;
  time: number;
  worldName: string | null;
  groupName: string | null;
  events: (number | null)[];
  last_ts: number;
};

const GROUPING_TIME_TOLERANCE_MS = 60 * 60 * 1000;

async function getLastSeen(input: GameLogUserRef, isInCurrentWorld: boolean) {
  const rows = await sqliteService.rows(DatabaseApi.GetLastSeen(input.id, input.displayName ?? null, isInCurrentWorld ? 2 : 1));
  const row = rows.at(-1);
  const rowUserId = cellText(row?.[1]);
  return {
    created_at: cellText(row?.[0]) ?? "",
    userId: rowUserId === null || rowUserId === "" ? input.id : rowUserId,
  };
}

async function getJoinCount(input: GameLogUserRef) {
  const rows = await sqliteService.rows(DatabaseApi.GetJoinCount(input.id, input.displayName ?? null));
  return {
    joinCount: cellNumber(rows.at(-1)?.[0]) ?? 0,
    userId: input.id,
  };
}

async function getTimeSpent(input: GameLogUserRef) {
  const rows = await sqliteService.rows(DatabaseApi.GetTimeSpent(input.id, input.displayName ?? null));
  return {
    timeSpent: sumCells(rows, 0),
    userId: input.id,
  };
}

async function getUserStats(input: GameLogUserRef, isInCurrentWorld: boolean) {
  const rows = await sqliteService.rows(DatabaseApi.GetUserStats(input.id, input.displayName ?? null));
  let timeSpent = 0;
  let lastSeen = "";
  const instances = new Set<string | null>();
  const previousDisplayNames = new Map<string | null, string | null>();
  for (const [index, row] of rows.entries()) {
    timeSpent += cellNumber(row[2]) ?? 0;
    if (index === 0 || (isInCurrentWorld && index === 1)) {
      lastSeen = cellText(row[0]) ?? "";
    }
    instances.add(cellText(row[3]));
    const displayName = cellText(row[4]);
    if (input.displayName !== displayName) {
      previousDisplayNames.set(displayName, cellText(row[0]));
    }
  }
  instances.delete("");
  return {
    timeSpent,
    lastSeen,
    joinCount: instances.size,
    userId: input.id,
    previousDisplayNames,
  };
}

async function getAllUserStats(userIds: string[], displayNames: string[]) {
  if (userIds.length === 0 && displayNames.length === 0) {
    return [];
  }
  const rows = await sqliteService.rows(DatabaseApi.GetAllUserStats(userIds, displayNames));
  return rows.map((row) => ({
    lastSeen: cellText(row[0]),
    userId: cellText(row[1]),
    timeSpent: cellNumber(row[2]),
    joinCount: cellNumber(row[3]),
    displayName: cellText(row[4]),
  }));
}

async function getUserIdFromDisplayName(displayName: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetUserIdFromDisplayName(displayName));
  return cellText(rows.at(-1)?.[0]) ?? "";
}

async function getPreviousDisplayNamesByUserId(ref: GameLogUserRef) {
  const rows = await sqliteService.rows(DatabaseApi.GetPreviousDisplayNamesByUserId(ref.id));
  const data = new Map<string | null, string | null>();
  for (const row of rows) {
    const displayName = cellText(row[1]);
    if (ref.displayName !== displayName) {
      data.set(displayName, cellText(row[0]));
    }
  }
  return data;
}

function startsNewInstanceGroup(
  currentGroup: InstanceGroup | undefined,
  location: string | null,
  createdAtTs: number,
  prevEvent: string | null,
  eventType: string | null
): boolean {
  if (currentGroup === undefined) {
    return true;
  }
  if (currentGroup.location !== location) {
    return true;
  }
  const isGapTooLong = createdAtTs - currentGroup.last_ts > GROUPING_TIME_TOLERANCE_MS;
  return isGapTooLong && !(prevEvent === "OnPlayerJoined" && eventType === "OnPlayerLeft");
}

function groupPreviousInstances(rows: DatabaseRow[]): Set<InstanceGroup> {
  const data = new Set<InstanceGroup>();
  let currentGroup: InstanceGroup | undefined;
  let prevEvent: string | null = null;
  for (const row of rows) {
    const createdAt = cellText(row[0]);
    const createdAtTs = cellNumber(row[1]) ?? 0;
    const location = cellText(row[2]);
    const time = cellNumber(row[3]) ?? 0;
    const worldName = cellText(row[4]);
    const groupName = cellText(row[5]);
    const eventId = cellNumber(row[6]);
    const eventType = cellText(row[7]);
    if (startsNewInstanceGroup(currentGroup, location, createdAtTs, prevEvent, eventType)) {
      currentGroup = {
        created_at: createdAt,
        location,
        time,
        worldName,
        groupName,
        events: [eventId],
        last_ts: createdAtTs,
      };
      data.add(currentGroup);
    } else if (currentGroup !== undefined) {
      currentGroup.time += time;
      currentGroup.last_ts = createdAtTs;
      currentGroup.events.push(eventId);
    }
    prevEvent = eventType;
  }
  return data;
}

async function getPreviousInstancesByUserId(input: GameLogUserRef) {
  const rows = await sqliteService.rows(DatabaseApi.GetPreviousInstancesByUserId(input.id, input.displayName ?? null));
  return groupPreviousInstances(rows);
}

export {
  getAllUserStats,
  getJoinCount,
  getLastSeen,
  getPreviousDisplayNamesByUserId,
  getPreviousInstancesByUserId,
  getTimeSpent,
  getUserIdFromDisplayName,
  getUserStats,
};
export type { GameLogUserRef };
