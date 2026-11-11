import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  seeNotification: vi.fn<(params: { notificationId: string }) => Promise<unknown>>(),
  seeNotificationV2: vi.fn<(params: { notificationId: string }) => Promise<{ json: Record<string, unknown> }>>(),
}));

vi.mock("../../../src/api/notification", () => ({
  notificationRequest: { seeNotification: mocks.seeNotification, seeNotificationV2: mocks.seeNotificationV2 },
}));

import { createSeenQueue } from "../../../src/stores/notification/seen-queue";
import type { SeenQueueDeps } from "../../../src/stores/notification/seen-queue";

function rateLimitError(): Error & { status: number } {
  return Object.assign(new Error("slow down"), { status: 429 });
}

function setup(rows: { id: string; version: number }[]) {
  const handleNotificationSee = vi.fn<(id: string) => void>();
  const handleNotificationV2Update = vi.fn<SeenQueueDeps["handleNotificationV2Update"]>();
  const handleNotificationV2Hide = vi.fn<(id: string) => void>();
  const removeNotify = vi.fn<(name: string) => void>();
  const unseenNotifications = ref(rows.map((row) => row.id));
  const deps: SeenQueueDeps = {
    notificationTable: ref({ data: rows }),
    unseenNotifications,
    uiStore: { removeNotify },
    handleNotificationSee,
    handleNotificationV2Update,
    handleNotificationV2Hide,
  };
  const queue = createSeenQueue(deps);
  return { queue, unseenNotifications, handleNotificationSee, handleNotificationV2Update, handleNotificationV2Hide, removeNotify };
}

describe("notification seen queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.seeNotification.mockResolvedValue({});
    mocks.seeNotificationV2.mockResolvedValue({ json: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("marks every unseen notification once, one at a time", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `not_${String(i)}`, version: 1 }));
    const { queue, unseenNotifications, handleNotificationSee, removeNotify } = setup(rows);
    let inFlight = 0;
    let mostInFlight = 0;
    mocks.seeNotification.mockImplementation(async () => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return {};
    });

    queue.markAllAsSeen();
    queue.markAllAsSeen();
    await vi.runAllTimersAsync();

    expect(mocks.seeNotification).toHaveBeenCalledTimes(200);
    expect(handleNotificationSee).toHaveBeenCalledTimes(200);
    expect(mostInFlight).toBe(1);
    expect(unseenNotifications.value).toEqual([]);
    expect(removeNotify).toHaveBeenCalledWith("notification");
  });

  test("uses the newer endpoint for version 2 notifications", async () => {
    const { queue, handleNotificationV2Update } = setup([{ id: "not_v2", version: 2 }]);

    queue.queueMarkAsSeen("not_v2", 2);
    await vi.runAllTimersAsync();

    expect(mocks.seeNotificationV2).toHaveBeenCalledWith({ notificationId: "not_v2" });
    expect(handleNotificationV2Update).toHaveBeenCalledWith({ params: { notificationId: "not_v2" }, json: { seen: true } });
  });

  test("keeps a rate-limited notification so it can be marked later", async () => {
    const { queue, handleNotificationV2Hide } = setup([{ id: "not_v2", version: 2 }]);
    mocks.seeNotificationV2.mockRejectedValue(rateLimitError());

    queue.queueMarkAsSeen("not_v2", 2);
    await vi.runAllTimersAsync();

    expect(mocks.seeNotificationV2).toHaveBeenCalledTimes(1);
    expect(handleNotificationV2Hide).not.toHaveBeenCalled();

    mocks.seeNotificationV2.mockResolvedValue({ json: {} });
    queue.queueMarkAsSeen("not_v2", 2);
    await vi.runAllTimersAsync();

    expect(mocks.seeNotificationV2).toHaveBeenCalledTimes(2);
  });

  test("hides a version 2 notification that fails for another reason", async () => {
    const { queue, handleNotificationV2Hide } = setup([{ id: "not_gone", version: 2 }]);
    mocks.seeNotificationV2.mockRejectedValue(Object.assign(new Error("gone"), { status: 404 }));

    queue.queueMarkAsSeen("not_gone", 2);
    await vi.runAllTimersAsync();

    expect(mocks.seeNotificationV2).toHaveBeenCalledTimes(1);
    expect(handleNotificationV2Hide).toHaveBeenCalledWith("not_gone");
  });
});
