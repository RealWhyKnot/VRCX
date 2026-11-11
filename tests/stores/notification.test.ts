import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { NotificationEntry } from "../../src/stores/notification/types";

const { hideNotificationMock } = vi.hoisted(() => ({
  hideNotificationMock: vi.fn(() => Promise.resolve({})),
}));

vi.mock("../../src/services/database", () => ({
  database: {
    getJoinCount: vi.fn(),
    addNotificationToDatabase: vi.fn(),
    addNotificationV2ToDatabase: vi.fn(),
    updateNotificationExpired: vi.fn(),
    seenNotificationV2: vi.fn(),
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
    getNotifications: vi.fn(() => Promise.resolve({ json: [] })),
    getNotificationsV2: vi.fn(() => Promise.resolve({ json: [] })),
    getHiddenFriendRequests: vi.fn(() => Promise.resolve({ json: [] })),
  },
}));
vi.mock("../../src/api/query-request", () => ({
  queryRequest: {
    fetch: vi.fn(),
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
import { ref } from "vue";
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
const { database } = await import("../../src/services/database");

const { useNotificationStore } = await import("../../src/stores/notification");
const { useGeneralSettingsStore } = await import("../../src/stores/settings/general");

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
      expect(notificationStore.notificationTable.data).not.toContain(ref);
    });
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
