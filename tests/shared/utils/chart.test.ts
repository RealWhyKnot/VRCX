import { describe, expect, test, vi } from "vitest";

describe("loadEcharts", () => {
  test("loads echarts module", async () => {
    vi.resetModules();
    vi.doMock("echarts", () => ({
      __esModule: true,
      marker: "mock-echarts",
    }));
    const { loadEcharts } = await import("../../../src/shared/utils/chart.ts");

    const loaded: unknown = await loadEcharts();

    expect(loaded).toMatchObject({ marker: "mock-echarts" });
  });

  test("returns cached module reference on subsequent calls", async () => {
    vi.resetModules();
    vi.doMock("echarts", () => ({
      __esModule: true,
      marker: "mock-echarts",
    }));
    const { loadEcharts } = await import("../../../src/shared/utils/chart.ts");

    const first: unknown = await loadEcharts();
    const second: unknown = await loadEcharts();

    expect(second).toBe(first);
  });

  test("rejects when echarts import fails", async () => {
    vi.resetModules();
    vi.doMock("echarts", () => {
      throw new Error("import failed");
    });
    const { loadEcharts } = await import("../../../src/shared/utils/chart.ts");

    await expect(loadEcharts()).rejects.toThrow();
  });
});
