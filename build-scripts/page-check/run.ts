import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { callHost, closeSession, openSession, TimeoutError, type Session } from "./browser.ts";
import type { Budgets } from "./budgets.ts";
import type { HostConfig } from "./contract.ts";
import { currentRoute, heapMb, isHang, observeWindow, slopePerMinute, snapshot, waitForBoot, waitForQuiet, type Hang } from "./measure.ts";
import type { RouteVisit } from "./routes.ts";

type RouteResult = {
  name: string;
  path: string;
  settleMs: number | null;
  freezeMs: number | null;
  heartbeatMaxMs: number | null;
  longTaskTotalMs: number | null;
  longTaskMaxMs: number | null;
  busyFraction: number | null;
  mutationsPerSecond: number | null;
  topMutations: { target: string; perSecond: number }[];
  heapBeforeMb: number | null;
  heapAfterMb: number | null;
  domNodes: number | null;
  errors: string[];
  failures: string[];
};

type RemountResult = { cycleHeapMb: number[]; cycleDomNodes: number[]; failures: string[] };

type SoakResult = {
  name: string;
  bootMs: number | null;
  samples: { atMs: number; mb: number }[];
  slopeMbPerMinute: number | null;
  errors: string[];
  failures: string[];
};

type Runner = {
  session: () => Session;
  restart: (entry: string) => Promise<number | Hang>;
  close: () => Promise<void>;
};

const HOME = "/feed";

async function navigate(session: Session, target: string, budgets: Budgets): Promise<number | Hang> {
  const started = performance.now();
  try {
    await callHost(session.page, "navigate", [target], budgets.hangTimeoutMs);
    return Math.round(performance.now() - started);
  } catch (error) {
    if (error instanceof TimeoutError) {
      return { isHung: true, phase: "navigation", afterMs: Math.round(performance.now() - started) };
    }
    throw error;
  }
}

function hungResult(visit: RouteVisit, hang: Hang, heapBeforeMb: number | null): RouteResult {
  return {
    name: visit.name,
    path: visit.path,
    settleMs: null,
    freezeMs: null,
    heartbeatMaxMs: null,
    longTaskTotalMs: null,
    longTaskMaxMs: null,
    busyFraction: null,
    mutationsPerSecond: null,
    topMutations: [],
    heapBeforeMb,
    heapAfterMb: null,
    domNodes: null,
    errors: [],
    failures: [`HUNG: main thread stopped answering during ${hang.phase} after ${hang.afterMs} ms`],
  };
}

async function createRunner(dist: string, host: string, config: HostConfig, budgets: Budgets): Promise<{ runner: Runner; bootMs: number | Hang }> {
  let current: Session | null = null;
  const restart = async (entry: string): Promise<number | Hang> => {
    if (current !== null) {
      await closeSession(current);
    }
    current = await openSession(dist, host, config, entry);
    const boot = await waitForBoot(current.page, budgets);
    if (isHang(boot)) {
      return boot;
    }
    const quiet = await waitForQuiet(current.page, budgets, "boot settle");
    return isHang(quiet) ? quiet : boot + quiet.settleMs;
  };
  const bootMs = await restart("/");
  const runner: Runner = {
    session: () => {
      if (current === null) {
        throw new Error("No browser session is open");
      }
      return current;
    },
    restart,
    close: async () => {
      if (current !== null) {
        await closeSession(current);
        current = null;
      }
    },
  };
  return { runner, bootMs };
}

function checkBudgets(result: RouteResult, budgets: Budgets): string[] {
  const failures: string[] = [];
  const over = (label: string, value: number | null, limit: number, unit: string): void => {
    if (value !== null && value > limit) {
      failures.push(`${label} ${value}${unit} is over the ${limit}${unit} budget`);
    }
  };
  over("Opening the page froze the app for", result.freezeMs, budgets.freezeMaxMs, " ms");
  over("Slowest heartbeat", result.heartbeatMaxMs, budgets.heartbeatMaxMs, " ms");
  over("Long tasks while idle", result.longTaskTotalMs, budgets.longTaskTotalMs, " ms");
  over("Longest task while idle", result.longTaskMaxMs, budgets.longTaskMaxMs, " ms");
  over("Main thread busy", result.busyFraction, budgets.busyFraction, "");
  over("DOM mutations", result.mutationsPerSecond, budgets.mutationsPerSecond, "/s");
  if (result.mutationsPerSecond !== null && result.mutationsPerSecond > budgets.mutationsPerSecond) {
    failures.push(`Most changed: ${result.topMutations.map((entry) => `${entry.target} ${entry.perSecond}/s`).join(", ")}`);
  }
  if (result.heapBeforeMb !== null && result.heapAfterMb !== null) {
    over("Heap growth", Math.round((result.heapAfterMb - result.heapBeforeMb) * 10) / 10, budgets.visitHeapGrowthMb, " MB");
  }
  if (result.settleMs !== null && result.settleMs >= budgets.settleTimeoutMs) {
    failures.push(`Never settled within ${budgets.settleTimeoutMs} ms`);
  }
  failures.push(...result.errors.map((error) => `Error: ${error}`));
  return failures;
}

async function saveCpuProfile(session: Session, dir: string, name: string): Promise<void> {
  const { profile } = await session.cdp.send("Profiler.stop");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name.replace(/[^\w-]+/gu, "_")}.cpuprofile`), JSON.stringify(profile));
}

async function visitRoute(runner: Runner, visit: RouteVisit, budgets: Budgets, cpuProfileDir: string | null): Promise<RouteResult> {
  const session = runner.session();
  const heapBeforeMb = await heapMb(session);
  await callHost(session.page, "reset");
  if (cpuProfileDir !== null) {
    await session.cdp.send("Profiler.enable");
    await session.cdp.send("Profiler.start");
  }
  const openMs = await navigate(session, visit.path, budgets);
  if (isHang(openMs)) {
    return hungResult(visit, openMs, heapBeforeMb);
  }
  const settled = await waitForQuiet(session.page, budgets, "load");
  if (isHang(settled)) {
    return hungResult(visit, settled, heapBeforeMb);
  }
  const loadErrors = (await snapshot(session.page)).errors;
  const observed = await observeWindow(session, budgets, budgets.windowMs, budgets.eventsPerSecond);
  if (isHang(observed)) {
    return hungResult(visit, observed, heapBeforeMb);
  }
  if (cpuProfileDir !== null) {
    await saveCpuProfile(session, cpuProfileDir, visit.name);
  }
  const heapAfterMb = await heapMb(session);
  const route = await currentRoute(session.page);
  const result: RouteResult = {
    name: visit.name,
    path: visit.path,
    settleMs: openMs + settled.settleMs,
    freezeMs: Math.max(openMs, settled.freezeMs),
    heartbeatMaxMs: observed.heartbeatMaxMs,
    longTaskTotalMs: observed.longTaskTotalMs,
    longTaskMaxMs: observed.longTaskMaxMs,
    busyFraction: observed.busyFraction,
    mutationsPerSecond: observed.mutationsPerSecond,
    topMutations: observed.topMutations,
    heapBeforeMb,
    heapAfterMb,
    domNodes: observed.domNodes,
    errors: [...new Set([...loadErrors, ...observed.errors])],
    failures: [],
  };
  result.failures = checkBudgets(result, budgets);
  if (route?.name !== visit.expectedName) {
    result.failures.push(`Landed on ${route?.fullPath ?? "nothing"} instead of ${visit.expectedName}`);
  }
  return result;
}

async function remountCycles(runner: Runner, visits: RouteVisit[], budgets: Budgets): Promise<RemountResult> {
  const cycleHeapMb: number[] = [];
  const cycleDomNodes: number[] = [];
  const failures: string[] = [];
  for (let cycle = 0; cycle < budgets.remountCycles; cycle += 1) {
    for (const visit of visits) {
      const session = runner.session();
      const opened = await navigate(session, visit.path, budgets);
      const quiet = isHang(opened) ? opened : await waitForQuiet(session.page, budgets, `remount ${visit.name}`);
      if (isHang(quiet)) {
        failures.push(`HUNG on ${visit.name} during remount cycle ${cycle + 1}`);
        return { cycleHeapMb, cycleDomNodes, failures };
      }
    }
    const session = runner.session();
    const opened = await navigate(session, HOME, budgets);
    const quiet = isHang(opened) ? opened : await waitForQuiet(session.page, budgets, "remount home");
    if (isHang(quiet)) {
      failures.push(`HUNG returning home after remount cycle ${cycle + 1}`);
      return { cycleHeapMb, cycleDomNodes, failures };
    }
    cycleHeapMb.push(await heapMb(session));
    cycleDomNodes.push((await snapshot(session.page)).domNodes);
  }
  const first = cycleHeapMb[1] ?? cycleHeapMb[0];
  const last = cycleHeapMb.at(-1);
  if (first !== undefined && last !== undefined && cycleHeapMb.length > 2) {
    const perCycle = Math.round(((last - first) / (cycleHeapMb.length - 2)) * 10) / 10;
    if (perCycle > budgets.remountGrowthMbPerCycle) {
      failures.push(`Heap grew ${perCycle} MB per full route cycle (budget ${budgets.remountGrowthMbPerCycle} MB)`);
    }
  }
  const firstNodes = cycleDomNodes[0];
  const lastNodes = cycleDomNodes.at(-1);
  if (firstNodes !== undefined && lastNodes !== undefined && lastNodes > firstNodes * 1.25 + 200) {
    failures.push(`DOM grew from ${firstNodes} to ${lastNodes} nodes on the home page across cycles`);
  }
  return { cycleHeapMb, cycleDomNodes, failures };
}

async function soakRoute(runner: Runner, visit: RouteVisit, budgets: Budgets): Promise<SoakResult> {
  const booted = await runner.restart(visit.path);
  if (isHang(booted)) {
    return {
      name: visit.name,
      bootMs: null,
      samples: [],
      slopeMbPerMinute: null,
      errors: [],
      failures: [`HUNG: cold load of ${visit.path} stopped answering during ${booted.phase} after ${booted.afterMs} ms`],
    };
  }
  const session = runner.session();
  const samples = [{ atMs: 0, mb: await heapMb(session) }];
  const errors = new Set<string>();
  const failures: string[] = [];
  for (let atMs = budgets.soakSampleMs; atMs <= budgets.soakMs; atMs += budgets.soakSampleMs) {
    const observed = await observeWindow(session, budgets, budgets.soakSampleMs, budgets.eventsPerSecond);
    if (isHang(observed)) {
      failures.push(`HUNG after ${atMs - budgets.soakSampleMs + observed.afterMs} ms of soak`);
      return { name: visit.name, bootMs: booted, samples, slopeMbPerMinute: null, errors: [...errors], failures };
    }
    observed.errors.forEach((error) => errors.add(error));
    samples.push({ atMs, mb: await heapMb(session) });
  }
  const slope = slopePerMinute(samples);
  if (slope > budgets.soakSlopeMbPerMinute) {
    failures.push(`Heap grew ${slope} MB per minute during the soak (budget ${budgets.soakSlopeMbPerMinute})`);
  }
  failures.push(...[...errors].map((error) => `Error: ${error}`));
  return { name: visit.name, bootMs: booted, samples, slopeMbPerMinute: slope, errors: [...errors], failures };
}

export { createRunner, remountCycles, soakRoute, visitRoute };
export type { RemountResult, RouteResult, Runner, SoakResult };
