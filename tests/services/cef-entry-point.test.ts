import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const STA_MAIN = /\[STAThread\]\s*(?:(?:private|internal|public)\s+)?static\s+void\s+Main\s*\(/;
const ASYNC_MAIN = /static\s+async\s+[\w<>]+\s+Main\s*\(/;

function readProgram(): string {
  return readFileSync(path.join(ROOT, "src/VRCX-Cef/Program.cs"), "utf8");
}

describe("Windows host entry point", () => {
  test("Main is synchronous and marked STAThread so every VRCX.exe process starts in a single-threaded apartment", () => {
    expect(readProgram()).toMatch(STA_MAIN);
  });

  test("Main is never async, because the compiler drops STAThread from the generated async entry point", () => {
    expect(readProgram()).not.toMatch(ASYNC_MAIN);
  });

  test("the patterns reject the async entry point that crashed CEF utility processes", () => {
    const regressed = "[STAThread]\n    private static async Task Main()\n    {";
    expect(regressed).not.toMatch(STA_MAIN);
    expect(regressed).toMatch(ASYNC_MAIN);
  });
});
