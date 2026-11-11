import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";

import type { FriendContext } from "../../../../src/stores/friend-types";
import { createDefaultUserRef } from "../../../../src/shared/utils/user-transforms";

const mocks = vi.hoisted(() => ({
  appearanceStore: {
    hideNicknames: false,
  },
  friendStore: {
    isRefreshFriendsLoading: false,
    allFavoriteFriendIds: new Set(),
  },
  userStore: {},
  showUserDialog: vi.fn<(userId: string) => void>(),
  confirmDeleteFriend: vi.fn<(friendId: string) => void>(),
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: (store: unknown) => store,
  };
});

vi.mock("../../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => mocks.appearanceStore,
}));
vi.mock("../../../../src/stores/friend", () => ({
  useFriendStore: () => mocks.friendStore,
}));
vi.mock("../../../../src/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("../../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: (userId: string) => mocks.showUserDialog(userId),
}));

vi.mock("../../../../src/coordinators/friend-relationship-coordinator", () => ({
  confirmDeleteFriend: (friendId: string) => mocks.confirmDeleteFriend(friendId),
}));

vi.mock("../../../../src/shared/utils/user", () => ({
  userImage: vi.fn(() => "https://example.com/avatar.png"),
  userStatusClass: vi.fn(() => "status-online"),
}));

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref("en"),
    }),
  };
});

vi.mock("@/components/ui/avatar/Avatar.vue", () => ({
  default: {
    template: '<div data-testid="avatar"><slot /></div>',
  },
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

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="delete-button" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}));

vi.mock("@/components/ui/spinner/Spinner.vue", () => ({
  default: {
    template: '<span data-testid="spinner" />',
  },
}));

vi.mock("@/components/Location.vue", () => ({
  default: {
    props: ["location", "traveling", "link"],
    template: '<span data-testid="location">{{ location }}|{{ traveling }}</span>',
  },
}));

vi.mock("@/components/Timer.vue", () => ({
  default: {
    props: ["epoch"],
    template: '<span data-testid="timer">{{ epoch }}</span>',
  },
}));

vi.mock("lucide-vue-next", () => ({
  User: {
    template: '<span data-testid="icon-user" />',
  },
  Trash2: {
    template: '<span data-testid="icon-trash" />',
  },
}));

import FriendItem from "../../../../src/views/Sidebar/components/FriendItem.vue";

function makeFriend(overrides: Partial<FriendContext> = {}): FriendContext {
  return {
    id: "usr_1",
    name: "Alice",
    state: "active",
    isVIP: false,
    pendingOffline: false,
    $nickName: "Ali",
    ref: createDefaultUserRef({
      id: "usr_1",
      displayName: "Alice",
      $userColour: "#fff",
      statusDescription: "Online",
      location: "wrld_abc:123",
      travelingToLocation: "",
      $location_at: 123,
    }),
    ...overrides,
  };
}

function mountItem(friend: FriendContext) {
  return mount(FriendItem, {
    props: {
      friend,
      isGroupByInstance: false,
    },
  });
}

describe("FriendItem.vue", () => {
  beforeEach(() => {
    mocks.appearanceStore.hideNicknames = false;
    mocks.friendStore.isRefreshFriendsLoading = false;
    mocks.friendStore.allFavoriteFriendIds = new Set();
    mocks.confirmDeleteFriend.mockReset();
    mocks.showUserDialog.mockReset();
  });

  test("renders delete action for orphan friend and triggers confirmDeleteFriend", async () => {
    const wrapper = mountItem(
      makeFriend({
        id: "usr_orphan",
        name: "Ghost",
        ref: undefined,
      })
    );

    expect(wrapper.text()).toContain("Ghost");
    const button = wrapper.get('[data-testid="delete-button"]');
    await button.trigger("click");
    expect(mocks.confirmDeleteFriend).toHaveBeenCalledWith("usr_orphan");
    expect(mocks.showUserDialog).not.toHaveBeenCalled();
  });
});
