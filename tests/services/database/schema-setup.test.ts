import { describe, expect, test, vi } from "vitest";

import { DATABASE_VERSION, isDatabaseUpgradeNeeded, prepareSchema } from "../../../src/services/database/schema-setup";

function fakeDatabase() {
  const calls: string[] = [];
  const record = (name: string) =>
    vi.fn(() => {
      calls.push(name);
      return Promise.resolve();
    });
  return {
    calls,
    initTables: record("initTables"),
    upgradeDatabaseVersion: record("upgradeDatabaseVersion"),
    vacuum: record("vacuum"),
    optimize: record("optimize"),
  };
}

describe("prepareSchema", () => {
  test("runs table setup and migrations on a database that is already current", async () => {
    const schemaDatabase = fakeDatabase();
    await prepareSchema(DATABASE_VERSION, schemaDatabase);
    expect(schemaDatabase.calls).toEqual(["initTables"]);
  });

  test("runs the full upgrade on an older database", async () => {
    const schemaDatabase = fakeDatabase();
    await prepareSchema(DATABASE_VERSION - 1, schemaDatabase);
    expect(schemaDatabase.calls).toEqual(["upgradeDatabaseVersion", "vacuum", "optimize"]);
  });

  test("runs the full upgrade on a new database", async () => {
    const schemaDatabase = fakeDatabase();
    await prepareSchema(0, schemaDatabase);
    expect(schemaDatabase.calls).toEqual(["upgradeDatabaseVersion", "vacuum", "optimize"]);
  });

  test("stops when a step fails", async () => {
    const schemaDatabase = fakeDatabase();
    schemaDatabase.initTables.mockRejectedValueOnce(new Error("locked"));
    await expect(prepareSchema(DATABASE_VERSION, schemaDatabase)).rejects.toThrow("locked");
  });
});

describe("isDatabaseUpgradeNeeded", () => {
  test("is true only below the current version", () => {
    expect(isDatabaseUpgradeNeeded(DATABASE_VERSION - 1)).toBe(true);
    expect(isDatabaseUpgradeNeeded(DATABASE_VERSION)).toBe(false);
    expect(isDatabaseUpgradeNeeded(DATABASE_VERSION + 1)).toBe(false);
  });
});
