import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(),
  add: vi.fn((..._args: unknown[]) => Promise.resolve("add")),
  list: vi.fn((_limit: number) => Promise.resolve("list")),
  unresolved: vi.fn((_retryFailedBefore: string, _limit: number) => Promise.resolve("unresolved")),
  owners: vi.fn((_limit: number) => Promise.resolve("owners")),
  save: vi.fn((..._args: string[]) => Promise.resolve("save")),
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
});
