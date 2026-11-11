import { cellNumber, cellText } from "./cells.ts";
import { dbVars } from "./index.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

type OnlineSession = {
  created_at: string | null;
  time: number;
};

type LocationSegment = {
  id: number | null;
  created_at: string | null;
  location: string | null;
  worldId: string | null;
  worldName: string | null;
  time: number | null;
  groupName: string | null;
};

type SessionJoinLeaveEvent = {
  type: string | null;
  created_at: string | null;
  displayName: string | null;
  userId: string | null;
  location: string | null;
};

type SessionVideoPlayEvent = {
  type: "VideoPlay";
  created_at: string | null;
  videoUrl: string | null;
  videoName: string | null;
  videoId: string | null;
  displayName: string | null;
  userId: string | null;
  location: string | null;
};

const MS_PER_DAY = 86400000;

function toOnlineSession(row: DatabaseRow): OnlineSession {
  return {
    created_at: cellText(row[0]),
    time: cellNumber(row[1]) ?? 0,
  };
}

function toLocationSegment(row: DatabaseRow): LocationSegment {
  return {
    id: cellNumber(row[0]),
    created_at: cellText(row[1]),
    location: cellText(row[2]),
    worldId: cellText(row[3]),
    worldName: cellText(row[4]),
    time: cellNumber(row[5]),
    groupName: cellText(row[6]),
  };
}

async function getCurrentUserOnlineSessions(fromDays = 0, toDays = 0) {
  const now = Date.now();
  const fromDate = fromDays > 0 ? new Date(now - fromDays * MS_PER_DAY).toISOString() : null;
  const toDate = toDays > 0 ? new Date(now - toDays * MS_PER_DAY).toISOString() : null;
  const priorRows = fromDate === null ? [] : await sqliteService.rows(DatabaseApi.GetLastOnlineSessionBefore(fromDate));
  const rows = await sqliteService.rows(DatabaseApi.GetOnlineSessions(fromDate, toDate));
  return [...priorRows.map(toOnlineSession), ...rows.map(toOnlineSession)];
}

async function getCurrentUserOnlineSessionsAfter(afterCreatedAt: string, isInclusive = false) {
  const rows = await sqliteService.rows(DatabaseApi.GetOnlineSessionsAfter(afterCreatedAt, isInclusive));
  return rows.map(toOnlineSession);
}

async function getMyTopWorlds(days = 0, limit = 5, sortBy = "time", excludeWorldId = "") {
  const rows = await sqliteService.rows(DatabaseApi.GetMyTopWorlds(days, limit, sortBy, excludeWorldId));
  return rows.map((row) => {
    const worldId = cellText(row[0]);
    const worldName = cellText(row[1]);
    return {
      worldId,
      worldName: worldName === null || worldName === "" ? worldId : worldName,
      visitCount: cellNumber(row[2]),
      totalTime: cellNumber(row[3]) ?? 0,
    };
  });
}

async function getSessionsLocationSegments(beforeId: number | null = null, limit: number) {
  const rows =
    beforeId === null
      ? await sqliteService.rows(DatabaseApi.GetSessionsLocationSegments(limit))
      : await sqliteService.rows(DatabaseApi.GetSessionsLocationSegmentsBefore(beforeId, limit));
  return rows.map(toLocationSegment);
}

async function getSessionsEventsForSegments(locationTags: string[], afterDate: string, beforeDate: string) {
  if (locationTags.length === 0) {
    return [];
  }
  const [joinLeaveRows, videoPlayRows] = await Promise.all([
    sqliteService.rows(DatabaseApi.GetSessionsJoinLeaveForLocations(locationTags, afterDate, beforeDate, dbVars.userId)),
    sqliteService.rows(DatabaseApi.GetSessionsVideoPlaysForLocations(locationTags, afterDate, beforeDate)),
  ]);
  const joinLeaveEvents = joinLeaveRows.map((row): SessionJoinLeaveEvent => ({
    type: cellText(row[0]),
    created_at: cellText(row[1]),
    displayName: cellText(row[2]),
    userId: cellText(row[3]),
    location: cellText(row[4]),
  }));
  const videoPlayEvents = videoPlayRows.map((row): SessionVideoPlayEvent => ({
    type: "VideoPlay",
    created_at: cellText(row[0]),
    videoUrl: cellText(row[1]),
    videoName: cellText(row[2]),
    videoId: cellText(row[3]),
    displayName: cellText(row[4]),
    userId: cellText(row[5]),
    location: cellText(row[6]),
  }));
  return [...joinLeaveEvents, ...videoPlayEvents];
}

async function getSessionsLocationSegmentsByAnchor(sinceDate: string, limit: number) {
  const rows = await sqliteService.rows(DatabaseApi.GetSessionsLocationSegmentsSince(sinceDate, limit));
  return rows.map(toLocationSegment);
}

export {
  getCurrentUserOnlineSessions,
  getCurrentUserOnlineSessionsAfter,
  getMyTopWorlds,
  getSessionsEventsForSegments,
  getSessionsLocationSegments,
  getSessionsLocationSegmentsByAnchor,
};
