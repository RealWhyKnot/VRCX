import { describe, expect, test } from "vitest";

import {
  DISCOVER_MAX_OCCUPANTS,
  buildDiscoverQuery,
  clampOccupants,
  createDiscoverFilters,
  filterDiscovered,
  parseDiscovery,
  toDiscoveredInstance,
} from "../../../src/shared/utils/instance-discovery";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    worldId: "wrld_1",
    instanceId: "12345~region(eu)",
    location: "wrld_1:12345~region(eu)",
    shortName: "abcd",
    userCount: 12,
    capacity: 40,
    region: "eu",
    type: "public",
    world: { id: "wrld_1", name: "Rooftop", authorName: "Mika", thumbnailImageUrl: "https://example.test/t.png", capacity: 80 },
    ...overrides,
  };
}

describe("buildDiscoverQuery", () => {
  test("sends only page size and mode for untouched filters", () => {
    expect(buildDiscoverQuery(createDiscoverFilters())).toBe("n=50&mode=active");
  });

  test("repeats the vibe key and stops at three", () => {
    const filters = { ...createDiscoverFilters(), vibeIds: ["a", "b", "c", "d"] };
    const query = new URLSearchParams(buildDiscoverQuery(filters));
    expect(query.getAll("vibe")).toEqual(["a", "b", "c"]);
  });

  test("adds every chosen filter", () => {
    const query = new URLSearchParams(
      buildDiscoverQuery({
        region: "jp",
        platform: "android",
        categoryId: "cat_1",
        vibeIds: [],
        mode: "population",
        minOccupants: 9000,
        isGroupHosted: true,
        isTrendingOnly: true,
      })
    );
    expect(Object.fromEntries(query.entries())).toEqual({
      n: "50",
      mode: "population",
      region: "jp",
      platform: "android",
      category: "cat_1",
      minOccupants: String(DISCOVER_MAX_OCCUPANTS),
      groupHosted: "true",
      worldPool: "trending",
    });
  });
});

describe("clampOccupants", () => {
  test.each([
    ["", 0],
    ["abc", 0],
    [-5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    ["12.9", 12],
    [1e12, DISCOVER_MAX_OCCUPANTS],
    [null, 0],
  ])("%s becomes %s", (input, expected) => {
    expect(clampOccupants(input)).toBe(expected);
  });
});

describe("toDiscoveredInstance", () => {
  test("reads the instance and its world", () => {
    expect(toDiscoveredInstance(row({ friendIcons: ["a", "b"], vibeIds: ["v1", 7], queueSize: 3 }))).toMatchObject({
      location: "wrld_1:12345~region(eu)",
      worldName: "Rooftop",
      worldAuthorName: "Mika",
      worldImageUrl: "https://example.test/t.png",
      userCount: 12,
      capacity: 40,
      queueSize: 3,
      friendCount: 2,
      isFull: false,
      region: "eu",
      accessType: "public",
      vibeIds: ["v1"],
    });
  });

  test("builds the location when the server leaves it out", () => {
    expect(toDiscoveredInstance(row({ location: undefined }))?.location).toBe("wrld_1:12345~region(eu)");
  });

  test("marks an instance at capacity as full", () => {
    expect(toDiscoveredInstance(row({ userCount: 40 }))?.isFull).toBe(true);
    expect(toDiscoveredInstance(row({ full: true }))?.isFull).toBe(true);
  });

  test("falls back to the world id when the world has no name", () => {
    expect(toDiscoveredInstance(row({ world: {} }))?.worldName).toBe("wrld_1");
  });

  test.each([[null], ["text"], [[]], [{}], [{ instanceId: "1" }]])("rejects %j", (input) => {
    expect(toDiscoveredInstance(input)).toBeUndefined();
  });

  test("turns bad numbers into zero", () => {
    const instance = toDiscoveredInstance(row({ userCount: "many", capacity: -3, world: { name: "X" }, queueSize: Number.NaN }));
    expect(instance).toMatchObject({ userCount: 0, capacity: 0, queueSize: 0, isFull: false });
  });
});

describe("parseDiscovery", () => {
  test("accepts the discover envelope and a bare list", () => {
    expect(parseDiscovery({ attributionId: "x", instances: [row()] })).toHaveLength(1);
    expect(parseDiscovery([row()])).toHaveLength(1);
  });

  test("drops repeats and unreadable rows", () => {
    const parsed = parseDiscovery([row(), row(), null, { nope: true }, row({ location: "wrld_1:2", instanceId: "2" })]);
    expect(parsed.map((instance) => instance.location)).toEqual(["wrld_1:12345~region(eu)", "wrld_1:2"]);
  });

  test.each([[null], [undefined], ["text"], [{ instances: "no" }], [{}]])("returns nothing for %j", (input) => {
    expect(parseDiscovery(input)).toEqual([]);
  });
});

describe("filterDiscovered", () => {
  const instances = parseDiscovery([
    row(),
    row({ location: "wrld_2:1", worldId: "wrld_2", instanceId: "1", ownerName: "Night Owls", world: { id: "wrld_2", name: "Cinema" } }),
  ]);

  test("keeps everything for a blank search", () => {
    expect(filterDiscovered(instances, "   ")).toHaveLength(2);
  });

  test("matches world, author and owner without case", () => {
    expect(filterDiscovered(instances, "ROOF").map((instance) => instance.worldId)).toEqual(["wrld_1"]);
    expect(filterDiscovered(instances, "mika").map((instance) => instance.worldId)).toEqual(["wrld_1"]);
    expect(filterDiscovered(instances, "owls").map((instance) => instance.worldId)).toEqual(["wrld_2"]);
  });

  test("handles a very long search string", () => {
    expect(filterDiscovered(instances, "x".repeat(100_000))).toEqual([]);
  });
});
