import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userStore: {
    currentUser: {
      id: "usr_test",
      badges: [{ badgeId: "bdg_old", badgeName: "Early Supporter" }],
    },
  },
  queueGameLogNoty: vi.fn<(entry: unknown) => void>(),
  addGameLog: vi.fn<(entry: unknown) => void>(),
  addGamelogEventToDatabase: vi.fn<(entry: unknown) => Promise<unknown>>(),
  queueRetainedEvent: vi.fn<(event: unknown) => void>(),
  getCurrentUser: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("../../src/stores/user", () => ({ useUserStore: () => mocks.userStore }));
vi.mock("../../src/stores/notification", () => ({ useNotificationStore: () => ({ queueGameLogNoty: mocks.queueGameLogNoty }) }));
vi.mock("../../src/stores/gameLog", () => ({ useGameLogStore: () => ({ addGameLog: mocks.addGameLog }) }));
vi.mock("../../src/services/database", () => ({
  database: { addGamelogEventToDatabase: mocks.addGamelogEventToDatabase, queueRetainedEvent: mocks.queueRetainedEvent },
}));
vi.mock("../../src/coordinators/user-coordinator", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { badgeEventMessage, runBadgeEventFlow } from "../../src/coordinators/badge-event-coordinator";

describe("badge events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addGamelogEventToDatabase.mockImplementation((entry) => Promise.resolve(entry));
    mocks.getCurrentUser.mockResolvedValue(undefined);
  });

  test("names the badge that was assigned", () => {
    const message = badgeEventMessage("user-badge-assigned", { badge: { badgeId: "bdg_new", badgeName: "Pioneer" } });
    expect(message).toBe("Badge earned: Pioneer");
  });

  test("falls back to the badge id when the name is missing", () => {
    expect(badgeEventMessage("user-badge-assigned", { badge: { badgeId: "bdg_new" } })).toBe("Badge earned: bdg_new");
  });

  test("looks up the name of a removed badge among the ones the user holds", () => {
    expect(badgeEventMessage("user-badge-unassigned", { badgeId: "bdg_old" })).toBe("Badge removed: Early Supporter");
    expect(badgeEventMessage("user-badge-unassigned", { badgeId: "bdg_unknown" })).toBe("Badge removed: bdg_unknown");
  });

  test("ignores a payload with no badge in it", () => {
    expect(badgeEventMessage("user-badge-assigned", { badge: "nope" })).toBeUndefined();
    expect(badgeEventMessage("user-badge-unassigned", {})).toBeUndefined();
  });

  test("logs the event, notifies and refreshes the current user", async () => {
    await runBadgeEventFlow("user-badge-assigned", {
      badge: { badgeId: "bdg_new", badgeName: "Pioneer", badgeDescription: "First expedition", badgeImageUrl: "https://example.test/badge.png" },
    });

    expect(mocks.queueRetainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "badge",
        subject: "usr_test",
        data: {
          action: "add",
          badgeId: "bdg_new",
          name: "Pioneer",
          description: "First expedition",
          imageUrl: "https://example.test/badge.png",
        },
      })
    );
    const expected: unknown = expect.objectContaining({ type: "Event", data: "Badge earned: Pioneer" });
    expect(mocks.queueGameLogNoty).toHaveBeenCalledWith(expected);
    expect(mocks.addGamelogEventToDatabase).toHaveBeenCalledWith(expected);
    expect(mocks.addGameLog).toHaveBeenCalledWith(expected);
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  test("does nothing for an empty payload", async () => {
    await runBadgeEventFlow("user-badge-unassigned", {});

    expect(mocks.queueGameLogNoty).not.toHaveBeenCalled();
    expect(mocks.addGamelogEventToDatabase).not.toHaveBeenCalled();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
