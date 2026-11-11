import { cellNumber, cellText } from "./cells.ts";
import type { DatabaseRow } from "../sqlite.ts";

type GameLogRow = {
  rowId: number | null;
  created_at: string | null;
  type: string | null;
  location?: string | null;
  worldId?: string | null;
  worldName?: string | null;
  time?: number | null;
  groupName?: string | null;
  displayName?: string | null;
  userId?: string | null;
  videoUrl?: string | null;
  videoName?: string | null;
  videoId?: string | null;
  resourceUrl?: string | null;
  instanceId?: string | null;
  data?: string | null;
  message?: string | null;
};

function toGameLogRow(row: DatabaseRow): GameLogRow {
  const type = cellText(row[2]);
  const record: GameLogRow = {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type,
  };
  switch (type ?? "") {
    case "Location":
      record.location = cellText(row[4]);
      record.worldId = cellText(row[7]);
      record.worldName = cellText(row[8]);
      record.time = cellNumber(row[6]);
      record.groupName = cellText(row[9]);
      break;
    case "OnPlayerJoined":
    case "OnPlayerLeft":
      record.displayName = cellText(row[3]);
      record.location = cellText(row[4]);
      record.userId = cellText(row[5]);
      record.time = cellNumber(row[6]);
      break;
    case "PortalSpawn":
      record.displayName = cellText(row[3]);
      record.location = cellText(row[4]);
      record.userId = cellText(row[5]);
      record.instanceId = cellText(row[10]);
      record.worldName = cellText(row[8]);
      break;
    case "VideoPlay":
      record.videoUrl = cellText(row[11]);
      record.videoName = cellText(row[12]);
      record.videoId = cellText(row[13]);
      record.location = cellText(row[4]);
      record.displayName = cellText(row[3]);
      record.userId = cellText(row[5]);
      break;
    case "Event":
      record.data = cellText(row[16]);
      break;
    case "External":
      record.message = cellText(row[17]);
      record.displayName = cellText(row[3]);
      record.userId = cellText(row[5]);
      record.location = cellText(row[4]);
      break;
    case "StringLoad":
    case "ImageLoad":
      record.resourceUrl = cellText(row[14]);
      record.location = cellText(row[4]);
      break;
    default:
      break;
  }
  return record;
}

function sumCells(rows: DatabaseRow[], index: number): number {
  return rows.reduce((total, row) => total + (cellNumber(row[index]) ?? 0), 0);
}

export type { GameLogRow };
export { sumCells, toGameLogRow };
