import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getImpostorQueueStats: vi.fn<() => Promise<unknown>>(),
  toastSuccess: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("vue-sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("../../src/api/avatar", () => ({ avatarRequest: { getImpostorQueueStats: mocks.getImpostorQueueStats } }));
vi.mock("../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../src/plugins/i18n", () => ({
  i18n: { global: { t: (key: string, params?: { minutes: number }) => (params ? `${key}:${String(params.minutes)}` : key) } },
}));

import { announceImpostorQueued, impostorWaitMinutes } from "../../src/coordinators/impostor-queue-coordinator";

describe("impostorWaitMinutes", () => {
  test.each([
    [{ estimatedServiceDurationSeconds: 59 }, 1],
    [{ estimatedServiceDurationSeconds: 60 }, 1],
    [{ estimatedServiceDurationSeconds: 61 }, 2],
    [{ estimatedServiceDurationSeconds: 5400 }, 90],
    [{ estimatedServiceDurationSeconds: 1e15 }, 10080],
    [{ estimatedServiceDurationSeconds: 0 }, 0],
    [{ estimatedServiceDurationSeconds: -30 }, 0],
    [{ estimatedServiceDurationSeconds: "120" }, 0],
    [{ estimatedServiceDurationSeconds: Number.NaN }, 0],
    [{}, 0],
    [null, 0],
    ["text", 0],
  ])("%j gives %s", (stats, expected) => {
    expect(impostorWaitMinutes(stats)).toBe(expected);
  });
});

describe("announceImpostorQueued", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("says how long the queue is", async () => {
    mocks.getImpostorQueueStats.mockResolvedValue({ estimatedServiceDurationSeconds: 300 });
    await announceImpostorQueued();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.avatar.impostor_queued_wait:5");
  });

  test("uses the plain message when the queue has no estimate", async () => {
    mocks.getImpostorQueueStats.mockResolvedValue({ estimatedServiceDurationSeconds: 0 });
    await announceImpostorQueued();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.avatar.impostor_queued");
  });

  test("still confirms when the queue lookup fails", async () => {
    mocks.getImpostorQueueStats.mockRejectedValue(new Error("offline"));
    await announceImpostorQueued();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.avatar.impostor_queued");
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });
});
