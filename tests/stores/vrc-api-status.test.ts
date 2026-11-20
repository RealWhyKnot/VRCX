import { expect, test } from "vitest";
import { hasVrcApiTrouble, recordVrcApiStatus } from "@/stores/vrc-api-status";

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
