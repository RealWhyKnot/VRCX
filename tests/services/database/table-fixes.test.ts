import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(),
  getGameLogInstancesTime: vi.fn(),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));

vi.mock("../../../src/services/database/game-log.ts", () => ({
  gameLog: {
    getGameLogInstancesTime: mocks.getGameLogInstancesTime,
  },
}));

import { tableFixes } from "../../../src/services/database/table-fixes.ts";

const responses = new Map<string, unknown[][]>();

function createBridge() {
  return {
    GetTravelingLeaveRows: vi.fn(() => Promise.resolve("traveling")),
    GetLastOnPlayerJoinRows: vi.fn((displayName: string | null, createdAt: string | null) => Promise.resolve(`join:${displayName}:${createdAt}`)),
    SetJoinLeaveLocation: vi.fn((_id: number, _location: string | null) => Promise.resolve()),
    GetOnPlayerLeftRowsWithTime: vi.fn(() => Promise.resolve("left")),
    ResetLeaveTimes: vi.fn((_ids: string[]) => Promise.resolve()),
    GetBrokenGameLogDisplayNames: vi.fn(() => Promise.resolve("broken")),
    HasGameLogEntry: vi.fn((_createdAt: string | null, _type: string | null, displayName: string) => Promise.resolve(`has:${displayName}`)),
    DeleteGameLogEntry: vi.fn((_id: number) => Promise.resolve()),
    RenameGameLogEntry: vi.fn((_id: number, _displayName: string) => Promise.resolve()),
  };
}

let bridge: ReturnType<typeof createBridge>;

describe("tableFixes.fixGameLogTraveling", () => {
  beforeEach(() => {
    responses.clear();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
    mocks.run.mockImplementation(async (call: Promise<unknown>) => {
      await call;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
    mocks.run.mockReset();
  });

  test("moves a traveling leave to the location of the latest join before it", async () => {
    responses.set("traveling", [[7, "2024-05-01T10:00:00.000Z", "OnPlayerLeft", "Alice", "traveling", "usr_1", 0]]);
    responses.set("join:Alice:2024-05-01T10:00:00.000Z", [[3, "2024-05-01T09:00:00.000Z", "OnPlayerJoined", "Alice", "wrld_1:123", "usr_1", 0]]);

    await tableFixes.fixGameLogTraveling();

    expect(bridge.SetJoinLeaveLocation).toHaveBeenCalledTimes(1);
    expect(bridge.SetJoinLeaveLocation).toHaveBeenCalledWith(7, "wrld_1:123");
  });

  test("leaves a traveling leave alone when no earlier join exists", async () => {
    responses.set("traveling", [[8, "2024-05-01T10:00:00.000Z", "OnPlayerLeft", "Bob", "traveling", "usr_2", 0]]);

    await tableFixes.fixGameLogTraveling();

    expect(bridge.GetLastOnPlayerJoinRows).toHaveBeenCalledWith("Bob", "2024-05-01T10:00:00.000Z");
    expect(bridge.SetJoinLeaveLocation).not.toHaveBeenCalled();
  });
});

describe("tableFixes.fixBrokenLeaveEntries", () => {
  beforeEach(() => {
    responses.clear();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
    mocks.run.mockImplementation(async (call: Promise<unknown>) => {
      await call;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
    mocks.run.mockReset();
  });

  test("resets only the leave times longer than the instance total, as id strings", async () => {
    responses.set("left", [
      ["wrld_1:1", 150, 11],
      ["wrld_1:1", 40, 12],
      ["wrld_missing", 9, 13],
    ]);
    mocks.getGameLogInstancesTime.mockResolvedValue(new Map<unknown, unknown>([["wrld_1:1", 100]]));

    await tableFixes.fixBrokenLeaveEntries();

    expect(bridge.ResetLeaveTimes).toHaveBeenCalledWith(["11"]);
  });
});

describe("tableFixes.fixBrokenGameLogDisplayNames", () => {
  beforeEach(() => {
    responses.clear();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
    mocks.run.mockImplementation(async (call: Promise<unknown>) => {
      await call;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
    mocks.run.mockReset();
  });

  test("renames a display name with a suffix when no clean entry exists", async () => {
    responses.set("broken", [[4, "Alice (Bob)", "2024-01-01T00:00:00.000Z", "OnPlayerJoined"]]);

    await tableFixes.fixBrokenGameLogDisplayNames();

    expect(bridge.HasGameLogEntry).toHaveBeenCalledWith("2024-01-01T00:00:00.000Z", "OnPlayerJoined", "Alice");
    expect(bridge.RenameGameLogEntry).toHaveBeenCalledWith(4, "Alice");
    expect(bridge.DeleteGameLogEntry).not.toHaveBeenCalled();
  });

  test("deletes the suffixed entry when a clean entry already exists", async () => {
    responses.set("broken", [[4, "Alice (Bob)", "2024-01-01T00:00:00.000Z", "OnPlayerJoined"]]);
    responses.set("has:Alice", [[1]]);

    await tableFixes.fixBrokenGameLogDisplayNames();

    expect(bridge.DeleteGameLogEntry).toHaveBeenCalledWith(4);
    expect(bridge.RenameGameLogEntry).not.toHaveBeenCalled();
  });
});
