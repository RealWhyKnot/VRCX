import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));

import { avatarFavorites } from "../../../src/services/database/avatar-favorites.ts";

function createBridge() {
  return {
    AddAvatarToCache: vi.fn(() => Promise.resolve()),
    GetAvatarHistory: vi.fn(() => Promise.resolve("[]")),
    GetAvatarTimeSpent: vi.fn(() => Promise.resolve("[]")),
    GetAllAvatarTimeSpent: vi.fn(() => Promise.resolve("[]")),
    GetCachedAvatarById: vi.fn(() => Promise.resolve("[]")),
  };
}

describe("avatarFavorites", () => {
  let bridge: ReturnType<typeof createBridge>;

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge = createBridge();
    vi.stubGlobal("DatabaseApi", bridge);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("avatar history maps the joined cache columns and sends the current user and limit", async () => {
    mocks.rows.mockResolvedValueOnce([
      [
        "avtr_1",
        "2026-01-01T00:00:00.000Z",
        60000,
        "avtr_1",
        "2025-12-01T00:00:00.000Z",
        "usr_author",
        "Author",
        "2025-11-01T00:00:00.000Z",
        "Desc",
        "https://img",
        "Name",
        "public",
        "https://thumb",
        "2025-11-02T00:00:00.000Z",
        3,
      ],
    ]);

    const result = await avatarFavorites.getAvatarHistory("usr_me");

    expect(bridge.GetAvatarHistory).toHaveBeenCalledWith("usr_me", 100);
    expect(result).toEqual([
      {
        id: "avtr_1",
        authorId: "usr_author",
        authorName: "Author",
        created_at: "2025-11-01T00:00:00.000Z",
        description: "Desc",
        imageUrl: "https://img",
        name: "Name",
        releaseStatus: "public",
        thumbnailImageUrl: "https://thumb",
        updated_at: "2025-11-02T00:00:00.000Z",
        version: 3,
      },
    ]);
  });

  test("time spent for an avatar defaults to 0 when there is no history row", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    const result = await avatarFavorites.getAvatarTimeSpent("avtr_1");

    expect(result).toEqual({ timeSpent: 0, avatarId: "avtr_1" });
  });

  test("time spent map keeps a missing time as 0", async () => {
    mocks.rows.mockResolvedValueOnce([
      ["avtr_1", 120],
      ["avtr_2", null],
    ]);

    const result = await avatarFavorites.getAllAvatarTimeSpent();

    expect(result).toEqual(
      new Map<string | null, number>([
        ["avtr_1", 120],
        ["avtr_2", 0],
      ])
    );
  });

  test("cached avatar lookup returns null when the id is not cached", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    const result = await avatarFavorites.getCachedAvatarById("avtr_missing");

    expect(result).toBeNull();
    expect(bridge.GetCachedAvatarById).toHaveBeenCalledWith("avtr_missing");
  });

  test("adding to the cache stamps added_at from the clock and passes the version as a number", () => {
    avatarFavorites.addAvatarToCache({
      id: "avtr_1",
      authorId: "usr_author",
      authorName: "Author",
      created_at: null,
      description: null,
      imageUrl: null,
      name: "Name",
      releaseStatus: "public",
      thumbnailImageUrl: null,
      updated_at: null,
      version: 4,
    });

    expect(bridge.AddAvatarToCache).toHaveBeenCalledWith(
      "avtr_1",
      "2026-01-02T03:04:05.000Z",
      "usr_author",
      "Author",
      null,
      null,
      null,
      "Name",
      "public",
      null,
      null,
      4
    );
  });
});
