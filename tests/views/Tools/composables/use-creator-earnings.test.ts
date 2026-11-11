import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEarningsMetrics: vi.fn<(params: { metricDateStart?: string; metricDateEnd?: string }) => Promise<unknown>>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("../../../../src/api/marketplace", () => ({ marketplaceRequest: { getEarningsMetrics: mocks.getEarningsMetrics } }));
vi.mock("../../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import { earningsQuery, isEarningsRange, parseEarningsTotals, useCreatorEarnings } from "../../../../src/views/Tools/composables/use-creator-earnings";

const TOTALS = { totalEarnings: 1500, otpEarnings: 1000, otpPurchaseCount: 4, subscriberEarnings: 500, subscriberMonths: 5 };

describe("parseEarningsTotals", () => {
  test("reads the five totals", () => {
    expect(parseEarningsTotals({ sellerId: "usr_1", breakdown: [], totals: TOTALS })).toEqual(TOTALS);
  });

  test("turns missing or bad numbers into zero", () => {
    expect(parseEarningsTotals({ totals: { totalEarnings: "1500", otpEarnings: Number.NaN, otpPurchaseCount: 2.9 } })).toEqual({
      totalEarnings: 0,
      otpEarnings: 0,
      otpPurchaseCount: 2,
      subscriberEarnings: 0,
      subscriberMonths: 0,
    });
  });

  test.each([[null], [undefined], ["text"], [[]], [{}], [{ totals: null }], [{ totals: "none" }]])("rejects %j", (input) => {
    expect(parseEarningsTotals(input)).toBeUndefined();
  });
});

describe("earningsQuery", () => {
  const now = new Date("2026-11-11T12:00:00.000Z");

  test("sends no dates for all time", () => {
    expect(earningsQuery("all", now)).toEqual({});
  });

  test.each([
    ["30d", "2026-10-12T12:00:00.000Z"],
    ["90d", "2026-08-13T12:00:00.000Z"],
    ["1y", "2025-11-11T12:00:00.000Z"],
  ] as const)("%s starts at %s", (range, start) => {
    expect(earningsQuery(range, now)).toEqual({ metricDateStart: start, metricDateEnd: "2026-11-11T12:00:00.000Z" });
  });
});

describe("isEarningsRange", () => {
  test("accepts only the known ranges", () => {
    expect(isEarningsRange("90d")).toBe(true);
    expect(isEarningsRange("7d")).toBe(false);
    expect(isEarningsRange(30)).toBe(false);
    expect(isEarningsRange(null)).toBe(false);
  });
});

describe("useCreatorEarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEarningsMetrics.mockResolvedValue({ totals: TOTALS });
  });

  test("loads totals for the chosen range", async () => {
    const earnings = useCreatorEarnings();
    expect(earnings.state.value).toEqual({ status: "idle" });
    await earnings.setRange("all");
    expect(mocks.getEarningsMetrics).toHaveBeenCalledWith({});
    expect(earnings.state.value).toEqual({ status: "ready", totals: TOTALS });
  });

  test("keeps the current range when given an unknown one", async () => {
    const earnings = useCreatorEarnings();
    await earnings.setRange("forever");
    expect(earnings.range.value).toBe("30d");
  });

  test("fails on an unreadable answer", async () => {
    mocks.getEarningsMetrics.mockResolvedValue({ nope: true });
    const earnings = useCreatorEarnings();
    await earnings.load();
    expect(earnings.state.value).toEqual({ status: "failed" });
  });

  test("fails and logs when the request is refused", async () => {
    mocks.getEarningsMetrics.mockRejectedValue(new Error("forbidden"));
    const earnings = useCreatorEarnings();
    await earnings.load();
    expect(earnings.state.value).toEqual({ status: "failed" });
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });

  test("keeps the newest answer when an older one arrives late", async () => {
    let releaseSlow: (value: unknown) => void = () => undefined;
    mocks.getEarningsMetrics
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSlow = resolve;
          })
      )
      .mockResolvedValueOnce({ totals: TOTALS });
    const earnings = useCreatorEarnings();
    const slow = earnings.load();
    await earnings.load();
    releaseSlow({ totals: { ...TOTALS, totalEarnings: 1 } });
    await slow;
    expect(earnings.state.value).toEqual({ status: "ready", totals: TOTALS });
  });
});
