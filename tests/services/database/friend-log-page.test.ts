import { DatabaseSync } from "node:sqlite";

import { expect, test } from "vitest";

import { extractStatements } from "../../../build-scripts/perf-database.ts";

test("pages friend history by descending row ID across gaps and new inserts", () => {
  using db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE test_friend_log_history (id INTEGER PRIMARY KEY); INSERT INTO test_friend_log_history VALUES (1), (4), (7), (8), (12)");
  const [first, next] = extractStatements("test").statements.filter(({ method }) => method === "GetFriendLogHistoryPage");
  if (first === undefined || next === undefined) {
    throw new Error("Missing friend log page SQL");
  }
  const initial = db.prepare(first.sql);
  const continuation = db.prepare(next.sql);
  expect(initial.all({ limit: 2 }).map(({ id }) => id)).toEqual([12, 8]);
  db.exec("INSERT INTO test_friend_log_history VALUES (13)");
  expect(continuation.all({ limit: 2, beforeId: 8 }).map(({ id }) => id)).toEqual([7, 4]);
  expect(continuation.all({ limit: 2, beforeId: 4 }).map(({ id }) => id)).toEqual([1]);
  expect(continuation.all({ limit: 2, beforeId: 1 })).toEqual([]);
});
