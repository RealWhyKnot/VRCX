import { ref } from "vue";

import { marketplaceRequest } from "../../../api/marketplace";
import { logError } from "../../../stores/vrcx-messages";

const EARNINGS_RANGES = ["30d", "90d", "1y", "all"] as const;

export { EARNINGS_RANGES };

export type EarningsRange = (typeof EARNINGS_RANGES)[number];

export type EarningsTotals = {
  totalEarnings: number;
  otpEarnings: number;
  otpPurchaseCount: number;
  subscriberEarnings: number;
  subscriberMonths: number;
};

export type EarningsState = { status: "idle" } | { status: "loading" } | { status: "failed" } | { status: "ready"; totals: EarningsTotals };

const RANGE_DAYS = { "30d": 30, "90d": 90, "1y": 365 } as const satisfies Record<Exclude<EarningsRange, "all">, number>;
const DAY_MS = 24 * 60 * 60 * 1000;

function amount(source: object, key: keyof EarningsTotals): number {
  const value: unknown = Reflect.get(source, key);
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function isEarningsRange(value: unknown): value is EarningsRange {
  return EARNINGS_RANGES.some((range) => range === value);
}

export function parseEarningsTotals(json: unknown): EarningsTotals | undefined {
  if (typeof json !== "object" || json === null || !("totals" in json)) {
    return undefined;
  }
  const totals = json.totals;
  if (typeof totals !== "object" || totals === null) {
    return undefined;
  }
  return {
    totalEarnings: amount(totals, "totalEarnings"),
    otpEarnings: amount(totals, "otpEarnings"),
    otpPurchaseCount: amount(totals, "otpPurchaseCount"),
    subscriberEarnings: amount(totals, "subscriberEarnings"),
    subscriberMonths: amount(totals, "subscriberMonths"),
  };
}

export function earningsQuery(range: EarningsRange, now: Date): { metricDateStart?: string; metricDateEnd?: string } {
  if (range === "all") {
    return {};
  }
  return {
    metricDateStart: new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS).toISOString(),
    metricDateEnd: now.toISOString(),
  };
}

export function useCreatorEarnings() {
  const range = ref<EarningsRange>("30d");
  const state = ref<EarningsState>({ status: "idle" });
  let latest = 0;

  async function load(): Promise<void> {
    latest += 1;
    const ticket = latest;
    state.value = { status: "loading" };
    try {
      const totals = parseEarningsTotals(await marketplaceRequest.getEarningsMetrics(earningsQuery(range.value, new Date())));
      if (ticket === latest) {
        state.value = totals ? { status: "ready", totals } : { status: "failed" };
      }
    } catch (err) {
      if (ticket === latest) {
        state.value = { status: "failed" };
      }
      logError(err);
    }
  }

  function setRange(value: unknown): Promise<void> {
    if (isEarningsRange(value)) {
      range.value = value;
    }
    return load();
  }

  return { range, state, load, setRange };
}
