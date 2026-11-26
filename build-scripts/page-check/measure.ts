import { setTimeout as sleep } from "node:timers/promises";

import type { Page } from "playwright";

import { callHost, cpuMetrics, heapAfterGc, heartbeat, TimeoutError, type Session } from "./browser.ts";
import type { Budgets } from "./budgets.ts";
import type { ProbeSnapshot } from "./contract.ts";

type Hang = { isHung: true; phase: string; afterMs: number };

type WindowStats = {
  heartbeatMaxMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  busyFraction: number;
  mutationsPerSecond: number;
  topMutations: { target: string; perSecond: number }[];
  events: number;
  errors: string[];
  domNodes: number;
};

type CurrentRoute = { name: string | null; fullPath: string };

type Settled = { settleMs: number; freezeMs: number };

const POLL_MS = 250;
const QUIET_MS = 750;
const MB = 1024 * 1024;

function isSnapshot(value: unknown): value is ProbeSnapshot {
  return typeof value === "object" && value !== null && "now" in value && "longTasks" in value && "errors" in value && Array.isArray(value.errors);
}

function isCurrentRoute(value: unknown): value is CurrentRoute {
  return (
    typeof value === "object" &&
    value !== null &&
    "fullPath" in value &&
    typeof value.fullPath === "string" &&
    "name" in value &&
    (value.name === null || typeof value.name === "string")
  );
}

async function snapshot(page: Page): Promise<ProbeSnapshot> {
  const value = await callHost(page, "snapshot");
  if (!isSnapshot(value)) {
    throw new TypeError("The page-check probe returned an unexpected snapshot");
  }
  return value;
}

async function currentRoute(page: Page): Promise<CurrentRoute | null> {
  const value = await callHost(page, "currentRoute");
  return isCurrentRoute(value) ? value : null;
}

function megabytes(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10;
}

async function waitForQuiet(page: Page, budgets: Budgets, phase: string): Promise<Settled | Hang> {
  const started = performance.now();
  let quietPolls = 0;
  let freezeMs = 0;
  const settled = (): Settled => ({ settleMs: Math.round(performance.now() - started), freezeMs: Math.round(freezeMs) });
  while (performance.now() - started < budgets.settleTimeoutMs) {
    const latency = await heartbeat(page, budgets.hangTimeoutMs);
    if (latency === null) {
      return { isHung: true, phase, afterMs: Math.round(performance.now() - started) };
    }
    freezeMs = Math.max(freezeMs, latency);
    const snap = await snapshot(page);
    const lastTaskEnd = snap.longTasks.reduce((latest, task) => Math.max(latest, task.start + task.duration), 0);
    const isQuiet = snap.pendingBridgeCalls === 0 && snap.now - lastTaskEnd >= QUIET_MS;
    quietPolls = isQuiet ? quietPolls + 1 : 0;
    if (quietPolls >= 2) {
      return settled();
    }
    await sleep(POLL_MS);
  }
  return settled();
}

async function waitForBoot(page: Page, budgets: Budgets): Promise<number | Hang> {
  const started = performance.now();
  let lastState = "no route yet";
  while (performance.now() - started < budgets.bootTimeoutMs) {
    const latency = await heartbeat(page, budgets.hangTimeoutMs);
    if (latency === null) {
      return { isHung: true, phase: "boot", afterMs: Math.round(performance.now() - started) };
    }
    const route = await currentRoute(page).catch((error: unknown) => {
      if (error instanceof TimeoutError) {
        throw error;
      }
      return null;
    });
    const sockets = await callHost(page, "sockets");
    if (route !== null && route.name !== "login" && typeof sockets === "number" && sockets > 0) {
      return Math.round(performance.now() - started);
    }
    lastState = `route ${route?.fullPath ?? "none"}, ${String(sockets)} open sockets`;
    await sleep(POLL_MS);
  }
  throw new Error(`The app did not finish logging in within ${budgets.bootTimeoutMs} ms (last seen: ${lastState})`);
}

async function observeWindow(session: Session, budgets: Budgets, ms: number, eventsPerSecond: number): Promise<WindowStats | Hang> {
  const { page, cdp } = session;
  await callHost(page, "reset");
  await callHost(page, "setEventRate", [eventsPerSecond]);
  const cpuStart = await cpuMetrics(cdp);
  const started = performance.now();
  let heartbeatMaxMs = 0;
  while (performance.now() - started < ms) {
    const latency = await heartbeat(page, budgets.hangTimeoutMs);
    if (latency === null) {
      return { isHung: true, phase: "window", afterMs: Math.round(performance.now() - started) };
    }
    heartbeatMaxMs = Math.max(heartbeatMaxMs, latency);
    await sleep(POLL_MS);
  }
  await callHost(page, "setEventRate", [0]);
  const elapsedSeconds = (performance.now() - started) / 1000;
  const cpuEnd = await cpuMetrics(cdp);
  const snap = await snapshot(page);
  return {
    heartbeatMaxMs: Math.round(heartbeatMaxMs),
    longTaskCount: snap.longTasks.length,
    longTaskTotalMs: Math.round(snap.longTasks.reduce((sum, task) => sum + task.duration, 0)),
    longTaskMaxMs: Math.round(snap.longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
    busyFraction: Math.round(((cpuEnd.taskSeconds - cpuStart.taskSeconds) / elapsedSeconds) * 100) / 100,
    mutationsPerSecond: Math.round(snap.mutations / elapsedSeconds),
    topMutations: snap.topMutations.map((entry) => ({ target: entry.target, perSecond: Math.round(entry.count / elapsedSeconds) })),
    events: snap.events,
    errors: snap.errors,
    domNodes: snap.domNodes,
  };
}

async function heapMb(session: Session): Promise<number> {
  return megabytes(await heapAfterGc(session.cdp));
}

function slopePerMinute(samples: { atMs: number; mb: number }[]): number {
  const slopes = samples.flatMap((earlier, index) =>
    samples
      .slice(index + 1)
      .filter((later) => later.atMs !== earlier.atMs)
      .map((later) => (later.mb - earlier.mb) / (later.atMs - earlier.atMs))
  );
  if (slopes.length === 0) {
    return 0;
  }
  slopes.sort((a, b) => a - b);
  const middle = Math.floor(slopes.length / 2);
  const upper = slopes[middle] ?? 0;
  const lower = slopes.length % 2 === 1 ? upper : (slopes[middle - 1] ?? upper);
  return Math.round(((lower + upper) / 2) * 60000 * 10) / 10;
}

function isHang(value: unknown): value is Hang {
  return typeof value === "object" && value !== null && "isHung" in value && value.isHung === true;
}

export { currentRoute, heapMb, isHang, megabytes, observeWindow, slopePerMinute, snapshot, waitForBoot, waitForQuiet };
export type { Hang, Settled, WindowStats };
