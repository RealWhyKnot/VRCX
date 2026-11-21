import { DatabaseSync } from "node:sqlite";

import { expect, test } from "vitest";

import { extractStatements } from "../../../build-scripts/perf-database.ts";

function gameLogSql(method: string): string {
  const sql = extractStatements("test").statements.find((statement) => statement.method === method)?.sql;
  if (sql === undefined) {
    throw new Error(method);
  }
  return sql;
}

test("finds the same instance activity by either timestamp", () => {
  using db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE gamelog_join_leave (
      id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, display_name TEXT, location TEXT, user_id TEXT, time INTEGER,
      UNIQUE(created_at, type, display_name)
    );
    INSERT INTO gamelog_join_leave (created_at, type, time) VALUES
      ('2026-03-01T00:00:00.000Z', 'OnPlayerLeft', 1000),
      ('2026-03-01T23:59:59.999Z', 'OnPlayerLeft', 1000),
      ('2026-03-02T00:00:00.000Z', 'OnPlayerLeft', 2000),
      ('2026-03-02T00:00:00.000Z', 'OnPlayerJoined', 1000),
      ('2026-03-02T00:00:00.000Z', 'OnPlayerLeft', -500),
      ('2026-03-02T00:00:01.000Z', 'OnPlayerLeft', NULL),
      ('2026-03-02T01:00:00+01:00', 'OnPlayerLeft', 2000),
      ('now', 'OnPlayerLeft', 1000),
      ('SubSecond', 'OnPlayerLeft', 1000);
  `);

  const startTime = "strftime('%Y-%m-%dT%H:%M:%SZ', created_at, '-' || (time * 1.0 / 1000) || ' seconds')";
  const before = db.prepare(`
    SELECT * FROM gamelog_join_leave
    WHERE type = 'OnPlayerLeft' AND (
      ${startTime} BETWEEN @utc_start_date AND @utc_end_date
      OR created_at BETWEEN @utc_start_date AND @utc_end_date
    )
  `);
  const after = db.prepare(gameLogSql("GetInstanceActivityRows"));
  const day = { utc_start_date: "2026-03-01T00:00:00.000Z", utc_end_date: "2026-03-01T23:59:59.999Z" };
  const allYears = { utc_start_date: "0001-01-01T00:00:00.000Z", utc_end_date: "9999-01-01T00:00:00.000Z" };

  const dayRows = after.all(day);
  expect(dayRows.map((row) => row["id"])).toEqual([1, 2, 3, 7]);
  expect(dayRows).toEqual(before.all(day));
  expect(after.all(allYears)).toEqual(before.all(allYears));
});

test("matches previous instances by either user field and keeps distinct location metadata", () => {
  using db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE gamelog_join_leave (id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, display_name TEXT, location TEXT, user_id TEXT, time INTEGER);
    CREATE TABLE gamelog_location (location TEXT, world_name TEXT, group_name TEXT);
    INSERT INTO gamelog_join_leave VALUES
      (1, '2026-03-01T00:00:00.000Z', 'OnPlayerLeft', 'Alice', 'wrld_a:1', 'usr_a', 1500),
      (2, '2026-03-01T00:02:00.000Z', 'OnPlayerLeft', 'Alice', 'wrld_a:1', '', 1000),
      (3, '2026-03-01T00:03:00.000Z', 'OnPlayerLeft', 'Bob', 'wrld_a:1', 'usr_b', 1000),
      (4, '2026-03-01T00:04:00.000Z', 'OnPlayerLeft', 'Alice', 'wrld_b:1', '', 0);
    INSERT INTO gamelog_location VALUES ('wrld_a:1', 'World A', 'Group A'), ('wrld_a:1', 'World A', 'Group A'), ('wrld_a:1', 'Second Name', NULL);
  `);

  const rows = db.prepare(gameLogSql("GetPreviousInstancesByUserId")).all({ userId: "usr_a", displayName: "Alice" });
  expect(rows.map((row) => row["id"])).toEqual([1, 1, 2, 2]);
  expect(rows.filter((row) => row["id"] === 1).map((row) => row["world_name"])).toEqual(expect.arrayContaining(["World A", "Second Name"]));
});
