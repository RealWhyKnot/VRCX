import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const settings = vi.hoisted(() => ({
  recentActionCooldownEnabled: true,
  recentActionCooldownMinutes: 1,
}));

vi.mock("../../src/stores/settings/general", () => ({
  useGeneralSettingsStore: () => settings,
}));

vi.mock("worker-timers", () => ({
  get setInterval() {
    return globalThis.setInterval;
  },
  get clearInterval() {
    return globalThis.clearInterval;
  },
}));

type RecentActions = typeof import("../../src/composables/use-recent-actions");

function storedKeys(): string[] {
  const raw = localStorage.getItem("VRCX_recentActions");
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  return typeof parsed === "object" && parsed !== null ? Object.keys(parsed) : [];
}

describe("use-recent-actions", () => {
  let actions: RecentActions;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
    settings.recentActionCooldownEnabled = true;
    settings.recentActionCooldownMinutes = 1;
    actions = await import("../../src/composables/use-recent-actions");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("reports an action as recent until the cooldown ends", () => {
    actions.recordRecentAction("usr_1", "Invite");
    expect(actions.isActionRecent("usr_1", "Invite")).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(actions.isActionRecent("usr_1", "Invite")).toBe(false);
  });

  test("ignores actions that are not tracked", () => {
    actions.recordRecentAction("usr_1", "Unfriend");
    expect(actions.isActionRecent("usr_1", "Unfriend")).toBe(false);
  });

  test("purges expired entries without anyone asking about them", async () => {
    actions.recordRecentAction("usr_1", "Invite");
    actions.recordRecentAction("usr_2", "Request Invite");
    await vi.advanceTimersByTimeAsync(100_000);
    expect(storedKeys()).toEqual([]);
  });

  test("keeps entries that are still inside the cooldown", async () => {
    actions.recordRecentAction("usr_1", "Invite");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(storedKeys()).toEqual(["usr_1:Invite"]);
  });
});
