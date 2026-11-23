import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flashWindow: vi.fn<() => Promise<void>>(),
  logFailureHandler: vi.fn<(error: unknown) => void>(),
  logFailure: vi.fn<(message: string) => (error: unknown) => void>(),
}));

vi.mock("vue-sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("../../src/api/instance", () => ({
  instanceRequest: { getInstance: vi.fn() },
}));

vi.mock("../../src/stores/log-failure", () => ({
  logFailure: (message: string) => mocks.logFailure(message),
}));

import { createInstanceQueue, playQueueReadyChime } from "../../src/stores/instance-queue";
import type { CreateInstanceQueueDeps } from "../../src/stores/instance-queue";

type FakeNode = { connect: ReturnType<typeof vi.fn> };

function installAudioContext() {
  const oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const close = vi.fn(() => Promise.resolve());
  class FakeAudioContext {
    currentTime = 10;
    destination = {};
    close = close;
    createOscillator() {
      const node = { frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null, connect: vi.fn() };
      oscillators.push(node);
      return node;
    }
    createGain(): FakeNode & { gain: { value: number } } {
      return { gain: { value: 0 }, connect: vi.fn() };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return { oscillators, close };
}

const DEP_KEYS = [
  "notificationStore",
  "uiStore",
  "notificationsSettingsStore",
  "sharedFeedStore",
  "cachedGroupOf",
  "queuedInstances",
  "t",
] as const satisfies readonly (keyof CreateInstanceQueueDeps)[];

function isQueueDeps(value: object): value is CreateInstanceQueueDeps {
  return DEP_KEYS.every((key) => key in value);
}

function makeQueue(isQueueReadyAlarm: boolean) {
  const notificationRows: unknown[] = [];
  const deps = {
    notificationStore: {
      notificationTable: { filters: [{ value: [] }], data: notificationRows },
      queueNotificationNoty: vi.fn(),
    },
    uiStore: { notifyMenu: vi.fn() },
    notificationsSettingsStore: { queueReadyAlarm: isQueueReadyAlarm },
    sharedFeedStore: { addEntry: vi.fn().mockResolvedValue(undefined) },
    cachedGroupOf: vi.fn(() => undefined),
    queuedInstances: new Map(),
    t: vi.fn((key: string) => key),
  };
  if (!isQueueDeps(deps)) {
    throw new Error("invalid deps");
  }
  return { queue: createInstanceQueue(deps), notificationRows };
}

describe("playQueueReadyChime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("plays 880 Hz then 1320 Hz for 0.15 s each and closes the context afterwards", () => {
    const { oscillators, close } = installAudioContext();

    playQueueReadyChime();

    expect(oscillators.map((o) => o.frequency.value)).toEqual([880, 1320]);
    expect(oscillators[0]?.start).toHaveBeenCalledWith(10);
    expect(oscillators[0]?.stop).toHaveBeenCalledWith(10.15);
    expect(oscillators[1]?.start).toHaveBeenCalledWith(10.15);
    expect(oscillators[1]?.stop).toHaveBeenCalledWith(10.3);
    expect(close).not.toHaveBeenCalled();
    oscillators[1]?.onended?.();
    expect(close).toHaveBeenCalledOnce();
  });

  test("closes once when the fallback timer fires before the tone ends", () => {
    vi.useFakeTimers();
    try {
      const { oscillators, close } = installAudioContext();

      playQueueReadyChime();
      vi.advanceTimersByTime(1000);
      expect(close).toHaveBeenCalledOnce();
      oscillators[1]?.onended?.();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  test("cancels the fallback timer when the tone ends", () => {
    vi.useFakeTimers();
    try {
      const { oscillators, close } = installAudioContext();

      playQueueReadyChime();
      oscillators[1]?.onended?.();
      vi.advanceTimersByTime(2000);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  test("does nothing when AudioContext is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);

    expect(() => {
      playQueueReadyChime();
    }).not.toThrow();
  });

  test("swallows constructor errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("AudioContext", function BlockedAudioContext() {
      throw new Error("blocked");
    });

    expect(() => {
      playQueueReadyChime();
    }).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test("closes the context when scheduling a tone fails", () => {
    const close = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0;
        close = close;
        createOscillator() {
          throw new Error("no oscillator");
        }
      }
    );

    expect(() => {
      playQueueReadyChime();
    }).not.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("instanceQueueReady alarm", () => {
  beforeEach(() => {
    mocks.flashWindow.mockReset();
    mocks.flashWindow.mockResolvedValue(undefined);
    mocks.logFailureHandler.mockReset();
    mocks.logFailure.mockReset();
    mocks.logFailure.mockReturnValue(mocks.logFailureHandler);
    vi.stubGlobal("AppApi", { FlashWindow: mocks.flashWindow });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("chimes and flashes the window when the alarm is enabled", () => {
    const { oscillators } = installAudioContext();
    const { queue, notificationRows } = makeQueue(true);

    queue.instanceQueueReady("wrld_abc:123");

    expect(notificationRows).toHaveLength(1);
    expect(oscillators).toHaveLength(2);
    expect(mocks.flashWindow).toHaveBeenCalledOnce();
  });

  test("stays silent when the alarm is disabled", () => {
    const { oscillators } = installAudioContext();
    const { queue, notificationRows } = makeQueue(false);

    queue.instanceQueueReady("wrld_abc:123");

    expect(notificationRows).toHaveLength(1);
    expect(oscillators).toHaveLength(0);
    expect(mocks.flashWindow).not.toHaveBeenCalled();
  });

  test("still flashes the window without AudioContext", () => {
    vi.stubGlobal("AudioContext", undefined);
    const { queue } = makeQueue(true);

    expect(() => {
      queue.instanceQueueReady("wrld_abc:123");
    }).not.toThrow();
    expect(mocks.flashWindow).toHaveBeenCalledOnce();
  });

  test("logs a rejected FlashWindow without throwing", async () => {
    installAudioContext();
    const failure = new Error("flash failed");
    mocks.flashWindow.mockRejectedValue(failure);
    const { queue } = makeQueue(true);

    expect(() => {
      queue.instanceQueueReady("wrld_abc:123");
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(mocks.logFailureHandler).toHaveBeenCalledWith(failure);
    });
    expect(mocks.logFailure).toHaveBeenCalledWith("Flashing the window failed:");
  });
});
