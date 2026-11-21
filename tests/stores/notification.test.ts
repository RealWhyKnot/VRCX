import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia, getActivePinia, disposePinia } from "pinia";
import { watchState } from "../../src/services/watch-state";
import type { NotificationEntry } from "../../src/stores/notification/types";

const { hideNotificationMock, dbMocks } = vi.hoisted(() => ({
  hideNotificationMock: vi.fn(() => Promise.resolve({})),
  dbMocks: {
    addNotificationToDatabase: vi.fn(),
    replaceNotificationInDatabase: vi.fn((_row: unknown) => Promise.resolve()),
    lookupNotificationDatabase: vi.fn((_search: string, _filters: string[], _vipList: string[], _maxEntries: number): Promise<unknown[]> =>
      Promise.resolve([])
    ),
    getNotificationHistoryState: vi.fn<(ids: string[]) => Promise<{ id: string; friendRequestOutcome: string | null }[]>>(() =>
      Promise.resolve([{ id: "previously_seen_id", friendRequestOutcome: null }])
    ),
    activeNotifications: vi.fn((): Promise<{ json: unknown[] }> => Promise.resolve({ json: [] })),
    getNotifications: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
    getNotificationsV2: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
  },
}));

vi.mock("../../src/services/database", () => ({
  database: {
    getJoinCount: vi.fn(),
    addNotificationToDatabase: dbMocks.addNotificationToDatabase,
    addNotificationV2ToDatabase: vi.fn(),
    updateNotificationExpired: vi.fn(),
    seenNotificationV2: vi.fn(),
    replaceNotificationInDatabase: dbMocks.replaceNotificationInDatabase,
    lookupNotificationDatabase: dbMocks.lookupNotificationDatabase,
    getNotifications: dbMocks.getNotifications,
    getNotificationHistoryState: dbMocks.getNotificationHistoryState,
    getNotificationsV2: dbMocks.getNotificationsV2,
  },
  dbVars: {
    maxTableSize: 1000,
  },
}));

vi.mock("../../src/api/friend", () => ({
  friendRequest: {},
}));
vi.mock("../../src/api/instance", () => ({
  instanceRequest: {
    getInstance: vi.fn(),
  },
}));
vi.mock("../../src/api/notification", () => ({
  notificationRequest: {
    hideNotification: hideNotificationMock,
    getNotifications: dbMocks.activeNotifications,
    getNotificationsV2: vi.fn(() => Promise.resolve({ json: [] })),
    getHiddenFriendRequests: vi.fn(() => Promise.resolve({ json: [] })),
  },
}));
vi.mock("../../src/api/query-request", () => ({
  queryRequest: {
    fetch: vi.fn(() => Promise.resolve({ json: {} })),
  },
}));
vi.mock("@/plugins/i18n", () => ({
  i18n: {
    global: {
      t: vi.fn((key: string) => key),
    },
  },
  loadLocalizedStrings: vi.fn(() => Promise.resolve()),
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: vi.fn((key: string) => key),
    locale: ref("en"),
  }),
}));
vi.mock("../../src/services/config", () => ({
  configRepository: {
    getBool: vi.fn((key, defaultValue) => {
      if (key === "VRCX_autoDeclineFriendRequests") {
        return Promise.resolve(true);
      }
      return Promise.resolve(defaultValue);
    }),
    getInt: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),
    getFloat: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),
    getString: vi.fn((_key, defaultValue) => Promise.resolve(defaultValue)),

    setBool: vi.fn(() => Promise.resolve()),
    setInt: vi.fn(() => Promise.resolve()),
    setFloat: vi.fn(() => Promise.resolve()),
    setString: vi.fn(() => Promise.resolve()),

    remove: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("../../src/stores/ui", () => ({
  useUiStore: () => ({
    notifyMenu: vi.fn(),
    removeNotify: vi.fn(),
  }),
}));
import { nextTick, ref } from "vue";
vi.mock("vue-router", () => ({
  useRouter: () => ({
    currentRoute: ref({
      name: "test",
      params: {},
    }),
  }),
}));
vi.mock("../../src/plugins/router", () => ({
  router: {
    currentRoute: ref({
      name: "test",
      params: {},
    }),
    push: vi.fn(),
    replace: vi.fn(),
  },
}));
const { database, dbVars } = await import("../../src/services/database");

const { useNotificationStore } = await import("../../src/stores/notification");
const { useGeneralSettingsStore } = await import("../../src/stores/settings/general");

beforeEach(() => {
  watchState.isLoggedIn = false;
  watchState.isFriendsLoaded = false;
});

afterEach(() => {
  const pinia = getActivePinia();
  if (pinia) disposePinia(pinia);
  vi.unstubAllGlobals();
});

describe("notification store - auto decline friend requests", () => {
  let notificationStore: ReturnType<typeof useNotificationStore>;
  let generalSettingsStore: ReturnType<typeof useGeneralSettingsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    notificationStore = useNotificationStore();
    generalSettingsStore = useGeneralSettingsStore();

    generalSettingsStore.autoDeclineFriendRequests = true;
  });

  it("declines a friend request when join count is 0", async () => {
    vi.mocked(database.getJoinCount).mockResolvedValue({
      joinCount: 0,
      userId: "usr_test",
    });

    const ref: NotificationEntry = {
      id: "not_test",
      type: "friendRequest",
      senderUserId: "usr_test",
      senderUsername: "TestUser",
      message: "",
      details: {},
      created_at: "",
    };

    notificationStore.notificationTable.data.push(ref);
    const row = notificationStore.notificationTable.data.find((n) => n.id === "not_test");

    notificationStore.handlePipelineNotification({ json: ref });

    await vi.waitFor(() => {
      expect(database.getJoinCount).toHaveBeenCalledWith({
        id: "usr_test",
        displayName: "TestUser",
      });
    });

    await vi.waitFor(() => {
      expect(hideNotificationMock).toHaveBeenCalledWith({
        notificationId: "not_test",
      });
    });

    await vi.waitFor(() => {
      expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "not_test",
          type: "ignoredFriendRequest",
          senderUserId: "usr_test",
          senderUsername: "TestUser",
          details: { responseMessage: "autoDeclined" },
          $isExpired: true,
        })
      );
    });

    expect(row?.$friendRequestOutcome).toBe("autoDeclined");
    expect(row?.$isExpired).toBe(true);
    expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledTimes(1);
  });

  it("does not decline when join count is greater than 0", async () => {
    vi.mocked(database.getJoinCount).mockResolvedValue({
      joinCount: 2,
      userId: "usr_test",
    });

    const ref: NotificationEntry = {
      id: "not_test",
      type: "friendRequest",
      senderUserId: "usr_test",
      senderUsername: "TestUser",
      message: "",
      details: {},
      created_at: "",
    };

    notificationStore.notificationTable.data.push(ref);

    notificationStore.handlePipelineNotification({ json: ref });

    await vi.waitFor(() => {
      expect(database.getJoinCount).toHaveBeenCalled();
    });

    expect(hideNotificationMock).not.toHaveBeenCalled();
    expect(notificationStore.notificationTable.data.some((n) => n.id === "not_test")).toBe(true);
  });

  it("does nothing when auto decline is disabled", async () => {
    generalSettingsStore.autoDeclineFriendRequests = false;

    const ref: NotificationEntry = {
      id: "not_test",
      type: "friendRequest",
      senderUserId: "usr_test",
      senderUsername: "TestUser",
      message: "",
      details: {},
      created_at: "",
    };

    notificationStore.handlePipelineNotification({ json: ref });

    await Promise.resolve();

    expect(database.getJoinCount).not.toHaveBeenCalled();
    expect(hideNotificationMock).not.toHaveBeenCalled();
  });

  it("does not run auto decline logic for other notification types", async () => {
    const ref: NotificationEntry = {
      id: "not_test",
      type: "invite",
      senderUserId: "usr_test",
      senderUsername: "TestUser",
      message: "",
      details: {},
      created_at: "",
    };

    notificationStore.handlePipelineNotification({ json: ref });

    await Promise.resolve();

    expect(database.getJoinCount).not.toHaveBeenCalled();
    expect(hideNotificationMock).not.toHaveBeenCalled();
  });
});

describe("notification store - friend request history", () => {
  let notificationStore: ReturnType<typeof useNotificationStore>;

  const friendRequest = (id: string, createdAt: string): NotificationEntry => ({
    id,
    type: "friendRequest",
    senderUserId: `usr_${id}`,
    senderUsername: `Sender ${id}`,
    message: "",
    details: {},
    created_at: createdAt,
  });

  const findRow = (id: string) => notificationStore.notificationTable.data.find((n) => n.id === id);

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    notificationStore = useNotificationStore();
    useGeneralSettingsStore().autoDeclineFriendRequests = false;
  });

  it("saves an incoming friend request before anyone answers it", async () => {
    notificationStore.handleNotification({ json: friendRequest("frq_new", "2026-11-18T10:00:00.000Z") });

    await vi.waitFor(() => {
      expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "frq_new",
          type: "friendRequest",
          senderUserId: "usr_frq_new",
          senderUsername: "Sender frq_new",
          created_at: "2026-11-18T10:00:00.000Z",
          details: { responseMessage: "" },
          $isExpired: false,
        })
      );
    });
    expect(dbMocks.addNotificationToDatabase).not.toHaveBeenCalled();
  });

  it("keeps a declined friend request in the list", async () => {
    notificationStore.notificationTable.data.push(friendRequest("frq_hide", "2026-11-18T10:00:00.000Z"));

    notificationStore.handleNotificationHide("frq_hide");

    const row = findRow("frq_hide");
    expect(row?.$friendRequestOutcome).toBe("declined");
    expect(row?.$isExpired).toBe(true);
    await vi.waitFor(() => {
      expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledWith(
        expect.objectContaining({ id: "frq_hide", type: "ignoredFriendRequest", details: { responseMessage: "declined" } })
      );
    });
  });

  it("records an accepted friend request", async () => {
    notificationStore.notificationTable.data.push(friendRequest("frq_ok", "2026-11-18T10:00:00.000Z"));

    const args: { params: { notificationId: string }; ref?: NotificationEntry } = { params: { notificationId: "frq_ok" } };
    notificationStore.handleNotificationAccept(args);

    expect(args.ref?.$friendRequestOutcome).toBe("accepted");
    await vi.waitFor(() => {
      expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledWith(
        expect.objectContaining({ id: "frq_ok", type: "friendRequest", details: { responseMessage: "accepted" }, $isExpired: true })
      );
    });
  });

  it("does not save friend requests the user sent", async () => {
    notificationStore.handleNotification({ json: { ...friendRequest("frq_own", "2026-11-18T10:00:00.000Z"), senderUserId: "" } });

    await Promise.resolve();

    expect(dbMocks.replaceNotificationInDatabase).not.toHaveBeenCalled();
  });

  it("loads every saved friend request even past the table limit", async () => {
    const savedMaxTableSize = dbVars.maxTableSize;
    dbVars.maxTableSize = 1;
    dbMocks.getNotificationsV2.mockResolvedValue([{ id: "grp_1", type: "group.announcement", created_at: "2026-11-18T12:00:00.000Z", details: {} }]);
    dbMocks.getNotifications.mockResolvedValue([{ ...friendRequest("frq_recent", "2026-11-18T11:00:00.000Z"), details: { responseMessage: "" } }]);
    dbMocks.lookupNotificationDatabase.mockResolvedValue([
      { ...friendRequest("frq_recent", "2026-11-18T11:00:00.000Z"), details: { responseMessage: "" } },
      { ...friendRequest("frq_old", "2026-08-01T09:00:00.000Z"), type: "ignoredFriendRequest", details: { responseMessage: "autoDeclined" } },
    ]);

    try {
      await notificationStore.loadNotificationHistory();
    } finally {
      dbVars.maxTableSize = savedMaxTableSize;
    }

    expect(dbMocks.lookupNotificationDatabase).toHaveBeenCalledWith("", ["friendRequest", "ignoredFriendRequest"], [], 100000);
    const ids = notificationStore.notificationTable.data.map((n) => n.id);
    expect(ids).toEqual(["grp_1", "frq_recent", "frq_old"]);
    expect(findRow("frq_old")?.$friendRequestOutcome).toBe("autoDeclined");
    expect(findRow("frq_old")?.$isExpired).toBe(true);
    expect(findRow("frq_recent")?.$friendRequestOutcome).toBe("");
  });

  it("starts live notifications without reading display history", async () => {
    dbMocks.activeNotifications.mockResolvedValueOnce({
      json: [
        {
          id: "live_start",
          type: "invite",
          senderUserId: "usr_sender",
          senderUsername: "Sender",
          created_at: "2026-11-20T01:00:00Z",
          details: {},
          seen: false,
        },
      ],
    });
    await notificationStore.initNotifications();
    expect(dbMocks.getNotifications).not.toHaveBeenCalled();
    expect(dbMocks.getNotificationsV2).not.toHaveBeenCalled();
    expect(dbMocks.lookupNotificationDatabase).not.toHaveBeenCalled();

    expect(notificationStore.unseenNotifications).toContain("live_start");
    expect(notificationStore.notificationTable.data.some((entry) => entry.id === "live_start")).toBe(true);
  });

  it("prefetches display history after friends and idle, then reuses it on open", async () => {
    const callbacks: IdleRequestCallback[] = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: IdleRequestCallback) => callbacks.push(callback))
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    dbMocks.getNotificationsV2.mockResolvedValueOnce([]);
    dbMocks.getNotifications.mockResolvedValueOnce([]);
    dbMocks.lookupNotificationDatabase.mockResolvedValueOnce([]);
    watchState.isLoggedIn = true;
    await nextTick();
    expect(callbacks).toHaveLength(0);
    expect(dbMocks.getNotificationsV2).not.toHaveBeenCalled();
    watchState.isFriendsLoaded = true;
    await nextTick();
    expect(dbMocks.getNotificationsV2).not.toHaveBeenCalled();
    callbacks[0]?.({ didTimeout: false, timeRemaining: () => 50 });
    await notificationStore.loadNotificationHistory();
    await notificationStore.loadNotificationHistory();
    expect(dbMocks.getNotificationsV2).toHaveBeenCalledTimes(1);
    expect(dbMocks.getNotifications).toHaveBeenCalledTimes(1);
  });

  it("preserves saved friend request outcomes before display history is opened", async () => {
    dbMocks.getNotificationHistoryState.mockResolvedValueOnce([{ id: "known_request", friendRequestOutcome: "autoDeclined" }]);
    dbMocks.activeNotifications.mockResolvedValueOnce({
      json: [{ ...friendRequest("known_request", "2026-11-20T01:00:00Z"), type: "ignoredFriendRequest" }],
    });
    await notificationStore.initNotifications();
    expect(dbMocks.getNotificationHistoryState).toHaveBeenCalledWith(["known_request"]);
    await Promise.resolve();
    expect(findRow("known_request")?.$friendRequestOutcome).toBe("autoDeclined");
    expect(dbMocks.replaceNotificationInDatabase).not.toHaveBeenCalled();
    expect(dbMocks.getNotifications).not.toHaveBeenCalled();
  });

  it("merges delayed history with live updates and coalesces concurrent opens", async () => {
    const { promise, resolve } = Promise.withResolvers<unknown[]>();
    dbMocks.getNotificationsV2.mockReturnValueOnce(promise);
    const first = notificationStore.loadNotificationHistory();
    const second = notificationStore.loadNotificationHistory();
    expect(notificationStore.isNotificationsLoading).toBe(true);
    expect(dbMocks.getNotificationsV2).toHaveBeenCalledTimes(1);
    notificationStore.handleNotificationV2({
      json: { id: "live_merge", type: "group.announcement", createdAt: "2026-11-20T01:00:00Z", seen: false, data: {}, details: {} },
    });
    notificationStore.handleNotificationSee("live_merge");
    resolve([{ id: "live_merge", type: "group.announcement", created_at: "2026-11-19T01:00:00Z", seen: false, details: {} }]);
    await Promise.all([first, second]);
    expect(notificationStore.isNotificationsLoading).toBe(false);
    const entries = notificationStore.notificationTable.data.filter((entry) => entry.id === "live_merge");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.seen).toBe(true);
    expect(notificationStore.unseenNotifications).not.toContain("live_merge");
    await notificationStore.loadNotificationHistory();
    expect(dbMocks.getNotificationsV2).toHaveBeenCalledTimes(1);
  });

  it("keeps saved friend requests when notifications refresh", async () => {
    notificationStore.notificationTable.data.push(
      { ...friendRequest("frq_saved", "2026-11-18T10:00:00.000Z"), $friendRequestOutcome: "declined", $isExpired: true },
      friendRequest("frq_unsaved", "2026-11-18T10:00:00.000Z")
    );

    await notificationStore.refreshNotifications();

    const ids = notificationStore.notificationTable.data.map((n) => n.id);
    expect(ids).toContain("frq_saved");
    expect(ids).not.toContain("frq_unsaved");
  });
});

describe("notification store - invites sent back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves where the invite went on the request invite row and keeps the request message", async () => {
    const { recordInviteReply } = await import("../../src/stores/notification/invite-reply-history");
    const entry = {
      id: "rqi_1",
      type: "requestInvite",
      senderUserId: "usr_toaster",
      senderUsername: "Toaster",
      message: "",
      details: { requestMessage: "can I join?" },
      created_at: "2026-11-18T10:00:00.000Z",
    };

    await recordInviteReply(entry, "autoInvited", "wrld_cat:12345~region(eu)", "The Black Cat");

    expect(dbMocks.replaceNotificationInDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "rqi_1",
        type: "requestInvite",
        senderUserId: "usr_toaster",
        details: { worldId: "wrld_cat:12345~region(eu)", worldName: "The Black Cat", responseMessage: "autoInvited", requestMessage: "can I join?" },
        $isExpired: true,
      })
    );
    expect(entry.details).toEqual({
      requestMessage: "can I join?",
      worldId: "wrld_cat:12345~region(eu)",
      worldName: "The Black Cat",
      responseMessage: "autoInvited",
    });
  });
});
