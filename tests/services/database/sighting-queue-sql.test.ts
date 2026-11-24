import { DatabaseSync } from "node:sqlite";

import { expect, test } from "vitest";

import { extractStatements } from "../../../build-scripts/perf-database.ts";

test("queues unknown pictures and failed pictures past their retry time", () => {
  using db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE test_instance_sighting_people (sighting_id INTEGER, user_id TEXT, file_id TEXT);
    CREATE TABLE picture_owners (file_id TEXT, kind TEXT, resolved_at TEXT);
    INSERT INTO test_instance_sighting_people VALUES
      (1, '', 'unknown'), (2, '', 'old-failure'), (3, '', 'recent-failure'),
      (4, '', 'resolved'), (5, 'user', 'already-identified'), (6, '', ''),
      (7, '', 'unknown');
    INSERT INTO picture_owners VALUES
      ('old-failure', 'failed', '2026-11-17'), ('recent-failure', 'failed', '2026-11-19'),
      ('resolved', 'user', '2026-11-17'), (NULL, 'user', '2026-11-17');
  `);
  const query = extractStatements("test").statements.find(({ method }) => method === "GetUnresolvedSightingPictures");
  if (query === undefined) {
    throw new Error("Missing picture queue SQL");
  }
  const result = db.prepare(query.sql).all({ retry_failed_before: "2026-11-18", limit: 20 });
  expect(result.map((row) => row["file_id"])).toEqual(["unknown", "old-failure"]);
});
