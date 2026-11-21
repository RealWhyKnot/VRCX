import { afterEach, expect, test, vi } from "vitest";
import { hasVrcApiTrouble, recordVrcApiStatus } from "@/stores/vrc-api-status";

afterEach(() => {
  recordVrcApiStatus(200);
  vi.useRealTimers();
});

test("requires three recent transport or server failures and clears on success", () => {
  recordVrcApiStatus(200, 0);
  recordVrcApiStatus(500, 1);
  recordVrcApiStatus(503, 2);
  recordVrcApiStatus(401, 3);
  recordVrcApiStatus(429, 4);
  expect(hasVrcApiTrouble.value).toBe(false);
  recordVrcApiStatus(502, 61_000);
  expect(hasVrcApiTrouble.value).toBe(false);
  recordVrcApiStatus(0, 62_000);
  recordVrcApiStatus(504, 63_000);
  expect(hasVrcApiTrouble.value).toBe(true);
  recordVrcApiStatus(404, 64_000);
  expect(hasVrcApiTrouble.value).toBe(true);
  recordVrcApiStatus(204, 65_000);
  expect(hasVrcApiTrouble.value).toBe(false);
});

test("clears amber after a quiet minute from the most recent failure", () => {
  vi.useFakeTimers();
  recordVrcApiStatus(500);
  recordVrcApiStatus(502);
  recordVrcApiStatus(0);
  vi.advanceTimersByTime(50_000);
  recordVrcApiStatus(503);
  vi.advanceTimersByTime(59_999);
  recordVrcApiStatus(429);
  expect(hasVrcApiTrouble.value).toBe(true);
  vi.advanceTimersByTime(1);
  expect(hasVrcApiTrouble.value).toBe(false);
  recordVrcApiStatus(500);
  expect(hasVrcApiTrouble.value).toBe(false);
});

test("success cancels expiry from the previous failure streak", () => {
  vi.useFakeTimers();
  for (const status of [502, 503, 0, 204]) recordVrcApiStatus(status);
  expect(hasVrcApiTrouble.value).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(30_000);
  for (const status of [500, 0, 500]) recordVrcApiStatus(status);
  vi.advanceTimersByTime(30_000);
  expect(hasVrcApiTrouble.value).toBe(true);
  vi.advanceTimersByTime(30_000);
  expect(hasVrcApiTrouble.value).toBe(false);
});
