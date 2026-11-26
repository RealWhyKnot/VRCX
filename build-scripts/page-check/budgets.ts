type Budgets = {
  hangTimeoutMs: number;
  freezeMaxMs: number;
  heartbeatMaxMs: number;
  settleTimeoutMs: number;
  bootTimeoutMs: number;
  windowMs: number;
  eventsPerSecond: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  busyFraction: number;
  mutationsPerSecond: number;
  visitHeapGrowthMb: number;
  remountCycles: number;
  remountGrowthMbPerCycle: number;
  soakMs: number;
  soakSampleMs: number;
  soakSlopeMbPerMinute: number;
};

type Mode = "smoke" | "soak";

const BUDGETS = {
  smoke: {
    hangTimeoutMs: 15000,
    freezeMaxMs: 2500,
    heartbeatMaxMs: 2000,
    settleTimeoutMs: 20000,
    bootTimeoutMs: 90000,
    windowMs: 3000,
    eventsPerSecond: 3,
    longTaskTotalMs: 2400,
    longTaskMaxMs: 1500,
    busyFraction: 0.85,
    mutationsPerSecond: 3000,
    visitHeapGrowthMb: 96,
    remountCycles: 3,
    remountGrowthMbPerCycle: 12,
    soakMs: 0,
    soakSampleMs: 0,
    soakSlopeMbPerMinute: 0,
  },
  soak: {
    hangTimeoutMs: 15000,
    freezeMaxMs: 2500,
    heartbeatMaxMs: 2000,
    settleTimeoutMs: 30000,
    bootTimeoutMs: 120000,
    windowMs: 3000,
    eventsPerSecond: 6,
    longTaskTotalMs: 2400,
    longTaskMaxMs: 1500,
    busyFraction: 0.85,
    mutationsPerSecond: 6000,
    visitHeapGrowthMb: 96,
    remountCycles: 5,
    remountGrowthMbPerCycle: 8,
    soakMs: 30000,
    soakSampleMs: 5000,
    soakSlopeMbPerMinute: 24,
  },
} as const satisfies Record<Mode, Budgets>;

export { BUDGETS };
export type { Budgets, Mode };
