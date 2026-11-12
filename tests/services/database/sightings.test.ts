import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(),
  add: vi.fn((..._args: unknown[]) => Promise.resolve("add")),
  list: vi.fn((_limit: number) => Promise.resolve("list")),
  unresolved: vi.fn((_retryFailedBefore: string, _limit: number) => Promise.resolve("unresolved")),
  owners: vi.fn((_limit: number) => Promise.resolve("owners")),
  save: vi.fn((..._args: string[]) => Promise.resolve("save")),
  summary: vi.fn((_id: string) => Promise.resolve("summary")),
  locationSummary: vi.fn((_location: string) => Promise.resolve("locationSummary")),
  worldSummary: vi.fn((_worldId: string) => Promise.resolve("worldSummary")),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));

import { sightings } from "../../../src/services/database/sightings.ts";

const responses = new Map<string, unknown[][]>();

describe("sightings", () => {
  beforeEach(() => {
    responses.clear();
    vi.stubGlobal("DatabaseApi", {
      AddInstanceSighting: mocks.add,
      GetInstanceSightings: mocks.list,
      GetUnresolvedSightingPictures: mocks.unresolved,
      GetPictureOwners: mocks.owners,
      SavePictureOwner: mocks.save,
      GetSightingSummary: mocks.summary,
      GetLocationSightingSummary: mocks.locationSummary,
      GetWorldSightingSummary: mocks.worldSummary,
    });
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
    mocks.run.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("writes a sighting with its people as parallel lists", async () => {
    await sightings.addInstanceSighting(
      {
        location: "wrld_a:85920",
        worldId: "wrld_a",
        worldName: "Miami Beach",
        creatorId: "usr_owner",
        creatorName: "Sheepa",
        userCount: 6,
        capacity: 60,
        people: [
          { userId: "usr_f", fileId: "file_f", displayName: "Amnesty", isFriend: true },
          { userId: "", fileId: "file_s", displayName: "", isFriend: false },
        ],
      },
      "2026-11-12T10:00:00.000Z"
    );
    expect(mocks.add).toHaveBeenCalledWith(
      "2026-11-12T10:00:00.000Z",
      "wrld_a:85920",
      "wrld_a",
      "Miami Beach",
      "usr_owner",
      "Sheepa",
      6,
      60,
      ["usr_f", ""],
      ["file_f", "file_s"],
      ["Amnesty", ""],
      ["1", "0"]
    );
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  test("reads sightings, splits the names and counts the people still unnamed", async () => {
    responses.set("list", [
      [7, "2026-11-12T10:00:00.000Z", "wrld_a:85920", "Miami Beach", "usr_owner", "Sheepa", 6, 60, "Amnesty\u001fBob", 5],
      [8, "2026-11-12T11:00:00.000Z", "wrld_b:1", null, null, null, null, null, null, null],
      [null, "2026-11-12T11:00:00.000Z", "wrld_b:1", "", "", "", 0, 0, "", 0],
      [9, "", "wrld_b:1", "", "", "", 0, 0, "", 0],
    ]);
    const rows = await sightings.getInstanceSightings();
    expect(mocks.list).toHaveBeenCalledWith(1000);
    expect(rows).toEqual([
      {
        id: "7",
        at: "2026-11-12T10:00:00.000Z",
        location: "wrld_a:85920",
        worldName: "Miami Beach",
        creatorId: "usr_owner",
        creatorName: "Sheepa",
        userCount: 6,
        capacity: 60,
        names: ["Amnesty", "Bob"],
        peopleCount: 5,
        unnamedCount: 3,
        search: "miami beach\nsheepa\namnesty\nbob",
      },
      {
        id: "8",
        at: "2026-11-12T11:00:00.000Z",
        location: "wrld_b:1",
        worldName: "",
        creatorId: "",
        creatorName: "",
        userCount: 0,
        capacity: 0,
        names: [],
        peopleCount: 0,
        unnamedCount: 0,
        search: "\n",
      },
    ]);
  });

  test("lists pictures that still need a name and drops empty cells", async () => {
    responses.set("unresolved", [["file_a"], [null], [""], ["file_b"]]);
    expect(await sightings.getUnresolvedSightingPictures("2026-11-11T10:00:00.000Z", 20)).toEqual(["file_a", "file_b"]);
    expect(mocks.unresolved).toHaveBeenCalledWith("2026-11-11T10:00:00.000Z", 20);
  });

  test("reads saved picture owners", async () => {
    responses.set("owners", [
      ["file_a", "user", "usr_a", "Ann"],
      ["file_b", "avatar", null, null],
      [null, "user", "usr_c", "Cy"],
    ]);
    expect(await sightings.getPictureOwners(2000)).toEqual([
      { fileId: "file_a", kind: "user", userId: "usr_a", displayName: "Ann" },
      { fileId: "file_b", kind: "avatar", userId: "", displayName: "" },
    ]);
  });

  test("saves a picture owner", async () => {
    await sightings.savePictureOwner("file_a", "user", "usr_a", "Ann", "2026-11-12T10:00:00.000Z");
    expect(mocks.save).toHaveBeenCalledWith("file_a", "user", "usr_a", "Ann", "2026-11-12T10:00:00.000Z");
  });

  test("reads where someone was last spotted and how often they hosted", async () => {
    responses.set("summary", [["2026-11-12T10:00:00.000Z", "wrld_a:85920", "Miami Beach", 3, "2026-11-11T10:00:00.000Z"]]);
    expect(await sightings.getSightingSummary("usr_a")).toEqual({
      spottedAt: "2026-11-12T10:00:00.000Z",
      spottedLocation: "wrld_a:85920",
      spottedWorldName: "Miami Beach",
      hostedCount: 3,
      lastHostedAt: "2026-11-11T10:00:00.000Z",
    });
    expect(mocks.summary).toHaveBeenCalledWith("usr_a");
  });

  test("falls back to empty summaries when nothing was seen", async () => {
    responses.set("summary", [[null, null, null, 0, null]]);
    expect(await sightings.getSightingSummary("usr_none")).toEqual({
      spottedAt: "",
      spottedLocation: "",
      spottedWorldName: "",
      hostedCount: 0,
      lastHostedAt: "",
    });
    expect(await sightings.getLocationSightingSummary("wrld_a:1")).toEqual({ count: 0, peakUsers: 0, capacity: 0, lastAt: "" });
    expect(await sightings.getWorldSightingSummary("wrld_a")).toEqual({ count: 0, typicalUsers: 0, peakUsers: 0, instanceCount: 0 });
  });

  test("reads instance and world crowd summaries", async () => {
    responses.set("locationSummary", [[2, 26, 40, "2026-11-12T10:00:00.000Z"]]);
    responses.set("worldSummary", [[5, 12, 26, 3]]);
    expect(await sightings.getLocationSightingSummary("wrld_a:85920")).toEqual({
      count: 2,
      peakUsers: 26,
      capacity: 40,
      lastAt: "2026-11-12T10:00:00.000Z",
    });
    expect(await sightings.getWorldSightingSummary("wrld_a")).toEqual({ count: 5, typicalUsers: 12, peakUsers: 26, instanceCount: 3 });
    expect(mocks.locationSummary).toHaveBeenCalledWith("wrld_a:85920");
    expect(mocks.worldSummary).toHaveBeenCalledWith("wrld_a");
  });
});
