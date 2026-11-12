import { describe, expect, test } from "vitest";

import type { KnownUser } from "../../../src/shared/utils/instance-faces";
import {
  MAX_SIGHTING_PEOPLE,
  buildSightingPeople,
  createSightingThrottle,
  filterSightings,
  isInstanceLocation,
  sightingSignature,
  splitNames,
  type Sighting,
  type SightingRow,
} from "../../../src/shared/utils/instance-sightings";

const MINUTE = 60 * 1000;

function icon(fileId: string): string {
  return `https://api.vrchat.cloud/api/1/file/${fileId}/1/file`;
}

function user(id: string, name: string, fileId: string, isFriend: boolean): KnownUser {
  return { id, name, iconUrl: fileId ? icon(fileId) : "", ownedIconUrls: [], location: "wrld_a:1", isFriend };
}

function sighting(location: string, ids: string[], creatorId = "usr_owner"): Sighting {
  return {
    location,
    worldId: "wrld_a",
    worldName: "Miami Beach",
    creatorId,
    creatorName: "",
    userCount: ids.length,
    capacity: 60,
    people: ids.map((id) => ({ userId: id, fileId: "", displayName: id, isFriend: false })),
  };
}

function row(id: string, worldName: string, creatorName: string, names: string[]): SightingRow {
  return {
    id,
    at: "2026-11-12T10:00:00.000Z",
    location: "wrld_a:1",
    worldName,
    creatorId: "usr_owner",
    creatorName,
    userCount: names.length,
    capacity: 60,
    names,
    peopleCount: names.length,
    unnamedCount: 0,
    search: [worldName, creatorName, ...names].join("\n").toLowerCase(),
  };
}

describe("isInstanceLocation", () => {
  test.each([
    ["wrld_a:85920~hidden(usr_1)", true],
    ["wrld_a", false],
    ["private", false],
    ["traveling", false],
    ["", false],
  ])("%s -> %s", (location, isInstance) => {
    expect(isInstanceLocation(location)).toBe(isInstance);
  });
});

describe("buildSightingPeople", () => {
  test("puts friends first, names known faces and keeps strangers by picture", () => {
    const known = user("usr_k", "Known", "file_k", false);
    const people = buildSightingPeople(
      [user("usr_f", "Friend", "file_f", true)],
      [icon("file_f"), icon("file_k"), icon("file_s"), "not a picture"],
      new Map([["file_k", known]])
    );
    expect(people).toEqual([
      { userId: "usr_f", fileId: "file_f", displayName: "Friend", isFriend: true },
      { userId: "usr_k", fileId: "file_k", displayName: "Known", isFriend: false },
      { userId: "", fileId: "file_s", displayName: "", isFriend: false },
    ]);
  });

  test("lists each person once", () => {
    const friend = user("usr_f", "Friend", "", true);
    const people = buildSightingPeople([friend, friend], [icon("file_s"), icon("file_s"), icon("file_g")], new Map([["file_g", friend]]));
    expect(people.map((person) => person.userId || person.fileId)).toEqual(["usr_f", "file_s"]);
  });

  test("stops at the limit when an instance lists thousands of pictures", () => {
    const urls = Array.from({ length: 5000 }, (_, position) => icon(`file_${String(position)}`));
    expect(buildSightingPeople([], urls, new Map())).toHaveLength(MAX_SIGHTING_PEOPLE);
  });
});

describe("sightingSignature", () => {
  test("ignores the order people are listed in", () => {
    expect(sightingSignature(sighting("wrld_a:1", ["usr_b", "usr_a"]))).toBe(sightingSignature(sighting("wrld_a:1", ["usr_a", "usr_b"])));
  });
});

describe("createSightingThrottle", () => {
  test("logs an instance once, again when its people change, and again after ten minutes", () => {
    const throttle = createSightingThrottle();
    const same = sighting("wrld_a:1", ["usr_a"]);
    expect(throttle.shouldLog(same, 0)).toBe(true);
    expect(throttle.shouldLog(same, 5 * MINUTE)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:1", ["usr_a", "usr_b"]), 30 * 1000)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:1", ["usr_a", "usr_b"]), 2 * MINUTE)).toBe(true);
    expect(throttle.shouldLog(sighting("wrld_a:1", ["usr_a", "usr_b"]), 11 * MINUTE)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:1", ["usr_a", "usr_b"]), 12 * MINUTE)).toBe(true);
  });

  test("tracks each instance on its own", () => {
    const throttle = createSightingThrottle();
    expect(throttle.shouldLog(sighting("wrld_a:1", ["usr_a"]), 0)).toBe(true);
    expect(throttle.shouldLog(sighting("wrld_a:2", ["usr_a"]), 0)).toBe(true);
  });

  test("skips places that are not instances and sightings with nothing to store", () => {
    const throttle = createSightingThrottle();
    expect(throttle.shouldLog(sighting("private", ["usr_a"]), 0)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:1", [], ""), 0)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:1", []), 0)).toBe(true);
  });

  test("keeps working after more instances than it remembers", () => {
    const throttle = createSightingThrottle();
    for (let position = 0; position < 2000; position += 1) {
      expect(throttle.shouldLog(sighting(`wrld_a:${String(position)}`, ["usr_a"]), 0)).toBe(true);
    }
    expect(throttle.shouldLog(sighting("wrld_a:1999", ["usr_a"]), 1000)).toBe(false);
    expect(throttle.shouldLog(sighting("wrld_a:0", ["usr_a"]), 1000)).toBe(true);
  });
});

describe("splitNames", () => {
  test("splits on the separator the query joins with", () => {
    expect(splitNames("Ann\u001fBob, Jr.\u001f\u001fCy")).toEqual(["Ann", "Bob, Jr.", "Cy"]);
    expect(splitNames("")).toEqual([]);
  });
});

describe("filterSightings", () => {
  const rows = [row("1", "Miami Beach", "Sheepa", ["Amnesty"]), row("2", "Black Cat", "", ["Ann", "Bob"])];

  test("matches world, creator and people without minding case", () => {
    expect(filterSightings(rows, " SHEEPA ").map((entry) => entry.id)).toEqual(["1"]);
    expect(filterSightings(rows, "black").map((entry) => entry.id)).toEqual(["2"]);
    expect(filterSightings(rows, "bob").map((entry) => entry.id)).toEqual(["2"]);
    expect(filterSightings(rows, "nobody")).toEqual([]);
  });

  test("returns everything for an empty search", () => {
    expect(filterSightings(rows, "   ")).toBe(rows);
  });
});
