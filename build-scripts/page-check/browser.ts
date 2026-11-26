import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type BrowserContext, type CDPSession, type Page, type Route } from "playwright";

import type { HostConfig } from "./contract.ts";

type Session = { browser: Browser; context: BrowserContext; page: Page; cdp: CDPSession };

type CpuMetrics = { taskSeconds: number; scriptSeconds: number; layouts: number; styles: number };

const ORIGIN = "http://vrcx.test";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const CALL_TIMEOUT_MS = 15000;
const CLOSE_TIMEOUT_MS = 5000;
const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp|avif)(\?|$)/iu;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".ttf", "font/ttf"],
  [".ico", "image/x-icon"],
  [".wasm", "application/wasm"],
]);

class TimeoutError extends Error {
  override name = "TimeoutError";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

async function serve(dist: string, route: Route): Promise<void> {
  const url = new URL(route.request().url());
  if (url.origin !== ORIGIN) {
    if (IMAGE_PATTERN.test(url.pathname) || route.request().resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
      return;
    }
    await route.abort("internetdisconnected");
    return;
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.join(dist, path.normalize(relative));
  if (!file.startsWith(dist)) {
    await route.fulfill({ status: 403, body: "" });
    return;
  }
  try {
    const body = await readFile(file);
    await route.fulfill({ status: 200, contentType: MIME.get(path.extname(file).toLowerCase()) ?? "application/octet-stream", body });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await route.fulfill({ status: 404, body: "" });
      return;
    }
    throw error;
  }
}

async function openSession(dist: string, host: string, config: HostConfig, entry: string): Promise<Session> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    locale: "en-US",
    timezoneId: "UTC",
  });
  await context.route("**/*", (route) => serve(dist, route));
  await context.addInitScript({ content: `window.pageCheckConfig = ${JSON.stringify(config)};\n${host}` });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
  await page.goto(`${ORIGIN}/index.html#${entry}`, { waitUntil: "domcontentloaded", timeout: CALL_TIMEOUT_MS });
  return { browser, context, page, cdp };
}

async function closeSession(session: Session): Promise<void> {
  try {
    await withTimeout(session.browser.close(), CLOSE_TIMEOUT_MS, "Closing the browser");
  } catch (error) {
    if (!(error instanceof TimeoutError)) {
      throw error;
    }
    console.error("The browser did not close in time and is left for Playwright to kill when the page check exits", error);
  }
}

function callHost(page: Page, method: string, args: unknown[] = [], ms = CALL_TIMEOUT_MS): Promise<unknown> {
  return withTimeout(
    page.evaluate(
      ([name, values]) => {
        const api: unknown = Reflect.get(window, "pageCheck");
        const fn: unknown = typeof api === "object" && api !== null ? Reflect.get(api, name) : undefined;
        if (typeof fn !== "function") {
          throw new TypeError(`page-check host has no ${name}`);
        }
        const result: unknown = Reflect.apply(fn, api, values);
        return result;
      },
      [method, args] as const
    ),
    ms,
    `Host call ${method}`
  );
}

async function heartbeat(page: Page, ms: number): Promise<number | null> {
  const started = performance.now();
  try {
    await withTimeout(
      page.evaluate(() => performance.now()),
      ms,
      "Heartbeat"
    );
    return performance.now() - started;
  } catch (error) {
    if (error instanceof TimeoutError) {
      return null;
    }
    throw error;
  }
}

async function heapAfterGc(cdp: CDPSession): Promise<number> {
  await withTimeout(cdp.send("HeapProfiler.collectGarbage"), CALL_TIMEOUT_MS, "Garbage collection");
  const usage = await withTimeout(cdp.send("Runtime.getHeapUsage"), CALL_TIMEOUT_MS, "Heap usage");
  return usage.usedSize;
}

async function cpuMetrics(cdp: CDPSession): Promise<CpuMetrics> {
  const { metrics } = await withTimeout(cdp.send("Performance.getMetrics"), CALL_TIMEOUT_MS, "Performance metrics");
  const value = (name: string): number => metrics.find((metric) => metric.name === name)?.value ?? 0;
  return { taskSeconds: value("TaskDuration"), scriptSeconds: value("ScriptDuration"), layouts: value("LayoutCount"), styles: value("RecalcStyleCount") };
}

export { callHost, closeSession, cpuMetrics, heapAfterGc, heartbeat, openSession, TimeoutError, withTimeout };
export type { CpuMetrics, Session };
