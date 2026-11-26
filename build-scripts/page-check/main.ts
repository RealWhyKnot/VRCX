import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { callHost } from "./browser.ts";
import { BUDGETS, type Mode } from "./budgets.ts";
import { bundleHost, resolveDist } from "./bundle.ts";
import type { DataProfile, HostConfig } from "./contract.ts";
import { isHang, snapshot } from "./measure.ts";
import { formatReport, hasFailures, type Report } from "./report.ts";
import { DASHBOARD_ID, isLiveRoute, planRoutes, uncovered } from "./routes.ts";
import { createRunner, remountCycles, soakRoute, visitRoute, type RouteResult, type SoakResult } from "./run.ts";
import { readBridgeSurface } from "./surface.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SEED = 20261126;

function readOptions() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "smoke" },
      profile: { type: "string", default: "stress" },
      dist: { type: "string" },
      only: { type: "string" },
      json: { type: "string" },
      "skip-remount": { type: "boolean", default: false },
      "cpu-profile": { type: "string" },
    },
  });
  const mode: Mode = values.mode === "soak" ? "soak" : "smoke";
  const profile: DataProfile = values.profile === "real" ? "real" : "stress";
  const only = values.only === undefined ? null : new Set(values.only.split(",").map((name) => name.trim()));
  const cpuProfileDir = values["cpu-profile"] === undefined ? null : path.resolve(ROOT, values["cpu-profile"]);
  return { mode, profile, dist: values.dist, only, json: values.json, isRemountSkipped: values["skip-remount"], cpuProfileDir };
}

async function main(): Promise<number> {
  const started = performance.now();
  const options = readOptions();
  const budgets = BUDGETS[options.mode];
  const [surface, host, dist] = await Promise.all([readBridgeSurface(ROOT), bundleHost(ROOT), resolveDist(ROOT, options.dist)]);
  const config: HostConfig = { surface, profile: options.profile, seed: SEED, eventsPerSecond: 0, dashboardId: DASHBOARD_ID };
  const { runner, bootMs } = await createRunner(dist, host, config, budgets);
  const report: Report = {
    mode: options.mode,
    profile: options.profile,
    bootMs: isHang(bootMs) ? null : bootMs,
    routes: [],
    remount: null,
    soak: [],
    coverage: [],
    unknownEndpoints: [],
    totalSeconds: 0,
  };
  const unknown = new Set<string>();
  const collectUnknown = async (): Promise<void> => {
    const snap = await snapshot(runner.session().page);
    snap.unknownEndpoints.forEach((endpoint) => unknown.add(endpoint));
  };
  try {
    if (report.bootMs === null) {
      process.stdout.write(`${formatReport(report)}\n`);
      return 1;
    }
    process.stdout.write(`Logged in and settled after ${report.bootMs} ms (${Math.round(performance.now() - started)} ms since start)\n`);
    const liveRoutes = await callHost(runner.session().page, "routes");
    const routes = Array.isArray(liveRoutes) ? liveRoutes.filter(isLiveRoute) : [];
    const plan = planRoutes(routes);
    report.coverage.push(...plan.problems);
    const visits = options.only === null ? plan.visits : plan.visits.filter((visit) => options.only?.has(visit.name));
    const visited = new Set<string>();
    const hung = new Set<string>();
    for (const visit of visits) {
      const result: RouteResult = await visitRoute(runner, visit, budgets, options.cpuProfileDir);
      report.routes.push(result);
      visited.add(visit.expectedName);
      process.stdout.write(`${result.failures.length === 0 ? "ok  " : "FAIL"} ${visit.name}\n`);
      if (result.heapAfterMb === null) {
        hung.add(visit.name);
        const restarted = await runner.restart("/");
        if (isHang(restarted)) {
          report.bootMs = null;
          break;
        }
      } else {
        await collectUnknown();
      }
    }
    if (options.only === null) {
      report.coverage.push(...uncovered(routes, visited).map((name) => `Route ${name} was never visited`));
    }
    const healthy = visits.filter((visit) => !hung.has(visit.name));
    if (!options.isRemountSkipped && report.bootMs !== null && healthy.length > 0) {
      report.remount = await remountCycles(runner, healthy, budgets);
    }
    if (options.mode === "soak") {
      for (const visit of visits.filter((entry) => !entry.name.endsWith("(redirect)"))) {
        const result: SoakResult = await soakRoute(runner, visit, budgets);
        report.soak.push(result);
        process.stdout.write(`${result.failures.length === 0 ? "ok  " : "FAIL"} soak ${visit.name}\n`);
      }
    }
  } finally {
    await collectUnknown().catch((error: unknown) => {
      console.error("Could not read the mock's unknown endpoints", error);
    });
    await runner.close();
  }
  report.unknownEndpoints = [...unknown].sort();
  report.totalSeconds = Math.round((performance.now() - started) / 100) / 10;
  process.stdout.write(`\n${formatReport(report)}\n`);
  if (options.json !== undefined) {
    await writeFile(path.resolve(ROOT, options.json), `${JSON.stringify(report, null, 2)}\n`);
  }
  return hasFailures(report) ? 1 : 0;
}

process.exitCode = await main();
