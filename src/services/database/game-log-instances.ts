import { cellNumber, cellText } from "./cells.ts";
import { sumCells } from "./game-log-union.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

type InstanceRecord = {
  created_at: string | null;
  location: string | null;
  time: number;
  worldName: string | null;
  groupName: string | null;
};

type PlayerSummary = {
  created_at: string | null;
  displayName: string | null;
  userId: string | null;
  time: number;
  count: number;
};

type PlayerDetail = {
  created_at: string | null;
  display_name: string | null;
  user_id: string | null;
  time: number;
};

function toInstanceMap(rows: DatabaseRow[]): Map<string | null, InstanceRecord> {
  const data = new Map<string | null, InstanceRecord>();
  for (const row of rows) {
    const location = cellText(row[1]);
    const ref = data.get(location);
    data.set(location, {
      created_at: cellText(row[0]),
      location,
      time: (cellNumber(row[2]) ?? 0) + (ref?.time ?? 0),
      worldName: cellText(row[3]),
      groupName: cellText(row[4]),
    });
  }
  return data;
}

async function getLastVisit(worldId: string, isCurrentWorldMatch: boolean) {
  const rows = await sqliteService.rows(DatabaseApi.GetLastVisit(worldId, isCurrentWorldMatch ? 2 : 1));
  const row = rows.at(-1);
  return {
    created_at: cellText(row?.[0]) ?? "",
    worldId: cellText(row?.[1]) ?? "",
  };
}

async function getVisitCount(worldId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetVisitCount(worldId));
  return {
    visitCount: cellNumber(rows.at(-1)?.[0]) ?? 0,
    worldId,
  };
}

async function getTimeSpentInWorld(worldId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetTimeSpentInWorld(worldId));
  return {
    timeSpent: sumCells(rows, 0),
    worldId,
  };
}

async function getLastGroupVisit(groupId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetLastGroupVisit(groupId));
  return {
    created_at: cellText(rows.at(-1)?.[0]) ?? "",
  };
}

async function getGroupJoinCount(groupId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetGroupJoinCount(groupId));
  return {
    joinCount: cellNumber(rows.at(-1)?.[0]) ?? 0,
    groupId,
  };
}

async function getPreviousInstancesByGroupId(groupId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetPreviousInstancesByGroupId(groupId));
  return toInstanceMap(rows);
}

async function getPreviousInstancesByWorldId(worldId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetPreviousInstancesByWorldId(worldId));
  return toInstanceMap(rows);
}

async function getGameLogWorldNameByWorldId(worldId: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetGameLogWorldName(worldId));
  return cellText(rows.at(-1)?.[0]) ?? "";
}

async function getGameLogInstancesTime() {
  const rows = await sqliteService.rows(DatabaseApi.GetGameLogInstancesTime());
  const instances = new Map<string | null, number>();
  for (const row of rows) {
    const location = cellText(row[0]);
    instances.set(location, (cellNumber(row[1]) ?? 0) + (instances.get(location) ?? 0));
  }
  return instances;
}

async function getPlayersFromInstance(location: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetPlayersFromInstance(location));
  const players = new Map<string | null, PlayerSummary>();
  for (const row of rows) {
    const displayName = cellText(row[1]);
    const ref = players.get(displayName);
    const isJoin = cellText(row[4]) === "OnPlayerJoined";
    players.set(displayName, {
      created_at: ref === undefined ? cellText(row[0]) : ref.created_at,
      displayName,
      userId: cellText(row[2]),
      time: (cellNumber(row[3]) ?? 0) + (ref?.time ?? 0),
      count: (ref?.count ?? 0) + (isJoin ? 1 : 0),
    });
  }
  return players;
}

async function getPlayerDetailFromInstance(location: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetPlayerDetailFromInstance(location));
  return rows.map((row): PlayerDetail => ({
    created_at: cellText(row[0]),
    display_name: cellText(row[1]),
    user_id: cellText(row[2]),
    time: cellNumber(row[3]) ?? 0,
  }));
}

export {
  getGameLogInstancesTime,
  getGameLogWorldNameByWorldId,
  getGroupJoinCount,
  getLastGroupVisit,
  getLastVisit,
  getPlayerDetailFromInstance,
  getPlayersFromInstance,
  getPreviousInstancesByGroupId,
  getPreviousInstancesByWorldId,
  getTimeSpentInWorld,
  getVisitCount,
};
