import type * as SentryTypes from "@sentry/vue";

type Row = Record<string, unknown>;

type SentryReporter = Pick<typeof SentryTypes, "withScope" | "captureMessage">;

type MemoryReportOptions = {
  intervalMs?: number;
  thresholdRatio?: number;
  cooldownMs?: number;
};

type HeapSnapshot = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function readPerformanceMemory(): HeapSnapshot | null {
  const performanceValue: unknown = globalThis.performance;
  const memory: unknown = isRow(performanceValue) ? performanceValue["memory"] : undefined;
  if (!isRow(memory)) return null;
  const { usedJSHeapSize, jsHeapSizeLimit } = memory;
  if (typeof usedJSHeapSize !== "number" || typeof jsHeapSizeLimit !== "number") {
    return null;
  }
  return { usedJSHeapSize, jsHeapSizeLimit };
}

export function startRendererMemoryThresholdReport(
  sentry: SentryReporter,
  { intervalMs = 10_000, thresholdRatio = 0.8, cooldownMs = 5 * 60_000 }: MemoryReportOptions = {}
) {
  const initial = readPerformanceMemory();
  if (!initial) return null;

  let lastSent = 0;

  return setInterval(() => {
    const m = readPerformanceMemory();
    if (!m) return;

    const ratio = m.usedJSHeapSize / m.jsHeapSizeLimit;
    if (!Number.isFinite(ratio) || ratio < thresholdRatio) return;

    const now = Date.now();
    if (now - lastSent < cooldownMs) return;
    lastSent = now;

    sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setTag("reason", "high-js-heap");
      scope.setContext("memory", {
        usedMB: m.usedJSHeapSize / 1024 / 1024,
        limitMB: m.jsHeapSizeLimit / 1024 / 1024,
        ratio,
      });
      sentry.captureMessage("Memory usage critical: nearing JS heap limit");
    });
  }, intervalMs);
}
