import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const { getBool, getString } = vi.hoisted(() => ({
  getBool: vi.fn<(key: string, isEnabledByDefault?: boolean | null) => Promise<boolean | null>>(),
  getString: vi.fn<(key: string, defaultValue?: string | null) => Promise<string | null>>(),
}));

vi.mock("../../src/services/config.ts", () => ({
  configRepository: {
    getBool,
    getString,
  },
}));

import { useGameStore } from "../../src/stores/game";

describe("useGameStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getBool.mockResolvedValue(true);
    getString.mockImplementation((key, defaultValue) => {
      if (key === "VRCX_lastGameSessionMs") {
        return Promise.resolve("7200000");
      }
      if (key === "VRCX_lastGameOfflineAt") {
        return Promise.resolve("1700000000000");
      }
      return Promise.resolve(defaultValue ?? null);
    });
  });

  test("loads persisted last session data during init", async () => {
    const store = useGameStore();

    await vi.waitFor(() => {
      expect(store.isGameNoVR).toBe(true);
      expect(store.lastSessionDurationMs).toBe(7200000);
      expect(store.lastOfflineAt).toBe(1700000000000);
    });
  });

  test("setLastSession updates session values", () => {
    const store = useGameStore();

    store.setLastSession(15000, 25000);

    expect(store.lastSessionDurationMs).toBe(15000);
    expect(store.lastOfflineAt).toBe(25000);
  });
});
