import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

import { extractStatements, mainPrefix } from "../../build-scripts/perf-database.ts";

type Bindings = Record<string, SQLInputValue>;

const [beforePath, afterPath, sourceDir] = process.argv.slice(2);
if (beforePath === undefined || afterPath === undefined || sourceDir === undefined) {
  throw new Error("Usage: node tests/perf/check-startup-rows.ts <before copy> <after copy> <before C# source folder>");
}

using before = new DatabaseSync(beforePath, { readOnly: true });
using after = new DatabaseSync(afterPath, { readOnly: true });
const prefix = mainPrefix(before);
if (!prefix || prefix !== mainPrefix(after)) {
  throw new Error("The database copies need the same account");
}

const oldSql = extractStatements(prefix, sourceDir).statements;
const newSql = extractStatements(prefix).statements;

function arrays(statement: StatementSync, bindings: Bindings = {}): unknown[] {
  statement.setReturnArrays(true);
  return statement.all(bindings);
}

function compare(label: string, previous: unknown[], current: unknown[], ordered = true) {
  const encode = (rows: unknown[]) => JSON.stringify(ordered ? rows : rows.map((row) => JSON.stringify(row)).sort());
  if (encode(previous) !== encode(current)) {
    throw new Error(`${label} differs`);
  }
  console.log(`${label}: ${current.length} matching rows`);
}

const pairs: Record<string, Bindings[]> = {
  GetNotifications: [1, 25, 500, 100000].map((maxEntries) => ({ maxEntries })),
  GetGroupNotificationStats: [{}],
  GetUnresolvedSightingPictures: [
    { retry_failed_before: "2026-11-19T18:00:00.000Z", limit: 20 },
    { retry_failed_before: "1970-01-01T00:00:00.000Z", limit: 20 },
    { retry_failed_before: "2099-01-01T00:00:00.000Z", limit: 20 },
  ],
  GetFriendGatherings: ["2026-10-21T18:00:00.000Z", "2026-08-22T18:00:00.000Z"].map((since) => ({ since })),
  GetFriendPresenceSince: ["2026-10-21T18:00:00.000Z", "2026-08-22T18:00:00.000Z"].map((since) => ({ since })),
  GetBrokenGameLogDisplayNames: [{}],
};
for (const [method, requests] of Object.entries(pairs)) {
  const old = oldSql.find((query) => query.method === method);
  const current = newSql.find((query) => query.method === method);
  if (old === undefined || current === undefined) {
    throw new Error(`Missing SQL for ${method}`);
  }
  for (const [index, bindings] of requests.entries()) {
    compare(
      `${method} ${index + 1}`,
      arrays(before.prepare(old.sql), bindings),
      arrays(after.prepare(current.sql), bindings),
      method !== "GetFriendGatherings"
    );
  }
  const plan = after.prepare(`EXPLAIN QUERY PLAN ${current.sql}`).all(requests[0] ?? {});
  console.log(`  ${plan.map((row) => String(row["detail"]).replaceAll(prefix, "USER")).join("; ")}`);
}

function notificationLookup(dir: string): string {
  const text = readFileSync(join(dir, "DatabaseApi.Notifications.cs"), "utf8");
  const match = /public string LookupNotifications[\s\S]*?string sql = \$"""([\s\S]*?)"""/u.exec(text)?.[1];
  if (match === undefined) {
    throw new Error("Missing notification lookup SQL");
  }
  return match
    .replace('{UserTable("notifications")}', `${prefix}_notifications`)
    .replace("{vipQuery}", "")
    .replace("{filterQuery}", "AND type IN (@filter0, @filter1)");
}

const notificationBindings = { search: "%%", filter0: "friendRequest", filter1: "ignoredFriendRequest", maxEntries: 100000 };
const notificationOld = notificationLookup(sourceDir);
const notificationNew = notificationLookup(join(import.meta.dirname, "../../src/VRCX-Shared/Database"));
compare(
  "LookupNotifications friend requests",
  arrays(before.prepare(notificationOld), notificationBindings),
  arrays(after.prepare(notificationNew), notificationBindings)
);
console.log(
  after
    .prepare(`EXPLAIN QUERY PLAN ${notificationNew}`)
    .all(notificationBindings)
    .map((row) => String(row["detail"]).replaceAll(prefix, "USER"))
    .join("; ")
);

const oldLatest = ["Location", "JoinLeave", "PortalSpawn", "Event", "VideoPlay", "ResourceLoad"].flatMap((kind) => {
  const query = oldSql.find(({ method }) => method === `GetLatestGameLog${kind}CreatedAt`);
  if (query === undefined) {
    throw new Error(`Missing game log SQL for ${kind}`);
  }
  return arrays(before.prepare(query.sql));
});
const latest = newSql.find(({ method }) => method === "GetLatestGameLogCreatedAts");
if (latest === undefined) {
  throw new Error("Missing combined game log SQL");
}
compare("GetLatestGameLogCreatedAts", oldLatest, arrays(after.prepare(latest.sql)));

const history = oldSql.find(({ method }) => method === "GetFriendLogHistory");
const [first, next] = newSql.filter(({ method }) => method === "GetFriendLogHistoryPage");
if (history === undefined || first === undefined || next === undefined) {
  throw new Error("Missing friend log SQL");
}
const pageLimit = 50;
const pages: unknown[] = [];
let page = arrays(after.prepare(first.sql), { limit: pageLimit });
while (page.length > 0) {
  pages.push(...page);
  const last = page.at(-1);
  if (!Array.isArray(last) || typeof last[0] !== "number") {
    throw new Error("Invalid friend log cursor");
  }
  page = arrays(after.prepare(next.sql), { limit: pageLimit, beforeId: last[0] });
}
compare("Friend history streamed in pages of 50", arrays(before.prepare(history.sql)).reverse(), pages);
