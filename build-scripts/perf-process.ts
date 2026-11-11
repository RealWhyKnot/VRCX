import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

type ProcessSample = { pid: number; cpuSeconds: number; workingSetMb: number; privateMb: number; threads: number; handles: number };

type ProcessTotals = {
  pid: number;
  cpuPercentAverage: number;
  cpuPercentPeak: number;
  workingSetMbAverage: number;
  workingSetMbPeak: number;
  privateMbPeak: number;
  threadsPeak: number;
  handlesPeak: number;
};

const run = promisify(execFile);
const DEFAULT_NAME = "VRCX";
const DEFAULT_SECONDS = 30;
const INTERVAL_MS = 1000;
const MB = 1024 * 1024;
const NAME_PATTERN = /^[\w.-]{1,64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberAt(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function readSamples(name: string): Promise<ProcessSample[]> {
  const script = `Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64,HandleCount,@{n='Threads';e={$_.Threads.Count}} | ConvertTo-Json -Compress`;
  const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
  const text = stdout.trim();
  if (!text) {
    return [];
  }
  const parsed: unknown = JSON.parse(text);
  const rows: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  return rows.filter(isRecord).map((row) => ({
    pid: numberAt(row, "Id"),
    cpuSeconds: numberAt(row, "CPU"),
    workingSetMb: numberAt(row, "WorkingSet64") / MB,
    privateMb: numberAt(row, "PrivateMemorySize64") / MB,
    threads: numberAt(row, "Threads"),
    handles: numberAt(row, "HandleCount"),
  }));
}

function emptyTotals(pid: number): ProcessTotals {
  return { pid, cpuPercentAverage: 0, cpuPercentPeak: 0, workingSetMbAverage: 0, workingSetMbPeak: 0, privateMbPeak: 0, threadsPeak: 0, handlesPeak: 0 };
}

function summarize(rounds: { atMs: number; samples: ProcessSample[] }[]): ProcessTotals[] {
  const totals = new Map<number, ProcessTotals>();
  const counts = new Map<number, number>();
  const first = new Map<number, { atMs: number; cpuSeconds: number }>();
  const last = new Map<number, { atMs: number; cpuSeconds: number }>();
  for (const round of rounds) {
    for (const sample of round.samples) {
      const entry = totals.get(sample.pid) ?? emptyTotals(sample.pid);
      const previous = last.get(sample.pid);
      if (previous && round.atMs > previous.atMs) {
        const percent = ((sample.cpuSeconds - previous.cpuSeconds) / ((round.atMs - previous.atMs) / 1000)) * 100;
        entry.cpuPercentPeak = Math.max(entry.cpuPercentPeak, percent);
      }
      if (!first.has(sample.pid)) {
        first.set(sample.pid, { atMs: round.atMs, cpuSeconds: sample.cpuSeconds });
      }
      last.set(sample.pid, { atMs: round.atMs, cpuSeconds: sample.cpuSeconds });
      entry.workingSetMbAverage = entry.workingSetMbAverage + sample.workingSetMb;
      entry.workingSetMbPeak = Math.max(entry.workingSetMbPeak, sample.workingSetMb);
      entry.privateMbPeak = Math.max(entry.privateMbPeak, sample.privateMb);
      entry.threadsPeak = Math.max(entry.threadsPeak, sample.threads);
      entry.handlesPeak = Math.max(entry.handlesPeak, sample.handles);
      totals.set(sample.pid, entry);
      counts.set(sample.pid, (counts.get(sample.pid) ?? 0) + 1);
    }
  }
  for (const [pid, entry] of totals) {
    const start = first.get(pid);
    const end = last.get(pid);
    entry.workingSetMbAverage = entry.workingSetMbAverage / (counts.get(pid) ?? 1);
    if (start && end && end.atMs > start.atMs) {
      entry.cpuPercentAverage = ((end.cpuSeconds - start.cpuSeconds) / ((end.atMs - start.atMs) / 1000)) * 100;
    }
  }
  return [...totals.values()].sort((a, b) => b.workingSetMbPeak - a.workingSetMbPeak);
}

function cell(value: number, width: number, digits = 1): string {
  return value.toFixed(digits).padStart(width);
}

function printReport(name: string, seconds: number, totals: ProcessTotals[]) {
  const sum = (pick: (entry: ProcessTotals) => number) => totals.reduce((total, entry) => total + pick(entry), 0);
  console.log(`${name}: ${String(totals.length)} processes over ${String(seconds)} s. CPU is percent of one core (${String(cpus().length)} cores).`);
  console.log(
    `${"pid".padStart(7)} ${"cpu avg".padStart(8)} ${"cpu peak".padStart(8)} ${"mem avg".padStart(9)} ${"mem peak".padStart(9)} ${"private".padStart(9)} ${"threads".padStart(7)} ${"handles".padStart(7)}`
  );
  for (const entry of totals) {
    console.log(
      `${String(entry.pid).padStart(7)} ${cell(entry.cpuPercentAverage, 8)} ${cell(entry.cpuPercentPeak, 8)} ${cell(entry.workingSetMbAverage, 9)} ${cell(entry.workingSetMbPeak, 9)} ${cell(entry.privateMbPeak, 9)} ${cell(entry.threadsPeak, 7, 0)} ${cell(entry.handlesPeak, 7, 0)}`
    );
  }
  console.log(
    `${"total".padStart(7)} ${cell(
      sum((entry) => entry.cpuPercentAverage),
      8
    )} ${"".padStart(8)} ${cell(
      sum((entry) => entry.workingSetMbAverage),
      9
    )} ${cell(
      sum((entry) => entry.workingSetMbPeak),
      9
    )} ${cell(
      sum((entry) => entry.privateMbPeak),
      9
    )} ${cell(
      sum((entry) => entry.threadsPeak),
      7,
      0
    )} ${cell(
      sum((entry) => entry.handlesPeak),
      7,
      0
    )}`
  );
}

async function main() {
  const name = process.argv[2] ?? DEFAULT_NAME;
  const seconds = Number(process.argv[3] ?? DEFAULT_SECONDS);
  if (!NAME_PATTERN.test(name) || !Number.isFinite(seconds) || seconds < 2 || seconds > 3600) {
    console.error("Usage: node build-scripts/perf-process.ts [process name] [seconds, 2 to 3600]");
    process.exitCode = 1;
    return;
  }
  const rounds: { atMs: number; samples: ProcessSample[] }[] = [];
  const endMs = Date.now() + seconds * 1000;
  while (Date.now() < endMs) {
    rounds.push({ atMs: Date.now(), samples: await readSamples(name) });
    await sleep(INTERVAL_MS);
  }
  const totals = summarize(rounds);
  if (totals.length === 0) {
    console.error(`No running process is named ${name}.`);
    process.exitCode = 1;
    return;
  }
  printReport(name, seconds, totals);
}

await main();
