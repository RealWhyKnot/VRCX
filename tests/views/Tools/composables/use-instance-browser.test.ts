import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { effectScope, nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  discoverInstances: vi.fn<(query: string) => Promise<unknown>>(),
  getActiveInstances: vi.fn<(params: { n: number; offset: number }) => Promise<unknown>>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("../../../../src/api/instance", () => ({
  instanceRequest: { discoverInstances: mocks.discoverInstances, getActiveInstances: mocks.getActiveInstances },
}));
vi.mock("../../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import { useInstanceBrowser } from "../../../../src/views/Tools/composables/use-instance-browser";

function rows(count: number, start = 0): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    worldId: "wrld_1",
    instanceId: String(start + i),
    location: `wrld_1:${String(start + i)}`,
    world: { name: `World ${String(start + i)}` },
  }));
}

function setup() {
  const scope = effectScope();
  const browser = scope.run(() => useInstanceBrowser());
  if (!browser) {
    throw new Error("composable did not start");
  }
  return { scope, browser };
}

describe("useInstanceBrowser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.discoverInstances.mockResolvedValue({ instances: rows(3) });
    mocks.getActiveInstances.mockResolvedValue(rows(2));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("loads discover results", async () => {
    const { scope, browser } = setup();
    await browser.refresh();
    expect(mocks.discoverInstances).toHaveBeenCalledWith("n=50&mode=active");
    expect(browser.instances.value).toHaveLength(3);
    expect(browser.isLoading.value).toBe(false);
    expect(browser.hasMore.value).toBe(false);
    scope.stop();
  });

  test("reloads once after a burst of filter changes", async () => {
    const { scope, browser } = setup();
    browser.filters.value.region = "eu";
    await nextTick();
    browser.filters.value.platform = "android";
    await nextTick();
    browser.setMinOccupants("20");
    await nextTick();
    expect(mocks.discoverInstances).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.discoverInstances).toHaveBeenCalledTimes(1);
    expect(mocks.discoverInstances).toHaveBeenCalledWith("n=50&mode=active&region=eu&platform=android&minOccupants=20");
    scope.stop();
  });

  test("stops a pending reload when the page goes away", async () => {
    const { scope, browser } = setup();
    browser.filters.value.region = "jp";
    await nextTick();
    scope.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.discoverInstances).not.toHaveBeenCalled();
  });

  test("keeps at most three vibes and ignores junk", () => {
    const { scope, browser } = setup();
    browser.setVibes(["a", 1, "b", null, "c", "d"]);
    expect(browser.filters.value.vibeIds).toEqual(["a", "b", "c"]);
    browser.setVibes("nope");
    expect(browser.filters.value.vibeIds).toEqual([]);
    scope.stop();
  });

  test("clamps the minimum people filter", () => {
    const { scope, browser } = setup();
    browser.setMinOccupants("999999999999");
    expect(browser.filters.value.minOccupants).toBe(500);
    browser.setMinOccupants("-4");
    expect(browser.filters.value.minOccupants).toBe(0);
    scope.stop();
  });

  test("pages through my open instances without repeats", async () => {
    const { scope, browser } = setup();
    browser.source.value = "mine";
    mocks.getActiveInstances.mockResolvedValueOnce(rows(50)).mockResolvedValueOnce([...rows(1, 49), ...rows(4, 50)]);
    await browser.refresh();
    expect(mocks.getActiveInstances).toHaveBeenLastCalledWith({ n: 50, offset: 0 });
    expect(browser.hasMore.value).toBe(true);
    await browser.loadMore();
    expect(mocks.getActiveInstances).toHaveBeenLastCalledWith({ n: 50, offset: 50 });
    expect(browser.instances.value).toHaveLength(54);
    expect(browser.hasMore.value).toBe(false);
    scope.stop();
  });

  test("shows a failure and clears stale rows", async () => {
    const { scope, browser } = setup();
    await browser.refresh();
    mocks.discoverInstances.mockRejectedValueOnce(new Error("offline"));
    await browser.refresh();
    expect(browser.hasLoadFailed.value).toBe(true);
    expect(browser.instances.value).toEqual([]);
    expect(browser.isLoading.value).toBe(false);
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  test("ignores a slow answer once a newer request has started", async () => {
    const { scope, browser } = setup();
    let releaseSlow: (value: unknown) => void = () => undefined;
    mocks.discoverInstances
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSlow = resolve;
          })
      )
      .mockResolvedValueOnce({ instances: rows(1, 100) });
    const slow = browser.refresh();
    await browser.refresh();
    releaseSlow({ instances: rows(5) });
    await slow;
    expect(browser.instances.value.map((instance) => instance.location)).toEqual(["wrld_1:100"]);
    scope.stop();
  });

  test("filters loaded rows by search text", async () => {
    const { scope, browser } = setup();
    await browser.refresh();
    browser.searchText.value = "world 2";
    expect(browser.visibleInstances.value.map((instance) => instance.location)).toEqual(["wrld_1:2"]);
    browser.resetFilters();
    expect(browser.searchText.value).toBe("");
    scope.stop();
  });
});
