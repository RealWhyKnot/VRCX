import type { RemountResult, RouteResult, SoakResult } from "./run.ts";

type Report = {
  mode: string;
  profile: string;
  bootMs: number | null;
  routes: RouteResult[];
  remount: RemountResult | null;
  soak: SoakResult[];
  coverage: string[];
  unknownEndpoints: string[];
  totalSeconds: number;
};

function cell(value: number | null, width: number): string {
  return (value === null ? "-" : String(value)).padStart(width);
}

function formatReport(report: Report): string {
  const lines = [`Page check (${report.mode}, ${report.profile} data): boot ${report.bootMs ?? "HUNG"} ms`, ""];
  lines.push(
    `${"route".padEnd(30)}${"settle".padStart(8)}${"freeze".padStart(8)}${"beat".padStart(7)}${"long".padStart(7)}${"max".padStart(6)}${"busy".padStart(6)}${"mut/s".padStart(7)}${"heap".padStart(8)}${"after".padStart(8)}${"nodes".padStart(7)}  result`
  );
  for (const route of report.routes) {
    const status = route.failures.length === 0 ? "ok" : "FAIL";
    lines.push(
      `${route.name.padEnd(30)}${cell(route.settleMs, 8)}${cell(route.freezeMs, 8)}${cell(route.heartbeatMaxMs, 7)}${cell(route.longTaskTotalMs, 7)}${cell(route.longTaskMaxMs, 6)}${cell(route.busyFraction, 6)}${cell(route.mutationsPerSecond, 7)}${cell(route.heapBeforeMb, 8)}${cell(route.heapAfterMb, 8)}${cell(route.domNodes, 7)}  ${status}`
    );
    for (const failure of route.failures) {
      lines.push(`    ${failure.split("\n").join("\n      ")}`);
    }
  }
  if (report.remount !== null) {
    lines.push("", `Remount cycles: heap ${report.remount.cycleHeapMb.join(" -> ")} MB, home DOM ${report.remount.cycleDomNodes.join(" -> ")} nodes`);
    lines.push(...report.remount.failures.map((failure) => `    ${failure}`));
  }
  for (const soak of report.soak) {
    const status = soak.failures.length === 0 ? "ok" : "FAIL";
    lines.push(
      `Soak ${soak.name}: boot ${soak.bootMs ?? "-"} ms, heap ${soak.samples.map((sample) => sample.mb).join(" -> ")} MB, ${soak.slopeMbPerMinute ?? "-"} MB/min  ${status}`
    );
    lines.push(...soak.failures.map((failure) => `    ${failure}`));
  }
  if (report.coverage.length > 0) {
    lines.push("", "Route coverage problems:", ...report.coverage.map((problem) => `    ${problem}`));
  }
  if (report.unknownEndpoints.length > 0) {
    lines.push("", `API calls the mock answered with defaults: ${report.unknownEndpoints.join(", ")}`);
  }
  lines.push("", `Finished in ${report.totalSeconds} s`);
  return lines.join("\n");
}

function hasFailures(report: Report): boolean {
  return (
    report.bootMs === null ||
    report.coverage.length > 0 ||
    report.routes.some((route) => route.failures.length > 0) ||
    (report.remount?.failures.length ?? 0) > 0 ||
    report.soak.some((soak) => soak.failures.length > 0)
  );
}

export { formatReport, hasFailures };
export type { Report };
