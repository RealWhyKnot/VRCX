import { describe, expect, test } from "vitest";
import { slopePerMinute } from "../../build-scripts/page-check/measure";

function samples(...mb: number[]): { atMs: number; mb: number }[] {
  return mb.map((value, index) => ({ atMs: index * 5000, mb: value }));
}

describe("slopePerMinute", () => {
  test("returns zero without two distinct sample times", () => {
    expect(slopePerMinute([])).toBe(0);
    expect(slopePerMinute(samples(80))).toBe(0);
    expect(
      slopePerMinute([
        { atMs: 0, mb: 80 },
        { atMs: 0, mb: 90 },
      ])
    ).toBe(0);
  });

  test("measures steady growth exactly", () => {
    expect(slopePerMinute(samples(80, 82.5, 85, 87.5, 90, 92.5, 95))).toBe(30);
    expect(slopePerMinute(samples(90, 90, 90, 90))).toBe(0);
  });

  test("ignores a single heap lump at the end of a steady soak", () => {
    expect(slopePerMinute(samples(87.3, 87.1, 87.2, 87.7, 88.7, 90.4, 106.3))).toBeLessThan(12);
    expect(slopePerMinute(samples(80.7, 81.9, 82.2, 84.1, 84.2, 83.6, 99.7))).toBeLessThan(14);
  });

  test("ignores a lump that clears by the next sample", () => {
    expect(slopePerMinute(samples(81.1, 83.1, 97.7, 83.9, 84.6, 85.1, 85.8))).toBeLessThan(10);
  });

  test("still reports a leak that keeps growing through a lump", () => {
    expect(slopePerMinute(samples(80, 83, 86, 104, 92, 95, 98))).toBe(36);
  });
});
