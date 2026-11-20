import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DIALOG_INSTANCE_STALE_MS, createStaleInstanceRefresher } from "../../src/stores/instance-stale-refresh";

const TAG = "wrld_abc:12345";

describe("createStaleInstanceRefresher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("fetches an instance that was never cached", () => {
    const fetchInstance = vi.fn().mockResolvedValue({});
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh(TAG, undefined, "wrld_abc", "12345");
    expect(fetchInstance).toHaveBeenCalledWith({ worldId: "wrld_abc", instanceId: "12345" });
  });

  test("skips an instance fetched less than a minute ago", () => {
    const fetchInstance = vi.fn().mockResolvedValue({});
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh(TAG, new Date(Date.now() - 10_000).toJSON(), "wrld_abc", "12345");
    expect(fetchInstance).not.toHaveBeenCalled();
  });

  test("fetches an instance whose cached copy is stale", () => {
    const fetchInstance = vi.fn().mockResolvedValue({});
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh(TAG, new Date(Date.now() - DIALOG_INSTANCE_STALE_MS - 1000).toJSON(), "wrld_abc", "12345");
    expect(fetchInstance).toHaveBeenCalledTimes(1);
  });

  test("does not start a second fetch while the first is still running", () => {
    const fetchInstance = vi.fn().mockReturnValue(new Promise(() => undefined));
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh(TAG, undefined, "wrld_abc", "12345");
    refresh(TAG, undefined, "wrld_abc", "12345");
    expect(fetchInstance).toHaveBeenCalledTimes(1);
  });

  test("does not retry a failed fetch for a minute, then tries again", async () => {
    const fetchInstance = vi.fn().mockRejectedValue(new Error("blocked"));
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh(TAG, undefined, "wrld_abc", "12345");
    await vi.advanceTimersByTimeAsync(1000);
    refresh(TAG, undefined, "wrld_abc", "12345");
    expect(fetchInstance).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DIALOG_INSTANCE_STALE_MS);
    refresh(TAG, undefined, "wrld_abc", "12345");
    expect(fetchInstance).toHaveBeenCalledTimes(2);
  });

  test("ignores tags that are not real instances", () => {
    const fetchInstance = vi.fn().mockResolvedValue({});
    const refresh = createStaleInstanceRefresher(fetchInstance);
    refresh("private", undefined, "wrld_abc", "private");
    refresh("", undefined, "wrld_abc", "");
    expect(fetchInstance).not.toHaveBeenCalled();
  });
});
