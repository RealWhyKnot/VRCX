import { cellNumber, cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";
import { MAX_SIGHTING_ROWS, splitNames } from "../../shared/utils/instance-sightings.ts";
import type { PictureOwnerKind, Sighting, SightingRow } from "../../shared/utils/instance-sightings.ts";

type SavedPictureOwner = {
  fileId: string;
  kind: string;
  userId: string;
  displayName: string;
};

async function addInstanceSighting(sighting: Sighting, createdAt: string): Promise<void> {
  await sqliteService.run(
    DatabaseApi.AddInstanceSighting(
      createdAt,
      sighting.location,
      sighting.worldId,
      sighting.worldName,
      sighting.creatorId,
      sighting.creatorName,
      sighting.userCount,
      sighting.capacity,
      sighting.people.map((person) => person.userId),
      sighting.people.map((person) => person.fileId),
      sighting.people.map((person) => person.displayName),
      sighting.people.map((person) => (person.isFriend ? "1" : "0"))
    )
  );
}

async function getInstanceSightings(): Promise<SightingRow[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetInstanceSightings(MAX_SIGHTING_ROWS));
  const sightings: SightingRow[] = [];
  for (const row of rows) {
    const id = cellNumber(row[0]);
    const at = cellText(row[1]);
    const location = cellText(row[2]);
    if (id === null || !at || !location) {
      continue;
    }
    const worldName = cellText(row[3]) ?? "";
    const creatorName = cellText(row[5]) ?? "";
    const names = splitNames(cellText(row[8]) ?? "");
    const peopleCount = cellNumber(row[9]) ?? 0;
    sightings.push({
      id: String(id),
      at,
      location,
      worldName,
      creatorId: cellText(row[4]) ?? "",
      creatorName,
      userCount: cellNumber(row[6]) ?? 0,
      capacity: cellNumber(row[7]) ?? 0,
      names,
      peopleCount,
      unnamedCount: Math.max(0, peopleCount - names.length),
      search: [worldName, creatorName, ...names].join("\n").toLowerCase(),
    });
  }
  return sightings;
}

async function getUnresolvedSightingPictures(retryFailedBefore: string, limit: number): Promise<string[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetUnresolvedSightingPictures(retryFailedBefore, limit));
  const fileIds: string[] = [];
  for (const row of rows) {
    const fileId = cellText(row[0]);
    if (fileId) {
      fileIds.push(fileId);
    }
  }
  return fileIds;
}

async function getPictureOwners(limit: number): Promise<SavedPictureOwner[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetPictureOwners(limit));
  const owners: SavedPictureOwner[] = [];
  for (const row of rows) {
    const fileId = cellText(row[0]);
    const kind = cellText(row[1]);
    if (fileId && kind) {
      owners.push({ fileId, kind, userId: cellText(row[2]) ?? "", displayName: cellText(row[3]) ?? "" });
    }
  }
  return owners;
}

async function savePictureOwner(fileId: string, kind: PictureOwnerKind, userId: string, displayName: string, resolvedAt: string): Promise<void> {
  await sqliteService.run(DatabaseApi.SavePictureOwner(fileId, kind, userId, displayName, resolvedAt));
}

const sightings = {
  addInstanceSighting,
  getInstanceSightings,
  getUnresolvedSightingPictures,
  getPictureOwners,
  savePictureOwner,
};

export { sightings };
export type { SavedPictureOwner };
