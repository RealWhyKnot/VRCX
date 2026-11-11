type Budget = { burst: number; perSecond: number };

type Bucket = Budget & {
  tokens: number;
  updatedAt: number;
  basePerSecond: number;
  pausedUntil: number;
  strikes: number;
  tail: Promise<void>;
};

type LimiterOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  globalBudget?: Budget;
  budgetFor?: (group: string) => Budget;
};

export type LimiterSnapshot = { group: string; perSecond: number; pausedForMs: number; strikes: number }[];

const BASE_COOLDOWN_MS = 30000;
const MAX_COOLDOWN_MS = 300000;
const SLOWEST_SHARE = 0.125;
const RECOVERY_STEPS = 50;

const GLOBAL_BUDGET: Budget = { burst: 40, perSecond: 10 };
const READ_BUDGET: Budget = { burst: 15, perSecond: 5 };
const WRITE_BUDGET: Budget = { burst: 5, perSecond: 1 };
const SEEN_BUDGET: Budget = { burst: 3, perSecond: 2 };
const LOGIN_BUDGET: Budget = { burst: 20, perSecond: 5 };

const RATE_LIMIT_RETRIES = 2;

export function requestGroup(endpoint: string, method: string): string {
  const path = endpoint.split("?")[0] ?? "";
  if (path.endsWith("/see")) {
    return "seen";
  }
  const first = path.split("/").find((part) => part !== "") ?? "root";
  if (path.includes("auth/user/friends")) {
    return method === "GET" ? "read:friends" : "write:friends";
  }
  if (first === "auth" || first === "config") {
    return method === "GET" ? "login" : "login-write";
  }
  return method === "GET" ? `read:${first}` : `write:${first}`;
}

function defaultBudgetFor(group: string): Budget {
  if (group === "seen") {
    return SEEN_BUDGET;
  }
  if (group === "login") {
    return LOGIN_BUDGET;
  }
  return group.startsWith("read:") ? READ_BUDGET : WRITE_BUDGET;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function noop(): void {
  return undefined;
}

export function createRequestLimiter(options: LimiterOptions = {}) {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const budgetFor = options.budgetFor ?? defaultBudgetFor;
  const buckets = new Map<string, Bucket>();

  function makeBucket(budget: Budget): Bucket {
    return {
      ...budget,
      tokens: budget.burst,
      updatedAt: now(),
      basePerSecond: budget.perSecond,
      pausedUntil: 0,
      strikes: 0,
      tail: Promise.resolve(),
    };
  }

  const globalBucket = makeBucket(options.globalBudget ?? GLOBAL_BUDGET);

  function bucketFor(group: string): Bucket {
    let bucket = buckets.get(group);
    if (!bucket) {
      bucket = makeBucket(budgetFor(group));
      buckets.set(group, bucket);
    }
    return bucket;
  }

  function refill(bucket: Bucket): void {
    const time = now();
    const elapsed = Math.max(0, time - bucket.updatedAt);
    bucket.tokens = Math.min(bucket.burst, bucket.tokens + (elapsed / 1000) * bucket.perSecond);
    bucket.updatedAt = time;
  }

  function waitFor(bucket: Bucket): number {
    const pause = bucket.pausedUntil - now();
    if (pause > 0) {
      return pause;
    }
    refill(bucket);
    if (bucket.tokens >= 1) {
      return 0;
    }
    return Math.ceil(((1 - bucket.tokens) / bucket.perSecond) * 1000);
  }

  async function acquire(bucket: Bucket): Promise<void> {
    let wait = Math.max(waitFor(bucket), waitFor(globalBucket));
    while (wait > 0) {
      await sleep(wait);
      wait = Math.max(waitFor(bucket), waitFor(globalBucket));
    }
    bucket.tokens -= 1;
    globalBucket.tokens -= 1;
  }

  function schedule<T>(group: string, fn: () => Promise<T>): Promise<T> {
    const bucket = bucketFor(group);
    const turn = bucket.tail.then(() => acquire(bucket));
    bucket.tail = turn.then(noop, noop);
    return turn.then(fn);
  }

  function reportRateLimited(group: string, retryAfterSeconds?: number): void {
    const bucket = bucketFor(group);
    const cooldown =
      retryAfterSeconds !== undefined && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** bucket.strikes);
    bucket.strikes += 1;
    bucket.pausedUntil = Math.max(bucket.pausedUntil, now() + cooldown);
    bucket.perSecond = Math.max(bucket.basePerSecond * SLOWEST_SHARE, bucket.perSecond / 2);
    bucket.tokens = 0;
    bucket.updatedAt = now();
  }

  function reportSuccess(group: string): void {
    const bucket = buckets.get(group);
    if (!bucket || bucket.perSecond >= bucket.basePerSecond) {
      return;
    }
    refill(bucket);
    bucket.strikes = 0;
    bucket.perSecond = Math.min(bucket.basePerSecond, bucket.perSecond + bucket.basePerSecond / RECOVERY_STEPS);
  }

  async function scheduleRetrying<T>(group: string, fn: () => Promise<T>, isRateLimited: (value: T) => boolean, retries = RATE_LIMIT_RETRIES): Promise<T> {
    const value = await schedule(group, fn);
    if (retries <= 0 || !isRateLimited(value)) {
      return value;
    }
    reportRateLimited(group);
    return scheduleRetrying(group, fn, isRateLimited, retries - 1);
  }

  function snapshot(): LimiterSnapshot {
    return [...buckets.entries()].map(([group, bucket]) => ({
      group,
      perSecond: bucket.perSecond,
      pausedForMs: Math.max(0, bucket.pausedUntil - now()),
      strikes: bucket.strikes,
    }));
  }

  return { schedule, scheduleRetrying, reportRateLimited, reportSuccess, snapshot };
}

export const requestLimiter = createRequestLimiter();
