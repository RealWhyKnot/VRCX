import { database } from "../../services/database";
import type { GameLogEntry, GameLogLocationEntry, SessionLocation } from "./types";

export type GameLogVideoPlayInput = {
  created_at: string;
  videoUrl: string | null;
  videoName: string | null;
  videoId: string | null;
  location: string | null;
  displayName: string | null;
  userId: string | null;
};

export type GameLogDatabase = {
  updateGamelogVideoPlayName(rowId: number, videoName: string | null): Promise<unknown>;
  addGamelogVideoPlayToDatabase(entry: GameLogVideoPlayInput): Promise<{ rowId: number } | undefined>;
  addGamelogLocationToDatabase(entry: GameLogLocationEntry): Promise<{ rowId: number } | undefined>;
  lookupGameLogDatabase(filters: string[], vipList: string[], maxEntries?: number): Promise<GameLogEntry[]>;
  searchGameLogDatabase(search: string, filters: string[], vipList: string[], maxEntries?: number): Promise<GameLogEntry[]>;
  getSessionsLocationSegments(beforeId: number | null, limit: number): Promise<SessionLocation[]>;
  getSessionsLocationSegmentsByAnchor(sinceDate: string, limit: number): Promise<SessionLocation[]>;
  getSessionsEventsForSegments(locationTags: string[], afterDate: string, beforeDate: string): Promise<GameLogEntry[]>;
};

type SessionLocationRow = Omit<SessionLocation, "id" | "created_at"> & { id: number | null; created_at: string | null };

function toGameLogEntry(row: { type: string | null; created_at: string | null }): GameLogEntry {
  return { ...row, type: row.type ?? "", created_at: row.created_at ?? "" };
}

function toSessionLocations(rows: SessionLocationRow[]): SessionLocation[] {
  return rows.flatMap((row) => (row.id === null ? [] : [{ ...row, id: row.id, created_at: row.created_at ?? "" }]));
}

export const gameLogDatabase: GameLogDatabase = {
  updateGamelogVideoPlayName: (rowId, videoName) => database.updateGamelogVideoPlayName(rowId, videoName),
  addGamelogVideoPlayToDatabase: (entry) => database.addGamelogVideoPlayToDatabase(entry),
  addGamelogLocationToDatabase: (entry) => database.addGamelogLocationToDatabase(entry),
  lookupGameLogDatabase: async (filters, vipList, maxEntries) => (await database.lookupGameLogDatabase(filters, vipList, maxEntries)).map(toGameLogEntry),
  searchGameLogDatabase: async (search, filters, vipList, maxEntries) =>
    (await database.searchGameLogDatabase(search, filters, vipList, maxEntries)).map(toGameLogEntry),
  getSessionsLocationSegments: async (beforeId, limit) => toSessionLocations(await database.getSessionsLocationSegments(beforeId, limit)),
  getSessionsLocationSegmentsByAnchor: async (sinceDate, limit) => toSessionLocations(await database.getSessionsLocationSegmentsByAnchor(sinceDate, limit)),
  getSessionsEventsForSegments: async (locationTags, afterDate, beforeDate) =>
    (await database.getSessionsEventsForSegments(locationTags, afterDate, beforeDate)).map(toGameLogEntry),
};
