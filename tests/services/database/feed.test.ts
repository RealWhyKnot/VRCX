import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(async (call: Promise<unknown>) => call),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));
vi.mock("../../../src/services/database/index.ts", () => ({
  dbVars: {
    maxTableSize: 500,
    searchTableSize: 5000,
  },
}));

import { feed } from "../../../src/services/database/feed.ts";

function stubDatabaseApi() {
  const api = {
    AddFeedGps: vi.fn(() => Promise.resolve(7)),
    AddFeedStatus: vi.fn(() => Promise.resolve(8)),
    AddFeedBio: vi.fn(() => Promise.resolve(9)),
    AddFeedAvatar: vi.fn(() => Promise.resolve(10)),
    AddFeedOnlineOffline: vi.fn(() => Promise.resolve(11)),
    DeleteAvatarFeedOlderThan: vi.fn(() => Promise.resolve(undefined)),
    DeleteAllAvatarFeed: vi.fn(() => Promise.resolve(undefined)),
    GetHotWorlds: vi.fn(() => Promise.resolve("[]")),
    GetHotWorldTrendBaseline: vi.fn(() => Promise.resolve("[]")),
    GetHotWorldTrendRecent: vi.fn(() => Promise.resolve("[]")),
    GetHotWorldFriendDetail: vi.fn(() => Promise.resolve("[]")),
    SearchFeed: vi.fn(() => Promise.resolve("[]")),
    LookupFeed: vi.fn(() => Promise.resolve("[]")),
    GetFeedByInstanceId: vi.fn(() => Promise.resolve("[]")),
  };
  vi.stubGlobal("DatabaseApi", api);
  return api;
}

function feedRow(overrides: [number, unknown][]): unknown[] {
  const cells: unknown[] = Array.from({ length: 24 }, () => null);
  for (const [index, value] of overrides) {
    cells[index] = value;
  }
  return cells;
}

describe("feed inserts", () => {
  let api: ReturnType<typeof stubDatabaseApi>;

  beforeEach(() => {
    api = stubDatabaseApi();
    mocks.run.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("addGPSToDatabase passes every field to AddFeedGps and returns the entry with its row id", async () => {
    const entry = {
      created_at: "2026-01-02T03:04:05.000Z",
      userId: "usr_1",
      displayName: "Alice",
      location: "wrld_1:123",
      worldName: "World",
      previousLocation: "wrld_0:1",
      time: 5000,
      groupName: null,
    };

    const result = await feed.addGPSToDatabase(entry);

    expect(api.AddFeedGps).toHaveBeenCalledWith("2026-01-02T03:04:05.000Z", "usr_1", "Alice", "wrld_1:123", "World", "wrld_0:1", 5000, null);
    expect(result).toEqual({ ...entry, rowId: 7 });
  });

  test("addGPSToDatabase returns undefined when the insert was ignored", async () => {
    api.AddFeedGps.mockResolvedValueOnce(0);
    const result = await feed.addGPSToDatabase({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      location: null,
      worldName: null,
      previousLocation: null,
      time: null,
      groupName: null,
    });
    expect(result).toBeUndefined();
  });

  test("addStatusToDatabase passes the status fields in order", async () => {
    await feed.addStatusToDatabase({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      status: "join me",
      statusDescription: "desc",
      previousStatus: "busy",
      previousStatusDescription: null,
    });
    expect(api.AddFeedStatus).toHaveBeenCalledWith("t", "usr_1", "Alice", "join me", "desc", "busy", null);
  });

  test("addBioToDatabase sends the bio links as JSON and empty arrays when they are missing", async () => {
    const result = await feed.addBioToDatabase({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      bio: "hello",
      previousBio: null,
      bioLinks: ["https://example.com"],
    });
    expect(api.AddFeedBio).toHaveBeenCalledWith("t", "usr_1", "Alice", "hello", null, '["https://example.com"]', "[]");
    expect(result).toEqual({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      bio: "hello",
      previousBio: null,
      bioLinks: ["https://example.com"],
      rowId: 9,
    });
  });

  test("addAvatarToDatabase passes the avatar fields in order", async () => {
    await feed.addAvatarToDatabase({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      ownerId: "usr_2",
      avatarName: "Avatar",
      currentAvatarImageUrl: "a",
      currentAvatarThumbnailImageUrl: "b",
      previousCurrentAvatarImageUrl: "c",
      previousCurrentAvatarThumbnailImageUrl: "d",
    });
    expect(api.AddFeedAvatar).toHaveBeenCalledWith("t", "usr_1", "Alice", "usr_2", "Avatar", "a", "b", "c", "d");
  });

  test("addOnlineOfflineToDatabase passes the online or offline type through", async () => {
    await feed.addOnlineOfflineToDatabase({
      created_at: "t",
      userId: "usr_1",
      displayName: "Alice",
      type: "Offline",
      location: "wrld_1:123",
      worldName: "World",
      time: 60,
      groupName: null,
    });
    expect(api.AddFeedOnlineOffline).toHaveBeenCalledWith("t", "usr_1", "Alice", "Offline", "wrld_1:123", "World", 60, null);
  });

  test("purgeAvatarFeedData deletes older rows when a cutoff is given", async () => {
    await feed.purgeAvatarFeedData("2026-01-01T00:00:00.000Z");
    expect(api.DeleteAvatarFeedOlderThan).toHaveBeenCalledWith("2026-01-01T00:00:00.000Z");
    expect(api.DeleteAllAvatarFeed).not.toHaveBeenCalled();
  });

  test("purgeAvatarFeedData deletes every row when there is no cutoff", async () => {
    await feed.purgeAvatarFeedData(null);
    expect(api.DeleteAllAvatarFeed).toHaveBeenCalledTimes(1);
    expect(api.DeleteAvatarFeedOlderThan).not.toHaveBeenCalled();
  });
});

describe("feed search and lookup", () => {
  let api: ReturnType<typeof stubDatabaseApi>;

  beforeEach(() => {
    api = stubDatabaseApi();
    mocks.rows.mockReset();
    mocks.rows.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("searchFeedDatabase uses the default limit and empty dates", async () => {
    await feed.searchFeedDatabase("Alice", [], []);
    expect(api.SearchFeed).toHaveBeenCalledWith("Alice", [], [], 5000, "", "");
  });

  test("searchFeedDatabase passes filters, vip ids, limit and dates through", async () => {
    await feed.searchFeedDatabase("Alice", ["GPS", "Avatar"], ["usr_2", "usr_3"], 200, "2026-01-01", "2026-02-01");
    expect(api.SearchFeed).toHaveBeenCalledWith("Alice", ["GPS", "Avatar"], ["usr_2", "usr_3"], 200, "2026-01-01", "2026-02-01");
  });

  test("searchFeedDatabase sends an instance search to GetFeedByInstanceId with the search table size", async () => {
    await feed.searchFeedDatabase("wrld_1:123", ["Online"], ["usr_2"], 200);
    expect(api.GetFeedByInstanceId).toHaveBeenCalledWith("wrld_1:123", ["Online"], ["usr_2"], 5000);
    expect(api.SearchFeed).not.toHaveBeenCalled();
  });

  test("getFeedByInstanceId passes the search table size", async () => {
    await feed.getFeedByInstanceId("grp_1", ["GPS"], []);
    expect(api.GetFeedByInstanceId).toHaveBeenCalledWith("grp_1", ["GPS"], [], 5000);
  });

  test("lookupFeedDatabase passes filters, vip ids and the max table size", async () => {
    await feed.lookupFeedDatabase(["Bio", "Status"], ["usr_2"]);
    expect(api.LookupFeed).toHaveBeenCalledWith(["Bio", "Status"], ["usr_2"], 500);
  });

  test("maps each feed row type to its record and keeps NULL cells as null", async () => {
    mocks.rows.mockResolvedValueOnce([
      feedRow([
        [0, 1],
        [1, "2026-01-01T00:00:00.000Z"],
        [2, "usr_1"],
        [3, "Alice"],
        [4, "GPS"],
        [5, "wrld_1:123"],
        [6, "World"],
        [7, "wrld_0:1"],
        [8, 5000],
        [9, "grp"],
      ]),
      feedRow([
        [0, 2],
        [1, "t"],
        [2, "usr_1"],
        [3, "Alice"],
        [4, "Status"],
        [10, "join me"],
        [11, null],
        [12, "busy"],
        [13, "old"],
      ]),
      feedRow([
        [0, 3],
        [1, "t"],
        [2, "usr_1"],
        [3, "Alice"],
        [4, "Bio"],
        [14, "hello"],
        [15, null],
        [22, '["https://example.com"]'],
        [23, "[]"],
      ]),
      feedRow([
        [0, 4],
        [1, "t"],
        [2, "usr_1"],
        [3, "Alice"],
        [4, "Avatar"],
        [16, "usr_2"],
        [17, "Avatar"],
        [18, "a"],
        [19, "b"],
        [20, null],
        [21, "d"],
      ]),
      feedRow([
        [0, 5],
        [1, "t"],
        [2, "usr_1"],
        [3, "Alice"],
        [4, "Online"],
        [5, "wrld_1:123"],
        [6, "World"],
        [8, 60],
        [9, null],
      ]),
    ]);

    const rows = await feed.searchFeedDatabase("Alice", [], []);

    expect(rows).toEqual([
      {
        rowId: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        userId: "usr_1",
        displayName: "Alice",
        type: "GPS",
        location: "wrld_1:123",
        worldName: "World",
        previousLocation: "wrld_0:1",
        time: 5000,
        groupName: "grp",
      },
      {
        rowId: 2,
        created_at: "t",
        userId: "usr_1",
        displayName: "Alice",
        type: "Status",
        status: "join me",
        statusDescription: null,
        previousStatus: "busy",
        previousStatusDescription: "old",
      },
      {
        rowId: 3,
        created_at: "t",
        userId: "usr_1",
        displayName: "Alice",
        type: "Bio",
        bio: "hello",
        previousBio: null,
        bioLinks: ["https://example.com"],
        previousBioLinks: [],
      },
      {
        rowId: 4,
        created_at: "t",
        userId: "usr_1",
        displayName: "Alice",
        type: "Avatar",
        ownerId: "usr_2",
        avatarName: "Avatar",
        currentAvatarImageUrl: "a",
        currentAvatarThumbnailImageUrl: "b",
        previousCurrentAvatarImageUrl: null,
        previousCurrentAvatarThumbnailImageUrl: "d",
      },
      {
        rowId: 5,
        created_at: "t",
        userId: "usr_1",
        displayName: "Alice",
        type: "Online",
        location: "wrld_1:123",
        worldName: "World",
        time: 60,
        groupName: null,
      },
    ]);
  });

  test("returns an empty list when the bridge returns no rows", async () => {
    mocks.rows.mockResolvedValueOnce([]);
    expect(await feed.lookupFeedDatabase([], [])).toEqual([]);
  });

  test("rejects a row whose type is not a feed type", async () => {
    mocks.rows.mockResolvedValueOnce([
      feedRow([
        [0, 1],
        [4, "Unknown"],
      ]),
    ]);
    await expect(feed.lookupFeedDatabase([], [])).rejects.toThrow("unknown type");
  });
});

describe("feed hot worlds", () => {
  let api: ReturnType<typeof stubDatabaseApi>;

  beforeEach(() => {
    api = stubDatabaseApi();
    mocks.rows.mockReset();
    mocks.rows.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("getHotWorlds reads the worlds and both trend windows and labels each world", async () => {
    mocks.rows
      .mockResolvedValueOnce([
        ["wrld_1", "One", 10, 4, "2026-01-05"],
        ["wrld_2", "Two", 5, 2, "2026-01-04"],
        ["wrld_3", "Three", 3, 1, "2026-01-03"],
      ])
      .mockResolvedValueOnce([
        ["wrld_1", 3],
        ["wrld_2", 2],
      ])
      .mockResolvedValueOnce([
        ["wrld_1", 1],
        ["wrld_2", 2],
        ["wrld_3", 1],
      ]);

    const worlds = await feed.getHotWorlds(14, 20);

    expect(api.GetHotWorlds).toHaveBeenCalledWith(14, 20);
    expect(api.GetHotWorldTrendBaseline).toHaveBeenCalledWith(14);
    expect(api.GetHotWorldTrendRecent).toHaveBeenCalledWith(14);
    expect(worlds.map((world) => [world.worldId, world.trend])).toEqual([
      ["wrld_1", "cooling"],
      ["wrld_2", "stable"],
      ["wrld_3", "rising"],
    ]);
    expect(worlds[0]).toEqual({
      worldId: "wrld_1",
      worldName: "One",
      visitCount: 10,
      uniqueFriends: 4,
      lastVisited: "2026-01-05",
      trend: "cooling",
    });
  });

  test("getHotWorlds uses the default 30 day window and limit", async () => {
    mocks.rows.mockResolvedValue([]);
    await feed.getHotWorlds();
    expect(api.GetHotWorlds).toHaveBeenCalledWith(30, 30);
  });

  test("getHotWorldFriendDetail passes the world id and days and maps each friend", async () => {
    mocks.rows.mockResolvedValueOnce([["usr_1", "Alice", 4, "2026-01-05"]]);

    const friends = await feed.getHotWorldFriendDetail("wrld_1", 7);

    expect(api.GetHotWorldFriendDetail).toHaveBeenCalledWith("wrld_1", 7);
    expect(friends).toEqual([{ userId: "usr_1", displayName: "Alice", visitCount: 4, lastVisit: "2026-01-05" }]);
  });
});
