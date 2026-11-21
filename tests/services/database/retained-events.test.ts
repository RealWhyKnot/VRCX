import { afterEach, expect, test, vi } from "vitest";

const { dbVars, run, rows, watchState } = vi.hoisted(() => ({
  dbVars: { userId: "usr_first" },
  watchState: { isLoggedIn: true, isFriendsLoaded: false },
  run: (call: Promise<void>) => call,
  rows: async (call: Promise<string>): Promise<unknown[][]> => {
    const decoded: unknown = JSON.parse(await call);
    return Array.isArray(decoded) ? decoded.filter(Array.isArray) : [];
  },
}));

vi.mock("../../../src/services/database/index.ts", () => ({ dbVars }));
vi.mock("../../../src/services/watch-state", async () => {
  const { reactive } = await import("vue");
  return { watchState: reactive(watchState) };
});
vi.mock("../../../src/services/sqlite.ts", () => ({ sqliteService: { run, rows } }));

import { retainedEvents } from "../../../src/services/database/retained-events";
import { watchState as loginState } from "../../../src/services/watch-state";

afterEach(() => {
  loginState.isLoggedIn = false;
  loginState.isFriendsLoaded = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("batches observations by their original account and delays pruning", async () => {
  vi.useFakeTimers();
  const append = vi.fn((_account: string, _payload: string) => Promise.resolve());
  const prune = vi.fn(() => Promise.resolve());
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, PruneRetainedEvents: prune });

  const event = {
    kind: "avatar" as const,
    subject: "usr_player",
    createdAt: "2026-11-20T02:00:00Z",
    data: { avatarName: "Avatar", displayName: "Player", location: "room", source: "photon" as const },
  };
  for (let index = 0; index < 5; index += 1) {
    retainedEvents.queueRetainedEvent(event);
  }
  dbVars.userId = "usr_second";
  retainedEvents.queueRetainedEvent(event, "usr_first");
  retainedEvents.queueRetainedEvent(event);

  expect(append).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(249);
  expect(append).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(10);
  expect(append.mock.calls).toEqual([
    ["usr_first", JSON.stringify(Array.from({ length: 4 }, () => event))],
    ["usr_first", JSON.stringify([event])],
    ["usr_second", JSON.stringify([event])],
  ]);
  expect(prune).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2500);
  expect(prune).toHaveBeenCalledOnce();
});

test("passes page bounds through the bridge and decodes history payloads", async () => {
  const history = vi.fn(() => Promise.resolve(JSON.stringify([[7, "usr_player", "bio", "t", '"Hello"']])));
  vi.stubGlobal("DatabaseApi", { GetProfileHistory: history });

  await expect(retainedEvents.getProfileHistory("usr_player", 25, 12)).resolves.toEqual([
    { id: 7, subject: "usr_player", detail: "bio", createdAt: "t", data: "Hello" },
  ]);
  expect(history).toHaveBeenCalledWith("usr_player", 12, 25);
});

test("queues one baseline per profile after the friends list and only subsequent changed fields", async () => {
  vi.useFakeTimers();
  const append = vi.fn((_account: string, _payload: string) => Promise.resolve());
  const baselines = vi.fn(() => Promise.resolve("[]"));
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, GetRetainedProfileBaselines: baselines, PruneRetainedEvents: () => Promise.resolve() });
  let runIdle: IdleRequestCallback | undefined;
  vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
    runIdle = callback;
    return 1;
  });
  const idle = { didTimeout: false, timeRemaining: () => 50 };
  dbVars.userId = "usr_profiles";
  loginState.isLoggedIn = true;
  vi.setSystemTime(new Date("2026-11-20T02:00:00Z"));

  retainedEvents.observeRetainedProfile({ id: "usr_player", bio: "Original", tags: ["two", "one"] });
  retainedEvents.observeRetainedProfile({ id: "usr_player", bio: "Original", tags: ["one", "two", "one"] });
  await vi.advanceTimersByTimeAsync(1000);
  expect(runIdle).toBeUndefined();
  expect(baselines).not.toHaveBeenCalled();
  expect(append).not.toHaveBeenCalled();

  loginState.isFriendsLoaded = true;
  await vi.advanceTimersByTimeAsync(0);
  expect(runIdle).toBeDefined();
  expect(baselines).not.toHaveBeenCalled();
  expect(append).not.toHaveBeenCalled();
  runIdle?.(idle);
  await vi.advanceTimersByTimeAsync(250);
  expect(baselines).toHaveBeenCalledExactlyOnceWith("usr_profiles", '["usr_player"]');
  expect(append.mock.calls).toEqual([
    [
      "usr_profiles",
      JSON.stringify([{ kind: "profile", subject: "usr_player", createdAt: "2026-11-20T02:00:00.000Z", data: { bio: "Original", tags: ["one", "two"] } }]),
    ],
  ]);

  vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
  retainedEvents.observeRetainedProfile({ id: "usr_player", tags: ["two", "one"] });
  retainedEvents.observeRetainedProfile({ id: "usr_player", bio: "", pronouns: "they/them" });
  retainedEvents.observeRetainedProfile({ id: "usr_player", bio: "", pronouns: "they/them", tags: ["one", "two"] });
  await vi.advanceTimersByTimeAsync(250);
  expect(baselines).toHaveBeenCalledTimes(1);
  expect(append.mock.lastCall).toEqual([
    "usr_profiles",
    JSON.stringify([{ kind: "profile", subject: "usr_player", createdAt: "2026-11-20T03:00:00.000Z", data: { bio: "", pronouns: "they/them" } }]),
  ]);
  expect(append).toHaveBeenCalledTimes(2);
});

test("skips stored values at login and batches unseen users after login", async () => {
  vi.useFakeTimers();
  const append = vi.fn((_account: string, _payload: string) => Promise.resolve());
  const baselines = vi.fn(() => Promise.resolve("[]"));
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, GetRetainedProfileBaselines: baselines, PruneRetainedEvents: () => Promise.resolve() });
  const idles: IdleRequestCallback[] = [];
  vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => idles.push(callback));
  const idle = { didTimeout: false, timeRemaining: () => 50 };
  dbVars.userId = "usr_returning";
  loginState.isLoggedIn = true;
  loginState.isFriendsLoaded = false;
  vi.setSystemTime(new Date("2026-11-20T04:00:00Z"));

  retainedEvents.observeRetainedProfile({ id: "usr_friend", bio: "Stored", tags: ["two", "one"] });
  loginState.isFriendsLoaded = true;
  await vi.advanceTimersByTimeAsync(0);
  baselines.mockResolvedValueOnce(JSON.stringify([["usr_friend", '"Stored"', null, '["one","two"]']]));
  idles.shift()?.(idle);
  await vi.advanceTimersByTimeAsync(250);
  expect(baselines).toHaveBeenNthCalledWith(1, "usr_returning", '["usr_friend"]');
  expect(append).not.toHaveBeenCalled();

  const { promise, resolve } = Promise.withResolvers<string>();
  baselines.mockReturnValueOnce(promise);
  retainedEvents.observeRetainedProfile({ id: "usr_stranger", pronouns: "they/them" });
  retainedEvents.observeRetainedProfile({ id: "usr_other", bio: "Existing" });
  idles.shift()?.(idle);
  expect(baselines).toHaveBeenNthCalledWith(2, "usr_returning", '["usr_stranger","usr_other"]');
  retainedEvents.observeRetainedProfile({ id: "usr_stranger", pronouns: "" });
  resolve(
    JSON.stringify([
      ["usr_stranger", null, '"they/them"', null],
      ["usr_other", '"Existing"', null, null],
    ])
  );
  await vi.advanceTimersByTimeAsync(250);
  expect(append.mock.calls).toEqual([
    ["usr_returning", JSON.stringify([{ kind: "profile", subject: "usr_stranger", createdAt: "2026-11-20T04:00:00.250Z", data: { pronouns: "" } }])],
  ]);

  retainedEvents.observeRetainedProfile({ id: "usr_other", bio: "Existing" });
  retainedEvents.observeRetainedProfile({ id: "usr_stranger", pronouns: "" });
  await vi.advanceTimersByTimeAsync(250);
  expect(idles).toHaveLength(0);
  expect(baselines).toHaveBeenCalledTimes(2);
  expect(append).toHaveBeenCalledTimes(1);
});
