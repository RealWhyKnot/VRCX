import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn((call: Promise<unknown>) => call),
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
    userId: "usr_me",
  },
}));

import { gameLog } from "../../../src/services/database/game-log.ts";

function createBridge() {
  return {
    GetMyTopWorlds: vi.fn(() => Promise.resolve("[]")),
    GetAllUserStats: vi.fn(() => Promise.resolve("[]")),
    LookupGameLog: vi.fn(() => Promise.resolve("[]")),
    SearchGameLog: vi.fn(() => Promise.resolve("[]")),
    GetGameLogByLocation: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogLocations: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogJoinLeave: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogPortalSpawn: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogVideoPlay: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogResourceLoad: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogEvents: vi.fn(() => Promise.resolve("[]")),
    GetRecentGameLogExternal: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogLocationCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogJoinLeaveCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogPortalSpawnCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogEventCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogVideoPlayCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetLatestGameLogResourceLoadCreatedAt: vi.fn(() => Promise.resolve("[]")),
    GetSessionsLocationSegments: vi.fn(() => Promise.resolve("[]")),
    GetSessionsLocationSegmentsBefore: vi.fn(() => Promise.resolve("[]")),
    DeleteGameLogInstance: vi.fn(() => Promise.resolve()),
    DeleteGameLogEvent: vi.fn(() => Promise.resolve()),
  };
}

describe("gameLog.getMyTopWorlds", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("adds an exclude clause when a home world id is provided", async () => {
    mocks.rows.mockResolvedValueOnce([["wrld_1", "World One", 3, 9000]]);

    const result = await gameLog.getMyTopWorlds(30, 5, "time", "wrld_home");

    expect(result).toEqual([
      {
        worldId: "wrld_1",
        worldName: "World One",
        visitCount: 3,
        totalTime: 9000,
      },
    ]);
    expect(bridge.GetMyTopWorlds).toHaveBeenCalledTimes(1);
    expect(bridge.GetMyTopWorlds).toHaveBeenCalledWith(30, 5, "time", "wrld_home");
  });

  test("passes an empty exclude id and count sort when no home world is given", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    await gameLog.getMyTopWorlds(0, 5, "count");

    expect(bridge.GetMyTopWorlds).toHaveBeenCalledWith(0, 5, "count", "");
  });
});

describe("gameLog.getAllUserStats", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns an empty list without calling the bridge when there is nothing to look up", async () => {
    const result = await gameLog.getAllUserStats([], []);

    expect(result).toEqual([]);
    expect(bridge.GetAllUserStats).not.toHaveBeenCalled();
  });

  test("passes user ids and display names as plain arguments, without quoting them into SQL", async () => {
    mocks.rows.mockResolvedValueOnce([["2026-01-01T00:00:00.000Z", "usr_a", 60000, 2, "O'Brien", 9]]);

    const result = await gameLog.getAllUserStats(["usr_a"], ["O'Brien"]);

    expect(bridge.GetAllUserStats).toHaveBeenCalledWith(["usr_a"], ["O'Brien"]);
    expect(result).toEqual([
      {
        lastSeen: "2026-01-01T00:00:00.000Z",
        userId: "usr_a",
        timeSpent: 60000,
        joinCount: 2,
        displayName: "O'Brien",
      },
    ]);
  });
});

describe("gameLog.lookupGameLogDatabase", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("passes filters, vip ids and the entry limit, and maps an event row", async () => {
    mocks.rows.mockResolvedValueOnce([
      [7, "2026-01-01T00:00:00.000Z", "Event", null, null, null, null, null, null, null, null, null, null, null, null, null, "hello", null],
    ]);

    const result = await gameLog.lookupGameLogDatabase(["Event"], ["usr_vip"], 25);

    expect(bridge.LookupGameLog).toHaveBeenCalledWith(["Event"], ["usr_vip"], 25);
    expect(result).toEqual([{ rowId: 7, created_at: "2026-01-01T00:00:00.000Z", type: "Event", data: "hello" }]);
  });
});

describe("gameLog.searchGameLogDatabase", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends a world or group id to the location query with the current user and search table size", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    await gameLog.searchGameLogDatabase("wrld_123", ["Location"], ["usr_vip"]);

    expect(bridge.SearchGameLog).not.toHaveBeenCalled();
    expect(bridge.GetGameLogByLocation).toHaveBeenCalledWith("wrld_123", ["Location"], ["usr_vip"], "usr_me", 5000);
  });

  test("sends free text, the current user and the given limit to the search query", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    await gameLog.searchGameLogDatabase("Alice", [], [], 50);

    expect(bridge.SearchGameLog).toHaveBeenCalledWith("Alice", [], [], "usr_me", 50);
  });
});

describe("gameLog.deleteGameLogInstance", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends the event ids as strings and leaves out missing ones", () => {
    gameLog.deleteGameLogInstance({
      id: "usr_a",
      displayName: "Alice",
      location: "wrld_1:12345",
      events: [4, null, 9],
    });

    expect(bridge.DeleteGameLogInstance).toHaveBeenCalledWith("usr_a", "Alice", "wrld_1:12345", ["4", "9"]);
  });
});

describe("gameLog.deleteGameLogEntry", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("routes an event row to the event delete with its created_at and data", () => {
    gameLog.deleteGameLogEntry({ type: "Event", created_at: "2026-01-01T00:00:00.000Z", data: "hello" });

    expect(bridge.DeleteGameLogEvent).toHaveBeenCalledWith("2026-01-01T00:00:00.000Z", "hello");
  });
});

describe("gameLog.getGamelogDatabase", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads every table with the same day offset and row limit, then sorts the rows by created_at", async () => {
    mocks.rows
      .mockResolvedValueOnce([[2, "2026-01-02T00:00:00.000Z", "wrld_1", "wrld_1", "World", 10, "grp"]])
      .mockResolvedValueOnce([[3, "2026-01-01T00:00:00.000Z", "OnPlayerJoined", "Alice", "wrld_1:1", "usr_a", 0]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await gameLog.getGamelogDatabase();

    expect(bridge.GetRecentGameLogLocations).toHaveBeenCalledWith(expect.any(String), 500);
    expect(bridge.GetRecentGameLogExternal).toHaveBeenCalledWith(expect.any(String), 500);
    expect(result.map((entry) => entry.created_at)).toEqual(["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"]);
    expect(result[0]).toMatchObject({ rowId: 3, type: "OnPlayerJoined", displayName: "Alice", userId: "usr_a" });
  });
});

describe("gameLog.getSessionsLocationSegments", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the newest segments when there is no cursor, and older ones after a cursor id", async () => {
    mocks.rows.mockResolvedValue([]);

    await gameLog.getSessionsLocationSegments(null, 20);
    await gameLog.getSessionsLocationSegments(42, 20);

    expect(bridge.GetSessionsLocationSegments).toHaveBeenCalledWith(20);
    expect(bridge.GetSessionsLocationSegmentsBefore).toHaveBeenCalledWith(42, 20);
  });
});
