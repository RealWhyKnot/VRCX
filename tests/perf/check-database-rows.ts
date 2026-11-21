import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

import { bindingsFor, extractHeadStatements, extractStatements, mainPrefix, sampleFor } from "../../build-scripts/perf-database.ts";

type Bindings = Record<string, SQLInputValue>;

function rows(statement: StatementSync, bindings: Bindings): string[] {
  statement.setReturnArrays(true);
  return statement
    .all(bindings)
    .map((row) => JSON.stringify(row))
    .sort();
}

function plan(db: DatabaseSync, sql: string, bindings: Bindings): string {
  return db
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(bindings)
    .map((row) => row["detail"])
    .join("; ");
}

function compare(reference: DatabaseSync, db: DatabaseSync): void {
  const countIndexes = (connection: DatabaseSync) =>
    connection
      .prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name IN ('idx_gamelog_jl_activity_start', 'idx_gamelog_jl_repeat_encounters')")
      .get()?.["count"];
  if (countIndexes(reference) !== 0 || countIndexes(db) !== 2) {
    throw new Error("Pass an unmigrated copy first and a copy with both performance indexes second");
  }

  const prefix = mainPrefix(db);
  if (prefix === "" || prefix !== mainPrefix(reference)) {
    throw new Error("The copies need the same account tables");
  }

  const before = extractHeadStatements(prefix).statements;
  const after = extractStatements(prefix).statements;
  const account = db.prepare(`SELECT user_id, display_name FROM "${prefix}_feed_online_offline" ORDER BY id DESC LIMIT 1`).get();
  const userId = account?.["user_id"] ?? null;
  const displayName = account?.["display_name"] ?? null;
  const dayMs = 24 * 60 * 60 * 1000;
  const latest = db.prepare("SELECT MAX(created_at) AS latest FROM gamelog_join_leave").get()?.["latest"];
  if (typeof latest !== "string") {
    throw new Error("The database copy needs game log data");
  }
  const end = Date.parse(latest);
  const date = (days: number) => new Date(end - days * dayMs).toISOString();
  const cases: Record<string, Bindings[]> = {
    GetOnPlayerLeftRowsWithTime: [{}],
    GetJoinLeaveTableSize: [{}],
    GetRepeatEncounters: [
      { selfId: userId, minPlaces: 3, limit: 500 },
      { selfId: "", minPlaces: 1, limit: 15 },
      { selfId: "", minPlaces: 5, limit: 1000 },
    ],
    GetInstanceActivityRows: [
      { utc_start_date: date(1), utc_end_date: date(0) },
      { utc_start_date: date(30), utc_end_date: date(0) },
      { utc_start_date: date(90), utc_end_date: date(89) },
      { utc_start_date: date(180), utc_end_date: date(90) },
    ],
    GetFriendGatherings: [1, 30, 90, 180].map((days) => ({ since: date(days) })),
    GetLastSeen: [{ userId, displayName, count: 50 }],
    GetNotifications: [{ maxEntries: 500 }],
    GetNotificationsV2: [{ maxEntries: 500 }],
    GetPreviousInstancesByUserId: [
      { userId, displayName },
      { userId, displayName: null },
      { userId: null, displayName },
      { userId: null, displayName: null },
    ],
  };
  const sample = sampleFor(db, prefix);
  const previousByMethod = Map.groupBy(before, (statement) => `${statement.file}/${statement.method}`);
  const checked = new Set<string>();
  for (const { file, method, sql } of after) {
    if (method === "GetFriendLogHistoryPage" || method === "GetLatestGameLogCreatedAts") {
      continue;
    }
    const previous = previousByMethod.get(`${file}/${method}`)?.shift()?.sql;
    if (previous === undefined) {
      throw new Error(`Missing HEAD SQL for ${method}`);
    }

    const defaults = bindingsFor(sql, sample, end);
    const previousDefaults = bindingsFor(previous, sample, end);
    const requests = cases[method];
    if (method === "GetRepeatEncounters") {
      const oldPlan = plan(reference, previous, previousDefaults);
      const newPlan = plan(db, sql, defaults);
      if (oldPlan === newPlan || !newPlan.includes("idx_gamelog_jl_repeat_encounters")) {
        throw new Error("Repeat encounters did not switch to the new index");
      }
    }
    if (requests === undefined && previous === sql) {
      try {
        if (plan(reference, previous, previousDefaults) === plan(db, sql, defaults)) {
          continue;
        }
      } catch {
        console.log(`${method}: skipped because SQLite could not compare its plans`);
        continue;
      }
    }

    const expected = reference.prepare(previous);
    const actual = db.prepare(sql);
    const pairs = requests?.map((bindings) => [bindings, bindings]) ?? [[previousDefaults, defaults]];
    for (const [index, [oldBindings, newBindings]] of pairs.entries()) {
      if (oldBindings === undefined || newBindings === undefined) {
        throw new Error(`Missing bindings for ${method}`);
      }
      const left = rows(expected, oldBindings);
      const right = rows(actual, newBindings);
      if (left.length !== right.length || left.some((value, row) => value !== right[row])) {
        throw new Error(`${method} case ${index + 1} differs (${left.length} vs ${right.length} rows)`);
      }
      console.log(`${method} case ${index + 1}: ${right.length} matching rows`);
    }
    checked.add(method);
  }

  for (const method of Object.keys(cases)) {
    if (!checked.has(method)) {
      throw new Error(`Missing current SQL for ${method}`);
    }
  }
}

const [beforePath, afterPath] = process.argv.slice(2);
if (beforePath === undefined || afterPath === undefined) {
  throw new Error("Usage: node tests/perf/check-database-rows.ts <unmigrated database copy> <migrated database copy>");
}
using before = new DatabaseSync(beforePath, { readOnly: true });
using after = new DatabaseSync(afterPath, { readOnly: true });
compare(before, after);
