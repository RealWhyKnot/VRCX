import { beforeEach, describe, expect, test, vi } from "vitest";

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

import { moderation } from "../../../src/services/database/moderation.ts";

describe("moderation", () => {
  const bridge = {
    GetModeration: vi.fn(() => Promise.resolve("[]")),
    SetModeration: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge.SetModeration.mockClear();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  test("reads block and mute from the 1 and 0 flags", async () => {
    mocks.rows.mockResolvedValueOnce([["usr_a", "2026-01-01T00:00:00.000Z", "Name", 1, 0]]);

    expect(await moderation.getModeration("usr_a")).toEqual({
      userId: "usr_a",
      updatedAt: "2026-01-01T00:00:00.000Z",
      displayName: "Name",
      block: true,
      mute: false,
    });
  });

  test("returns an empty record when the user has no moderation row", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    expect(await moderation.getModeration("usr_a")).toEqual({});
  });

  test("passes the block and mute booleans to the bridge", () => {
    moderation.setModeration({ userId: "usr_a", updatedAt: "2026-01-01T00:00:00.000Z", displayName: "Name", block: false, mute: true });

    expect(bridge.SetModeration).toHaveBeenCalledWith("usr_a", "2026-01-01T00:00:00.000Z", "Name", false, true);
  });
});
