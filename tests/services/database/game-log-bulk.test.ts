import { DatabaseSync, type StatementSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { rows } = vi.hoisted(() => ({
  rows: vi.fn(async (call: Promise<string>): Promise<unknown> => {
    const parsed: unknown = JSON.parse(await call);
    return parsed;
  }),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({ sqliteService: { rows } }));

import { extractHeadStatements, extractStatements } from "../../../build-scripts/perf-database.ts";
import { addGamelogJoinLeaveBulk } from "../../../src/services/database/game-log-write.ts";

const first = {
  created_at: "2026-11-20T00:00:00.000Z",
  type: "OnPlayerLeft",
  displayName: "One",
  location: "wrld_1:1",
  userId: "usr_1",
  time: 7500,
};

const second = { ...first, displayName: "Two", userId: "usr_2", time: null };
const anonymous = { ...first, displayName: null, userId: null };
const values = (entry: Parameters<typeof addGamelogJoinLeaveBulk>[0][number]) => [
  entry.created_at,
  entry.type,
  entry.displayName,
  entry.location,
  entry.userId,
  entry.time,
];

describe("addGamelogJoinLeaveBulk", () => {
  const write = vi.fn((_entries: string) => Promise.resolve("[]"));

  beforeEach(() => {
    write.mockClear();
    rows.mockClear();
    vi.stubGlobal("DatabaseApi", { AddGamelogJoinLeaveBulk: write });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("skips an empty batch", async () => {
    expect(await addGamelogJoinLeaveBulk([])).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  test("uses one call and pairs returned ids with the original entries", async () => {
    const duplicate = { ...first, location: "wrld_2:2" };
    write.mockResolvedValueOnce(
      JSON.stringify([
        [53, ...values(second)],
        [52, ...values(first)],
      ])
    );

    expect(await addGamelogJoinLeaveBulk([first, duplicate, second])).toEqual([
      { ...first, rowId: 52 },
      { ...second, rowId: 53 },
    ]);
    expect(write).toHaveBeenCalledExactlyOnceWith(JSON.stringify([values(first), values(duplicate), values(second)]));
  });

  test("keeps identical inputs that SQLite accepts with a null key", async () => {
    write.mockResolvedValueOnce(
      JSON.stringify([
        [55, ...values(anonymous)],
        [54, ...values(anonymous)],
      ])
    );
    expect(await addGamelogJoinLeaveBulk([anonymous, anonymous])).toEqual([
      { ...anonymous, rowId: 54 },
      { ...anonymous, rowId: 55 },
    ]);
  });
});

describe("game-log bulk insert with SQLite", () => {
  const current = extractStatements("test").writes;
  const old = extractHeadStatements("test").writes.find(({ method }) => method === "AddGamelogJoinLeave")?.sql;
  const bulk = current.find(({ method }) => method === "AddGamelogJoinLeaveBulk")?.sql;
  const schema = current.find(({ sql }) => sql.startsWith("CREATE TABLE IF NOT EXISTS gamelog_join_leave "))?.sql;
  if (old === undefined || bulk === undefined || schema === undefined) {
    throw new Error("Missing game-log SQL");
  }
  const oldSql = old;

  let before: DatabaseSync;
  let after: DatabaseSync;
  const write = vi.fn((entries: string) => {
    const statement = after.prepare(bulk);
    statement.setReturnArrays(true);
    return Promise.resolve(JSON.stringify(statement.all({ entries })));
  });

  beforeEach(() => {
    before = new DatabaseSync(":memory:");
    after = new DatabaseSync(":memory:");
    before.exec(schema);
    after.exec(schema);
    write.mockClear();
    vi.stubGlobal("DatabaseApi", { AddGamelogJoinLeaveBulk: write });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    before.close();
    after.close();
  });

  function insertOne(statement: StatementSync, entry: Parameters<typeof addGamelogJoinLeaveBulk>[0][number]) {
    return statement.run({
      created_at: entry.created_at,
      type: entry.type,
      display_name: entry.displayName,
      location: entry.location,
      user_id: entry.userId,
      time: entry.time,
    });
  }

  async function compare(entries: Parameters<typeof addGamelogJoinLeaveBulk>[0]) {
    const statement = before.prepare(oldSql);
    before.exec("BEGIN");
    const expected = entries.flatMap((entry) => {
      const result = insertOne(statement, entry);
      return Number(result.changes) > 0 ? [{ ...entry, rowId: Number(result.lastInsertRowid) }] : [];
    });
    before.exec("COMMIT");

    expect(await addGamelogJoinLeaveBulk(entries)).toEqual(expected);
    const allRows = "SELECT * FROM gamelog_join_leave ORDER BY id";
    expect(after.prepare(allRows).all()).toEqual(before.prepare(allRows).all());
    expect(write).toHaveBeenCalledTimes(entries.length === 0 ? 0 : 1);
  }

  test("leaves the database empty for an empty batch", async () => {
    await compare([]);
  });

  test("ignores existing and in-batch conflicts and preserves rows with nullable keys", async () => {
    insertOne(before.prepare(old), first);
    insertOne(after.prepare(old), first);
    await compare([
      { ...first, time: 100 },
      second,
      { ...second, location: "wrld_other:1", userId: "usr_other" },
      { ...first, displayName: "¡Hola! 世界", time: 0.25, location: null },
      anonymous,
      anonymous,
    ]);
  });

  test("inserts more rows than the SQLite variable limit with one binding", async () => {
    const limit = after
      .prepare("PRAGMA compile_options")
      .all()
      .map((row) => row["compile_options"])
      .find((option) => typeof option === "string" && option.startsWith("MAX_VARIABLE_NUMBER="));
    const maxVariables = typeof limit === "string" ? Number(limit.split("=")[1]) : 32766;
    const entries = Array.from({ length: maxVariables + 1 }, (_, index) => ({ ...first, displayName: `Player ${index}` }));
    await compare(entries);
  });
});
