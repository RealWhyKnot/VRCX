import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import type { StoredNotificationEntry } from "../../../../src/stores/notification/types";

dayjs.extend(relativeTime);

type NotificationFixture = StoredNotificationEntry & {
  responses?: unknown;
  version?: number;
};

const mocks = vi.hoisted(() => ({
  notificationStore: {
    acceptFriendRequestNotification: vi.fn<(notification: unknown) => void>(),
    acceptRequestInvite: vi.fn<(notification: unknown) => void>(),
    hideNotificationPrompt: vi.fn<(notification: unknown) => void>(),
    deleteNotificationLogPrompt: vi.fn<(notification: unknown) => void>(),
    sendNotificationResponse: vi.fn<(id: string, responses: unknown, responseType: string) => void>(),
    queueMarkAsSeen: vi.fn<(id: string, version: number) => void>(),
    openNotificationLink: vi.fn<(link: string) => void>(),
    isNotificationExpired: vi.fn<(notification: unknown) => boolean>(() => false),
  },
  userStore: {
    cachedUsers: new Map<string, unknown>(),
    showSendBoopDialog: vi.fn<(userId: string | undefined) => void>(),
    currentUser: { id: "usr_me" },
  },
  friendStore: {
    friends: new Map<string, unknown>(),
  },
  groupStore: {},
  locationStore: {
    lastLocation: {
      location: "wrld_home:123",
      value: { location: "wrld_home:123" },
    },
  },
  gameStore: {
    isGameRunning: { value: true },
  },
  instanceStore: {
    cachedInstances: new Map<string, unknown>(),
  },
  showUserDialog: vi.fn<(userId: string) => void>(),
  showGroupDialog: vi.fn<(groupId: string) => void>(),
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: <T>(store: T) => store,
  };
});

vi.mock("../../../../src/stores/notification", () => ({
  useNotificationStore: () => mocks.notificationStore,
}));
vi.mock("../../../../src/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("../../../../src/stores/friend", () => ({
  useFriendStore: () => mocks.friendStore,
}));
vi.mock("../../../../src/stores/group", () => ({
  useGroupStore: () => mocks.groupStore,
}));
vi.mock("../../../../src/stores/location", () => ({
  useLocationStore: () => mocks.locationStore,
}));
vi.mock("../../../../src/stores/game", () => ({
  useGameStore: () => mocks.gameStore,
}));
vi.mock("../../../../src/stores/instance", () => ({
  useInstanceStore: () => mocks.instanceStore,
}));

vi.mock("../../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: mocks.showUserDialog,
}));

vi.mock("../../../../src/coordinators/group-dialog-coordinator", () => ({
  showGroupDialog: mocks.showGroupDialog,
}));

vi.mock("../../../../src/shared/utils/invite", () => ({
  checkCanInvite: vi.fn(() => true),
}));
vi.mock("../../../../src/shared/utils/user", () => ({
  userImage: vi.fn(() => "https://example.com/avatar.png"),
}));

vi.mock("../../../../src/composables/use-user-display", () => ({
  useUserDisplay: () => ({
    userImage: vi.fn(() => "https://example.com/avatar.png"),
    userStatusClass: vi.fn(() => ""),
  }),
}));

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string) => key,
      te: () => false,
      locale: ref("en"),
    }),
  };
});

vi.mock("@/components/ui/item/Item.vue", () => ({
  default: { template: '<div data-testid="item"><slot /></div>' },
}));
vi.mock("@/components/ui/item/ItemMedia.vue", () => ({
  default: { template: '<div data-testid="item-media"><slot /></div>' },
}));
vi.mock("@/components/ui/item/ItemContent.vue", () => ({
  default: { template: '<div data-testid="item-content"><slot /></div>' },
}));
vi.mock("@/components/ui/item/ItemTitle.vue", () => ({
  default: { template: '<div data-testid="item-title"><slot /></div>' },
}));
vi.mock("@/components/ui/item/ItemDescription.vue", () => ({
  default: {
    template: '<div data-testid="item-description"><slot /></div>',
  },
}));

vi.mock("@/components/ui/avatar/Avatar.vue", () => ({
  default: { template: '<div data-testid="avatar"><slot /></div>' },
}));
vi.mock("@/components/ui/avatar/AvatarImage.vue", () => ({
  default: {
    props: ["src"],
    template: '<img data-testid="avatar-image" :src="src" />',
  },
}));
vi.mock("@/components/ui/avatar/AvatarFallback.vue", () => ({
  default: {
    template: '<span data-testid="avatar-fallback"><slot /></span>',
  },
}));

vi.mock("@/components/ui/hover-card/HoverCard.vue", () => ({
  default: { template: '<div data-testid="hover-card"><slot /></div>' },
}));
vi.mock("@/components/ui/hover-card/HoverCardTrigger.vue", () => ({
  default: {
    template: '<div data-testid="hover-trigger"><slot /></div>',
  },
}));
vi.mock("@/components/ui/hover-card/HoverCardContent.vue", () => ({
  default: {
    template: '<div data-testid="hover-content"><slot /></div>',
  },
}));

vi.mock("@/components/ui/badge/Badge.vue", () => ({
  default: { template: '<span data-testid="badge"><slot /></span>' },
}));

vi.mock("@/components/ui/separator/Separator.vue", () => ({
  default: { template: '<hr data-testid="separator" />' },
}));

vi.mock("@/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: '<span data-testid="tooltip"><slot /></span>' },
}));

vi.mock("../../../../src/components/Location.vue", () => ({
  default: {
    props: ["location"],
    template: '<span data-testid="location">{{ location }}</span>',
  },
}));

vi.mock("lucide-vue-next", () => {
  function icon(name: string) {
    return { template: `<span data-icon="${name}" />` };
  }
  return {
    Ban: icon("Ban"),
    Bell: icon("Bell"),
    BellOff: icon("BellOff"),
    CalendarDays: icon("CalendarDays"),
    Check: icon("Check"),
    Link: icon("Link"),
    Mail: icon("Mail"),
    MessageCircle: icon("MessageCircle"),
    Reply: icon("Reply"),
    Send: icon("Send"),
    Tag: icon("Tag"),
    Trash2: icon("Trash2"),
    UserPlus: icon("UserPlus"),
    Users: icon("Users"),
    X: icon("X"),
  };
});

import NotificationItem from "../../../../src/views/Sidebar/components/NotificationItem.vue";

function makeNotification(overrides: Partial<NotificationFixture> = {}): NotificationFixture {
  return {
    id: "noty_1",
    type: "friendRequest",
    senderUserId: "usr_123",
    senderUsername: "Alice",
    created_at: "2026-03-09T00:00:00.000Z",
    message: "",
    seen: false,
    details: {},
    ...overrides,
  };
}

describe("NotificationItem.vue", () => {
  beforeEach(() => {
    mocks.notificationStore.acceptFriendRequestNotification.mockReset();
    mocks.notificationStore.acceptRequestInvite.mockReset();
    mocks.notificationStore.hideNotificationPrompt.mockReset();
    mocks.notificationStore.deleteNotificationLogPrompt.mockReset();
    mocks.notificationStore.sendNotificationResponse.mockReset();
    mocks.notificationStore.queueMarkAsSeen.mockReset();
    mocks.notificationStore.openNotificationLink.mockReset();
    mocks.notificationStore.isNotificationExpired.mockReturnValue(false);
    mocks.showUserDialog.mockReset();
    mocks.userStore.showSendBoopDialog.mockReset();
    mocks.showGroupDialog.mockReset();
    mocks.userStore.cachedUsers = new Map<string, unknown>();
    mocks.friendStore.friends = new Map<string, unknown>();
    mocks.instanceStore.cachedInstances = new Map<string, unknown>();
  });

  test("renders sender and opens user dialog on sender click", async () => {
    const wrapper = mount(NotificationItem, {
      props: {
        notification: makeNotification(),
      },
    });

    expect(wrapper.text()).toContain("Alice");
    await wrapper.get("span.truncate.cursor-pointer").trigger("click");
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_123");
  });

  test("clicking accept icon calls acceptFriendRequestNotification", async () => {
    const wrapper = mount(NotificationItem, {
      props: {
        notification: makeNotification(),
      },
    });

    await wrapper.get('[data-icon="Check"]').trigger("click");
    expect(mocks.notificationStore.acceptFriendRequestNotification).toHaveBeenCalledWith(expect.objectContaining({ id: "noty_1" }));
  });

  test("link response calls openNotificationLink", async () => {
    const wrapper = mount(NotificationItem, {
      props: {
        notification: makeNotification({
          type: "message",
          responses: [
            {
              type: "link",
              icon: "reply",
              text: "Open",
              data: "group:grp_123",
            },
          ],
        }),
      },
    });

    await wrapper.get('[data-icon="Link"]').trigger("click");
    expect(mocks.notificationStore.openNotificationLink).toHaveBeenCalledWith("group:grp_123");
  });

  test("unmount queues mark-as-seen for unseen notification", () => {
    const wrapper = mount(NotificationItem, {
      props: {
        notification: makeNotification({
          version: 2,
        }),
        isUnseen: true,
      },
    });

    wrapper.unmount();
    expect(mocks.notificationStore.queueMarkAsSeen).toHaveBeenCalledWith("noty_1", 2);
  });
});
