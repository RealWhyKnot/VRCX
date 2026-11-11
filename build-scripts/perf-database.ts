import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

type Statement = { file: string; method: string; sql: string };

type Sample = { userId: string; location: string; worldId: string; avatarId: string };

type Result = {
  method: string;
  file: string;
  ms: number;
  cpuMs: number;
  rows: number;
  heapKb: number;
  plan: string;
  flags: string[];
};

type Failure = { method: string; file: string; reason: string };

const SOURCE_DIR = join(import.meta.dirname, "..", "src", "VRCX-Shared", "Database");
const RUNS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const USER_TABLE = /\{UserTable\("([a-z0-9_]+)"\)\}/gu;
const LOCAL_TABLE = /string (\w+) = UserTable\("([a-z0-9_]+)"\);/gu;
const METHOD = /public string (\w+)\(/gu;
const PARAMETER = /@\w+/gu;
const USER_PREFIX = /usr[0-9a-f]{32}/gu;

function readLiteral(source: string, start: number): string | undefined {
  let index = start;
  while (/\s/u.test(source[index] ?? "")) {
    index += 1;
  }
  const isInterpolated = source[index] === "$";
  if (isInterpolated) {
    index += 1;
  }
  if (source.startsWith('"""', index)) {
    const end = source.indexOf('"""', index + 3);
    return end === -1 ? undefined : source.slice(index + 3, end);
  }
  if (source[index] !== '"') {
    return undefined;
  }
  let text = "";
  for (let at = index + 1; at < source.length; at += 1) {
    const char = source[at];
    if (char === "\\") {
      text = `${text}${source[at + 1] ?? ""}`;
      at += 1;
    } else if (char === "{" && isInterpolated) {
      const end = source.indexOf("}", at);
      text = `${text}${source.slice(at, end + 1)}`;
      at = end;
    } else if (char === '"') {
      return text;
    } else {
      text = `${text}${char ?? ""}`;
    }
  }
  return undefined;
}

function methodBefore(source: string, position: number): string {
  let name = "unknown";
  for (const match of source.matchAll(METHOD)) {
    if (match.index > position) {
      break;
    }
    name = match[1] ?? name;
  }
  return name;
}

function extractStatements(prefix: string): { statements: Statement[]; dynamic: Failure[] } {
  const statements: Statement[] = [];
  const dynamic: Failure[] = [];
  for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".cs"))) {
    const source = readFileSync(join(SOURCE_DIR, file), "utf8");
    const locals = new Map<string, string>();
    for (const match of source.matchAll(LOCAL_TABLE)) {
      locals.set(match[1] ?? "", match[2] ?? "");
    }
    for (const match of source.matchAll(/\bRows\(/gu)) {
      const literal = readLiteral(source, match.index + match[0].length);
      const method = methodBefore(source, match.index);
      if (literal === undefined) {
        dynamic.push({ method, file, reason: "SQL is built at run time" });
        continue;
      }
      const sql = literal
        .replaceAll(USER_TABLE, (_, suffix: string) => `${prefix}_${suffix}`)
        .replaceAll(/\{(\w+)\}/gu, (whole: string, name: string) => {
          const suffix = locals.get(name);
          return suffix === undefined ? whole : `${prefix}_${suffix}`;
        });
      if (sql.includes("{")) {
        dynamic.push({ method, file, reason: "SQL has a part filled in at run time" });
      } else {
        statements.push({ file, method, sql: sql.replaceAll(/\s+/gu, " ").trim() });
      }
    }
  }
  return { statements, dynamic };
}

function firstText(db: DatabaseSync, sql: string): string {
  try {
    const row = db.prepare(sql).get();
    const value = row === undefined ? undefined : Object.values(row)[0];
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function mainPrefix(db: DatabaseSync): string {
  let best = "";
  let bestRows = -1;
  for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%\\_feed\\_gps' ESCAPE '\\'").all()) {
    const name = typeof row["name"] === "string" ? row["name"] : "";
    const count = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get()?.["n"];
    if (typeof count === "number" && count > bestRows) {
      bestRows = count;
      best = name.slice(0, -"_feed_gps".length);
    }
  }
  return best;
}

function bindingFor(name: string, sample: Sample, now: number): string | number {
  const key = name.toLowerCase();
  if (key.includes("half")) {
    return "-15 days";
  }
  if (key.includes("days")) {
    return "-30 days";
  }
  if (key.includes("limit")) {
    return 500;
  }
  if (key.includes("offset")) {
    return 0;
  }
  if (/search|query|like|filter/u.test(key)) {
    return "%an%";
  }
  if (key.includes("location")) {
    return sample.location;
  }
  if (key.includes("world")) {
    return sample.worldId;
  }
  if (key.includes("avatar")) {
    return sample.avatarId;
  }
  if (/user|friend|target|owner/u.test(key)) {
    return sample.userId;
  }
  if (/end|before|until|to$/u.test(key)) {
    return new Date(now).toISOString();
  }
  if (/start|after|since|from|date|created|cursor/u.test(key)) {
    return new Date(now - 30 * DAY_MS).toISOString();
  }
  return "";
}

function measure(db: DatabaseSync, statement: Statement, sample: Sample): Result {
  const now = Date.now();
  const names = [...new Set(statement.sql.match(PARAMETER) ?? [])];
  const bindings = Object.fromEntries(names.map((name) => [name, bindingFor(name.slice(1), sample, now)]));
  const plan = db
    .prepare(`EXPLAIN QUERY PLAN ${statement.sql}`)
    .all(bindings)
    .map((row) => (typeof row["detail"] === "string" ? row["detail"] : ""))
    .join("; ");
  const prepared = db.prepare(statement.sql);
  let ms = Number.POSITIVE_INFINITY;
  let cpuMs = 0;
  let rows = 0;
  let heapKb = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const heapBefore = process.memoryUsage().heapUsed;
    const cpuBefore = process.cpuUsage();
    const started = performance.now();
    const result = prepared.all(bindings);
    const elapsed = performance.now() - started;
    const cpu = process.cpuUsage(cpuBefore);
    rows = result.length;
    if (elapsed < ms) {
      ms = elapsed;
      cpuMs = (cpu.user + cpu.system) / 1000;
    }
    heapKb = Math.max(heapKb, (process.memoryUsage().heapUsed - heapBefore) / 1024);
  }
  const flags: string[] = [];
  if (/SCAN (?!.*USING (?:COVERING )?INDEX)/u.test(plan) || /SCAN \S+(?:;|$)/u.test(plan)) {
    flags.push("full scan");
  }
  if (plan.includes("TEMP B-TREE")) {
    flags.push("sorts in memory");
  }
  return { method: statement.method, file: statement.file, ms, cpuMs, rows, heapKb, plan, flags };
}

function mask(text: string): string {
  return text.replaceAll(USER_PREFIX, "USER");
}

function main(): void {
  const [path, jsonPath] = process.argv.slice(2);
  if (path === undefined) {
    console.error("Usage: node build-scripts/perf-database.ts <copy of VRCX.sqlite3> [report.json]");
    process.exitCode = 2;
    return;
  }
  const db = new DatabaseSync(path, { readOnly: true });
  const prefix = mainPrefix(db);
  if (prefix === "") {
    console.error("No account tables found in this database.");
    process.exitCode = 1;
    return;
  }
  const sample: Sample = {
    userId: firstText(db, `SELECT user_id FROM "${prefix}_feed_online_offline" ORDER BY id DESC LIMIT 1`),
    location: firstText(db, "SELECT location FROM gamelog_location ORDER BY id DESC LIMIT 1"),
    worldId: firstText(db, "SELECT world_id FROM gamelog_location ORDER BY id DESC LIMIT 1"),
    avatarId: firstText(db, "SELECT id FROM cache_avatar LIMIT 1"),
  };
  const { statements, dynamic } = extractStatements(prefix);
  const results: Result[] = [];
  const failures: Failure[] = [...dynamic];
  for (const statement of statements) {
    try {
      results.push(measure(db, statement, sample));
    } catch (err) {
      failures.push({ method: statement.method, file: statement.file, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  db.close();
  results.sort((a, b) => b.ms - a.ms);
  console.log(`${String(results.length)} queries timed (best of ${String(RUNS)}), ${String(failures.length)} not timed`);
  console.log("      ms   cpu ms     rows  heap KB  query");
  for (const result of results) {
    const numbers = [
      result.ms.toFixed(1).padStart(8),
      result.cpuMs.toFixed(1).padStart(8),
      String(result.rows).padStart(8),
      result.heapKb.toFixed(0).padStart(8),
    ];
    const note = result.flags.length > 0 ? `  [${result.flags.join(", ")}]` : "";
    console.log(`${numbers.join(" ")}  ${result.method}${note}`);
  }
  for (const failure of failures) {
    console.log(`not timed: ${failure.method} (${failure.file}): ${mask(failure.reason)}`);
  }
  if (jsonPath !== undefined) {
    const report = {
      results: results.map((result) => ({ ...result, plan: mask(result.plan) })),
      failures: failures.map((failure) => ({ ...failure, reason: mask(failure.reason) })),
    };
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  }
}

main();
