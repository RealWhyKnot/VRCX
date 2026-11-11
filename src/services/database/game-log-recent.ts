import { cellNumber, cellText } from "./cells.ts";
import type { GameLogRow } from "./game-log-union.ts";
import { dbVars } from "./index.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

const MS_PER_DAY = 86400000;

function toLocationRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: "Location",
    location: cellText(row[2]),
    worldId: cellText(row[3]),
    worldName: cellText(row[4]),
    time: cellNumber(row[5]),
    groupName: cellText(row[6]),
  };
}

function toJoinLeaveRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: cellText(row[2]),
    displayName: cellText(row[3]),
    location: cellText(row[4]),
    userId: cellText(row[5]),
    time: cellNumber(row[6]),
  };
}

function toPortalSpawnRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: "PortalSpawn",
    displayName: cellText(row[2]),
    location: cellText(row[3]),
    userId: cellText(row[4]),
    instanceId: cellText(row[5]),
    worldName: cellText(row[6]),
  };
}

function toVideoPlayRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: "VideoPlay",
    videoUrl: cellText(row[2]),
    videoName: cellText(row[3]),
    videoId: cellText(row[4]),
    location: cellText(row[5]),
    displayName: cellText(row[6]),
    userId: cellText(row[7]),
  };
}

function toResourceLoadRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: cellText(row[3]),
    resourceUrl: cellText(row[2]),
    location: cellText(row[4]),
  };
}

function toEventRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: "Event",
    data: cellText(row[2]),
  };
}

function toExternalRow(row: DatabaseRow): GameLogRow {
  return {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: "External",
    message: cellText(row[2]),
    displayName: cellText(row[3]),
    userId: cellText(row[4]),
    location: cellText(row[5]),
  };
}

function compareByCreatedAt(a: GameLogRow, b: GameLogRow): number {
  const createdAtA = a.created_at ?? "";
  const createdAtB = b.created_at ?? "";
  if (createdAtA < createdAtB) {
    return -1;
  }
  if (createdAtA > createdAtB) {
    return 1;
  }
  return 0;
}

async function getGamelogDatabase(): Promise<GameLogRow[]> {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const dateOffset = date.toJSON();
  const limit = dbVars.maxTableSize;
  const [locations, joinLeaves, portalSpawns, videoPlays, resourceLoads, events, externals] = await Promise.all([
    sqliteService.rows(DatabaseApi.GetRecentGameLogLocations(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogJoinLeave(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogPortalSpawn(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogVideoPlay(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogResourceLoad(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogEvents(dateOffset, limit)),
    sqliteService.rows(DatabaseApi.GetRecentGameLogExternal(dateOffset, limit)),
  ]);
  const gamelogDatabase = [
    ...locations.map(toLocationRow),
    ...joinLeaves.map(toJoinLeaveRow),
    ...portalSpawns.map(toPortalSpawnRow),
    ...videoPlays.map(toVideoPlayRow),
    ...resourceLoads.map(toResourceLoadRow),
    ...events.map(toEventRow),
    ...externals.map(toExternalRow),
  ];
  gamelogDatabase.sort(compareByCreatedAt);
  if (gamelogDatabase.length > dbVars.maxTableSize) {
    gamelogDatabase.splice(0, gamelogDatabase.length - dbVars.maxTableSize);
  }
  return gamelogDatabase;
}

async function getLastDateGameLogDatabase(): Promise<string> {
  const date = new Date().toJSON();
  const dateOffset = new Date(Date.now() - MS_PER_DAY).toJSON();
  const latestRows = await Promise.all([
    sqliteService.rows(DatabaseApi.GetLatestGameLogLocationCreatedAt()),
    sqliteService.rows(DatabaseApi.GetLatestGameLogJoinLeaveCreatedAt()),
    sqliteService.rows(DatabaseApi.GetLatestGameLogPortalSpawnCreatedAt()),
    sqliteService.rows(DatabaseApi.GetLatestGameLogEventCreatedAt()),
    sqliteService.rows(DatabaseApi.GetLatestGameLogVideoPlayCreatedAt()),
    sqliteService.rows(DatabaseApi.GetLatestGameLogResourceLoadCreatedAt()),
  ]);
  const createdAts = latestRows
    .flat()
    .map((row) => cellText(row[0]))
    .filter((createdAt): createdAt is string => createdAt !== null)
    .sort();
  const newest = createdAts.at(-1);
  if (newest !== undefined && newest > dateOffset && newest < date) {
    return newest;
  }
  return date;
}

export { getGamelogDatabase, getLastDateGameLogDatabase };
