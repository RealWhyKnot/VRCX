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
  vi.restoreAllMocks();
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

test("reads one badge by id and badges at a time, returning null or an empty list when none match", async () => {
  const latest = vi.fn(() => Promise.resolve(JSON.stringify([[8, "usr_me", "bdg_1", "t", '{"name":"Pioneer"}']])));
  const at = vi.fn(() => Promise.resolve("[]"));
  vi.stubGlobal("DatabaseApi", { GetLatestBadgeById: latest, GetBadgeHistoryAt: at });

  await expect(retainedEvents.getLatestBadgeById("bdg_1")).resolves.toEqual({
    id: 8,
    subject: "usr_me",
    detail: "bdg_1",
    createdAt: "t",
    data: { name: "Pioneer" },
  });
  expect(latest).toHaveBeenCalledWith("bdg_1");
  await expect(retainedEvents.getBadgeHistoryAt("t")).resolves.toEqual([]);
  expect(at).toHaveBeenCalledWith("t");
  latest.mockResolvedValueOnce("[]");
  await expect(retainedEvents.getLatestBadgeById("bdg_none")).resolves.toBeNull();
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

function queuedSubjects(payload: string): string[] {
  const data: unknown = JSON.parse(payload);
  if (!Array.isArray(data)) throw new Error("Expected history events");
  return data.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null || !("subject" in entry) || typeof entry.subject !== "string") {
      throw new Error("Expected a history subject");
    }
    return entry.subject;
  });
}

function queueBadge(subject: string): void {
  retainedEvents.queueRetainedEvent({ kind: "badge", subject, createdAt: "t", data: { badgeId: subject, action: "add" } });
}

test("isolates a permanent error and keeps later events moving", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  loginState.isLoggedIn = true;
  const saved: string[] = [];
  const append = vi.fn((_account: string, payload: string) => {
    const subjects = queuedSubjects(payload);
    if (subjects.includes("bad")) return Promise.reject(new Error("NOT NULL constraint failed"));
    saved.push(...subjects);
    return Promise.resolve();
  });
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, PruneRetainedEvents: () => Promise.resolve() });
  ["first", "bad", "last"].forEach(queueBadge);
  await vi.advanceTimersByTimeAsync(250);
  expect(saved).toEqual(["first", "last"]);
  queueBadge("later");
  await vi.advanceTimersByTimeAsync(250);
  expect(saved).toEqual(["first", "last", "later"]);
  const attempts = append.mock.calls.length;
  await vi.runAllTimersAsync();
  expect(append).toHaveBeenCalledTimes(attempts);
});

test.each([new Error("database is locked"), new Error("SQLITE_BUSY"), { code: 6 }, { resultCode: 517 }])(
  "retries transient errors without dropping events: %j",
  async (error) => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loginState.isLoggedIn = true;
    const append = vi.fn((_account: string, _payload: string) => Promise.resolve()).mockRejectedValueOnce(error);
    vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, PruneRetainedEvents: () => Promise.resolve() });
    queueBadge("retry");
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(4999);
    expect(append).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(append).toHaveBeenCalledTimes(2);
    expect(append.mock.calls[1]).toEqual(append.mock.calls[0]);
    await vi.runAllTimersAsync();
  }
);

test("retries a singleton before treating its failure as permanent", async () => {
  vi.useFakeTimers();
  loginState.isLoggedIn = true;
  const append = vi.fn((_account: string, _payload: string) => Promise.resolve()).mockRejectedValueOnce(new Error("One failed call"));
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, PruneRetainedEvents: () => Promise.resolve() });
  queueBadge("retry_once");
  await vi.advanceTimersByTimeAsync(250);
  expect(append).toHaveBeenCalledTimes(2);
  expect(append.mock.calls[1]).toEqual(append.mock.calls[0]);
  await vi.runAllTimersAsync();
});

test("a transient failure during isolation retries only the unwritten suffix", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  loginState.isLoggedIn = true;
  const saved: string[] = [];
  let isBusy = true;
  const append = vi.fn((_account: string, payload: string) => {
    const subjects = queuedSubjects(payload);
    if (subjects.includes("bad")) return Promise.reject(new Error("Unknown kind"));
    if (subjects.includes("last") && isBusy) {
      isBusy = false;
      return Promise.reject(new Error("database table is locked"));
    }
    saved.push(...subjects);
    return Promise.resolve();
  });
  vi.stubGlobal("DatabaseApi", { AppendRetainedEvents: append, PruneRetainedEvents: () => Promise.resolve() });
  ["first", "bad", "last", "later"].forEach(queueBadge);
  await vi.advanceTimersByTimeAsync(250);
  expect(saved).toEqual(["first"]);
  await vi.advanceTimersByTimeAsync(5000);
  expect(saved).toEqual(["first", "last", "later"]);
  await vi.runAllTimersAsync();
});
