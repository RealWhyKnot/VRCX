import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
  },
}));

import { tableSize } from "../../../src/services/database/table-size.ts";

const responses = new Map<string, unknown[][]>();

describe("tableSize", () => {
  beforeEach(() => {
    responses.clear();
    vi.stubGlobal("DatabaseApi", {
      GetMaxFriendLogNumber: vi.fn(() => Promise.resolve("max")),
      GetGpsTableSize: vi.fn(() => Promise.resolve("gps")),
    });
    mocks.rows.mockImplementation(async (call: Promise<string>) => responses.get(await call) ?? []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.rows.mockReset();
  });

  test("keeps a null maximum friend log number when the table is empty", async () => {
    responses.set("max", [[null]]);

    await expect(tableSize.getMaxFriendLogNumber()).resolves.toBeNull();
  });

  test("returns the maximum friend log number when one is stored", async () => {
    responses.set("max", [[12]]);

    await expect(tableSize.getMaxFriendLogNumber()).resolves.toBe(12);
  });

  test("returns the row count of the gps table", async () => {
    responses.set("gps", [[42]]);

    await expect(tableSize.getGpsTableSize()).resolves.toBe(42);
  });

  test("returns zero when a count returns no row", async () => {
    await expect(tableSize.getGpsTableSize()).resolves.toBe(0);
  });
});
