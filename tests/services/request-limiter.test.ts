import { describe, expect, test, vi } from "vitest";

import { createRequestLimiter, requestGroup } from "../../src/services/request-limiter";

function setup(budget = { burst: 2, perSecond: 1 }) {
  let clock = 0;
  const starts: number[] = [];
  const limiter = createRequestLimiter({
    now: () => clock,
    sleep: (ms) => {
      clock += ms;
      return Promise.resolve();
    },
    globalBudget: { burst: 1000, perSecond: 1000 },
    budgetFor: () => budget,
  });
  const run = (group = "seen") =>
    limiter.schedule(group, () => {
      starts.push(clock);
      return Promise.resolve(clock);
    });
  return {
    limiter,
    run,
    starts,
    advance: (ms: number) => {
      clock += ms;
    },
    time: () => clock,
  };
}

describe("request groups", () => {
  test("puts every mark-as-seen call in one group", () => {
    expect(requestGroup("auth/user/notifications/not_1/see", "PUT")).toBe("seen");
    expect(requestGroup("notifications/not_2/see", "POST")).toBe("seen");
  });

  test("separates reads from writes by the first path segment", () => {
    expect(requestGroup("users/usr_1", "GET")).toBe("read:users");
    expect(requestGroup("users/usr_1/moderations", "POST")).toBe("write:users");
    expect(requestGroup("/worlds/wrld_1?x=1", "GET")).toBe("read:worlds");
  });

  test("keeps login traffic apart from the rest", () => {
    expect(requestGroup("auth/user", "GET")).toBe("login");
    expect(requestGroup("config", "GET")).toBe("login");
    expect(requestGroup("auth/twofactorauth/totp/verify", "POST")).toBe("login-write");
  });
});

describe("request limiter", () => {
  test("lets a burst through and then spaces the rest", async () => {
    const { run, starts } = setup({ burst: 2, perSecond: 1 });

    await Promise.all([run(), run(), run(), run()]);

    expect(starts).toEqual([0, 0, 1000, 2000]);
  });

  test("runs queued calls in the order they were asked for", async () => {
    const { limiter } = setup({ burst: 1, perSecond: 10 });
    const order: number[] = [];

    await Promise.all([1, 2, 3, 4, 5].map((n) => limiter.schedule("seen", () => Promise.resolve(order.push(n)))));

    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  test("handles hundreds of queued calls without going over the rate", async () => {
    const { run, starts } = setup({ burst: 3, perSecond: 2 });

    await Promise.all(Array.from({ length: 500 }, () => run()));

    const last = starts.at(-1) ?? 0;
    expect(starts).toHaveLength(500);
    expect(last).toBeGreaterThanOrEqual(((500 - 3) / 2) * 1000 - 1);
    for (let i = 7; i < starts.length; i += 1) {
      expect((starts[i] ?? 0) - (starts[i - 7] ?? 0)).toBeGreaterThanOrEqual(2000);
    }
  });

  test("a failing call does not block the ones behind it", async () => {
    const { limiter, run } = setup();

    await expect(limiter.schedule("seen", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(run()).resolves.toBe(0);
  });

  test("pauses the group after a 429 and slows it down", async () => {
    const { limiter, run, starts } = setup({ burst: 2, perSecond: 2 });

    limiter.reportRateLimited("seen");
    await run();

    expect(starts[0]).toBeGreaterThanOrEqual(30000);
    expect(limiter.snapshot()).toEqual([expect.objectContaining({ group: "seen", perSecond: 1, strikes: 1 })]);
  });

  test("runs a rate limited call again after the pause", async () => {
    const { limiter, time } = setup({ burst: 2, perSecond: 2 });
    const answers = [429, 200];
    const call = vi.fn<() => Promise<number>>(() => Promise.resolve(answers.shift() ?? 200));

    await expect(limiter.scheduleRetrying("seen", call, (status) => status === 429)).resolves.toBe(200);

    expect(call).toHaveBeenCalledTimes(2);
    expect(time()).toBeGreaterThanOrEqual(30000);
  });

  test("gives up on a call that stays rate limited", async () => {
    const { limiter } = setup({ burst: 2, perSecond: 2 });
    const call = vi.fn<() => Promise<number>>(() => Promise.resolve(429));

    await expect(limiter.scheduleRetrying("seen", call, (status) => status === 429)).resolves.toBe(429);

    expect(call).toHaveBeenCalledTimes(3);
  });

  test("keeps the friends list out of the login group", () => {
    expect(requestGroup("auth/user/friends?offset=0", "GET")).toBe("read:friends");
    expect(requestGroup("auth/user/friends/usr_1", "DELETE")).toBe("write:friends");
    expect(requestGroup("auth/user", "GET")).toBe("login");
  });

  test("waits longer after each 429 in a row, up to five minutes", () => {
    const { limiter } = setup();

    limiter.reportRateLimited("seen");
    limiter.reportRateLimited("seen");
    expect(limiter.snapshot()[0]?.pausedForMs).toBe(60000);

    for (let i = 0; i < 10; i += 1) {
      limiter.reportRateLimited("seen");
    }
    expect(limiter.snapshot()[0]?.pausedForMs).toBe(300000);
    expect(limiter.snapshot()[0]?.perSecond).toBe(0.125);
  });

  test("uses the server's wait time when it gives one", () => {
    const { limiter } = setup();

    limiter.reportRateLimited("seen", 7);

    expect(limiter.snapshot()[0]?.pausedForMs).toBe(7000);
  });

  test("does not hold up other groups while one is paused", async () => {
    const { limiter, run, starts } = setup();

    limiter.reportRateLimited("seen");
    await run("read:users");

    expect(starts).toEqual([0]);
  });

  test("speeds back up as calls succeed", () => {
    const { limiter, advance } = setup({ burst: 2, perSecond: 2 });

    limiter.reportRateLimited("seen");
    advance(30000);
    for (let i = 0; i < 100; i += 1) {
      limiter.reportSuccess("seen");
    }

    expect(limiter.snapshot()[0]).toEqual(expect.objectContaining({ perSecond: 2, strikes: 0 }));
  });

  test("the shared budget caps traffic across groups", async () => {
    vi.useFakeTimers();
    const began = Date.now();
    const starts: number[] = [];
    const limiter = createRequestLimiter({
      globalBudget: { burst: 2, perSecond: 1 },
      budgetFor: () => ({ burst: 100, perSecond: 100 }),
    });
    const run = (group: string) =>
      limiter.schedule(group, () => {
        starts.push(Date.now() - began);
        return Promise.resolve();
      });

    const all = Promise.all([run("read:users"), run("read:worlds"), run("read:groups"), run("read:avatars")]);
    await vi.runAllTimersAsync();
    await all;
    vi.useRealTimers();

    expect(starts.filter((time) => time === 0)).toHaveLength(2);
    expect(starts.toSorted((a, b) => a - b)).toEqual([0, 0, 1000, 2000]);
  });
});
