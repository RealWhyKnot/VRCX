import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  getBool: vi.fn<(key: string, isFallback: boolean) => Promise<boolean>>(),
  setBool: vi.fn<(key: string, isValue: boolean) => Promise<void>>(),
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("../../src/stores/modal", () => ({
  useModalStore: () => ({}),
}));

vi.mock("../../src/stores/vr", () => ({
  useVrStore: () => ({}),
}));

vi.mock("../../src/services/config", () => ({
  configRepository: {
    getString: vi.fn((_key: string, fallback: string) => Promise.resolve(fallback)),
    getBool: (key: string, isFallback: boolean) => mocks.getBool(key, isFallback),
    setBool: (key: string, isValue: boolean) => mocks.setBool(key, isValue),
  },
}));

import { useNotificationsSettingsStore } from "../../src/stores/settings/notifications";

describe("queue ready alarm setting", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getBool.mockReset();
    mocks.getBool.mockImplementation((_key, isFallback) => Promise.resolve(isFallback));
    mocks.setBool.mockReset();
    mocks.setBool.mockResolvedValue(undefined);
  });

  test("defaults to off", async () => {
    const store = useNotificationsSettingsStore();
    await vi.waitFor(() => {
      expect(mocks.getBool).toHaveBeenCalledWith("VRCX_queueReadyAlarm", false);
    });

    expect(store.queueReadyAlarm).toBe(false);
  });

  test("loads the saved value", async () => {
    mocks.getBool.mockImplementation((key, isFallback) => Promise.resolve(key === "VRCX_queueReadyAlarm" ? true : isFallback));

    const store = useNotificationsSettingsStore();

    await vi.waitFor(() => {
      expect(store.queueReadyAlarm).toBe(true);
    });
  });

  test("toggling saves the new value", () => {
    const store = useNotificationsSettingsStore();

    store.setQueueReadyAlarm();
    expect(store.queueReadyAlarm).toBe(true);
    expect(mocks.setBool).toHaveBeenLastCalledWith("VRCX_queueReadyAlarm", true);

    store.setQueueReadyAlarm();
    expect(store.queueReadyAlarm).toBe(false);
    expect(mocks.setBool).toHaveBeenLastCalledWith("VRCX_queueReadyAlarm", false);
  });
});
