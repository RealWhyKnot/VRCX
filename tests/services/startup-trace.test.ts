import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { markStartup, reportStartup, resetStartupTrace, startupSteps } from "../../src/services/startup-trace";

describe("startup trace", () => {
  beforeEach(() => {
    resetStartupTrace();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("records each step with the time since the one before", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(120.4);
    markStartup("first");
    now.mockReturnValueOnce(480.2);
    markStartup("second");

    expect(startupSteps()).toEqual([
      { name: "first", atMs: 120, stepMs: 120 },
      { name: "second", atMs: 480, stepMs: 360 },
    ]);
  });

  test("keeps the first time when a step is marked twice", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(100);
    markStartup("signed in");
    now.mockReturnValueOnce(900);
    markStartup("signed in");

    expect(startupSteps()).toEqual([{ name: "signed in", atMs: 100, stepMs: 100 }]);
  });

  test("prints once and ignores later marks", () => {
    const table = vi.spyOn(console, "table").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    markStartup("first");

    reportStartup();
    reportStartup();
    markStartup("late");

    expect(table).toHaveBeenCalledTimes(1);
    expect(startupSteps().map((step) => step.name)).toEqual(["first"]);
  });
});
