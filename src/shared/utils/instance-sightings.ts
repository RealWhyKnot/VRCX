import { extractFileId } from "./file-utils";
import type { KnownUser } from "./instance-faces";

const SIGHTING_REPEAT_MS = 10 * 60 * 1000;
const SIGHTING_MIN_GAP_MS = 60 * 1000;
const MAX_SIGHTING_PEOPLE = 80;
const MAX_TRACKED_LOCATIONS = 500;
const MAX_SIGHTING_ROWS = 1000;
const NAME_SEPARATOR = "\u001f";

type SightedPerson = {
  userId: string;
  fileId: string;
  displayName: string;
  isFriend: boolean;
};

type Sighting = {
  location: string;
  worldId: string;
  worldName: string;
  creatorId: string;
  creatorName: string;
  userCount: number;
  capacity: number;
  people: SightedPerson[];
};

type SightingRow = {
  id: string;
  at: string;
  location: string;
  worldName: string;
  creatorId: string;
  creatorName: string;
  userCount: number;
  capacity: number;
  names: string[];
  peopleCount: number;
  unnamedCount: number;
  search: string;
};

type PictureOwnerKind = "user" | "avatar" | "unknown" | "failed";

type SightingThrottle = {
  shouldLog: (sighting: Sighting, now: number) => boolean;
};

function isInstanceLocation(location: string): boolean {
  return location.startsWith("wrld_") && location.includes(":");
}

function buildSightingPeople(friendsHere: readonly KnownUser[], iconUrls: readonly string[], faceIndex: ReadonlyMap<string, KnownUser>): SightedPerson[] {
  const people: SightedPerson[] = [];
  const seenUsers = new Set<string>();
  const seenFiles = new Set<string>();
  const add = (person: SightedPerson) => {
    if (people.length >= MAX_SIGHTING_PEOPLE) {
      return;
    }
    if (person.userId ? seenUsers.has(person.userId) : seenFiles.has(person.fileId)) {
      return;
    }
    if (person.userId) {
      seenUsers.add(person.userId);
    }
    if (person.fileId) {
      seenFiles.add(person.fileId);
    }
    people.push(person);
  };
  for (const friend of friendsHere) {
    add({ userId: friend.id, fileId: extractFileId(friend.iconUrl), displayName: friend.name, isFriend: true });
  }
  for (const url of iconUrls) {
    const fileId = extractFileId(url);
    if (!fileId || seenFiles.has(fileId)) {
      continue;
    }
    const known = faceIndex.get(fileId);
    add(known ? { userId: known.id, fileId, displayName: known.name, isFriend: known.isFriend } : { userId: "", fileId, displayName: "", isFriend: false });
  }
  return people;
}

function sightingSignature(sighting: Sighting): string {
  return sighting.people
    .map((person) => person.userId || person.fileId)
    .sort()
    .join(",");
}

function createSightingThrottle(): SightingThrottle {
  const logged = new Map<string, { at: number; signature: string }>();
  return {
    shouldLog(sighting, now) {
      if (!isInstanceLocation(sighting.location)) {
        return false;
      }
      if (sighting.people.length === 0 && !sighting.creatorId) {
        return false;
      }
      const signature = sightingSignature(sighting);
      const previous = logged.get(sighting.location);
      if (previous) {
        const age = now - previous.at;
        if (age < SIGHTING_MIN_GAP_MS || (age < SIGHTING_REPEAT_MS && previous.signature === signature)) {
          return false;
        }
        logged.delete(sighting.location);
      }
      if (logged.size >= MAX_TRACKED_LOCATIONS) {
        for (const key of logged.keys()) {
          logged.delete(key);
          break;
        }
      }
      logged.set(sighting.location, { at: now, signature });
      return true;
    },
  };
}

function splitNames(joined: string): string[] {
  return joined ? joined.split(NAME_SEPARATOR).filter((name) => name.length > 0) : [];
}

function filterSightings(rows: SightingRow[], query: string): SightingRow[] {
  const needle = query.trim().toLowerCase();
  return needle ? rows.filter((row) => row.search.includes(needle)) : rows;
}

export {
  MAX_SIGHTING_PEOPLE,
  MAX_SIGHTING_ROWS,
  buildSightingPeople,
  createSightingThrottle,
  filterSightings,
  isInstanceLocation,
  sightingSignature,
  splitNames,
};
export type { PictureOwnerKind, SightedPerson, Sighting, SightingRow, SightingThrottle };
