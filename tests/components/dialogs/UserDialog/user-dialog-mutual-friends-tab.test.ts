import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { createCurrentUserState, createUserDialogState } from "../../../../src/stores/user-state-factories";
import type { CurrentUserState, UserDialogState } from "../../../../src/stores/user-state";

vi.mock("vue-i18n", async () => {
  const vue = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
      locale: vue.ref("en"),
    }),
    createI18n: () => ({
      global: { t: (key: string) => key, locale: vue.ref("en") },
      install: vi.fn(),
    }),
  };
});

vi.mock("../../../../src/plugins/router", async () => {
  const vue = await import("vue");

  const { ref } = vue;
  return {
    router: {
      beforeEach: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
      isReady: vi.fn().mockResolvedValue(true),
    },
    initRouter: vi.fn(),
  };
});
vi.mock("vue-router", async (importOriginal) => {
  const vue = await import("vue");

  const actual = await importOriginal<Record<string, unknown>>();
  const { ref } = vue;
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
    })),
  };
});
vi.mock("../../../../src/plugins/interop-api", () => ({ initInteropApi: vi.fn() }));
vi.mock("../../../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return false;
        return vi.fn().mockResolvedValue(null);
      },
    }
  ),
}));
vi.mock("../../../../src/services/config", () => ({
  configRepository: {
    init: vi.fn(),
    getString: vi.fn().mockImplementation((_k: string, fallback?: string) => fallback ?? "{}"),
    setString: vi.fn().mockResolvedValue(undefined),
    getBool: vi.fn().mockImplementation((_k: string, isFallback?: boolean) => isFallback ?? false),
    setBool: vi.fn().mockResolvedValue(undefined),
    getInt: vi.fn().mockImplementation((_k: string, fallback?: number) => fallback ?? 0),
    setInt: vi.fn().mockResolvedValue(undefined),
    getFloat: vi.fn().mockImplementation((_k: string, fallback?: number) => fallback ?? 0),
    setFloat: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockReturnValue(null),
    setObject: vi.fn().mockResolvedValue(undefined),
    getArray: vi.fn().mockReturnValue([]),
    setArray: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  },
}));
vi.mock("../../../../src/services/json-storage", () => ({ VrcxJsonStorage: vi.fn() }));
vi.mock("../../../../src/services/watch-state", () => ({
  watchState: { isLoggedIn: false },
}));
vi.mock("../../../../src/services/request", () => ({
  request: vi.fn().mockResolvedValue({ json: {} }),
  processBulk: vi.fn(),
  buildRequestInit: vi.fn(),
  parseResponse: vi.fn(),
  shouldIgnoreError: vi.fn(),
  $throw: vi.fn(),
  failedGetRequests: new Map(),
}));

import * as userCoordinatorModule from "../../../../src/coordinators/user-coordinator";
vi.mock("../../../../src/coordinators/user-coordinator", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, showUserDialog: vi.fn() };
});

import UserDialogMutualFriendsTab from "../../../../src/components/dialogs/UserDialog/UserDialogMutualFriendsTab.vue";
import { useUserStore } from "../../../../src/stores/user";
import { userDialogMutualFriendSortingOptions } from "../../../../src/shared/constants/user";

const MOCK_MUTUAL_FRIENDS = [
  {
    id: "usr_1",
    displayName: "Charlie",
    $userColour: "#ff0000",
    currentAvatarThumbnailImageUrl: "https://img/charlie.png",
  },
  {
    id: "usr_2",
    displayName: "Alice",
    $userColour: "#00ff00",
    currentAvatarThumbnailImageUrl: "https://img/alice.png",
  },
  {
    id: "usr_3",
    displayName: "Bob",
    $userColour: "#0000ff",
    currentAvatarThumbnailImageUrl: "https://img/bob.png",
  },
];

type MountOverrides = Partial<UserDialogState> & { currentUser?: Partial<CurrentUserState> };

function mountComponent({ currentUser: currentUserOverrides, ...overrides }: MountOverrides = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

  const userStore = useUserStore(pinia);
  const userDialog: Partial<UserDialogState> = {
    id: "usr_target",
    ref: { id: "usr_target" },
    mutualFriends: [...MOCK_MUTUAL_FRIENDS],
    mutualFriendSorting: userDialogMutualFriendSortingOptions.alphabetical,
    isMutualFriendsLoading: false,
    ...overrides,
  };
  const currentUser: Partial<CurrentUserState> = {
    id: "usr_me",
    hasSharedConnectionsOptOut: false,
    ...currentUserOverrides,
  };
  userStore.userDialog = { ...createUserDialogState(), ...userDialog };
  userStore.currentUser = { ...createCurrentUserState(), ...currentUser };

  return mount(UserDialogMutualFriendsTab, {
    global: {
      plugins: [pinia],
      stubs: {
        RefreshCw: { template: '<svg class="refresh-icon" />' },
      },
    },
  });
}

describe("UserDialogMutualFriendsTab.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("renders mutual friend count", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("3");
    });

    test("renders all mutual friends", () => {
      const wrapper = mountComponent();
      const items = wrapper.findAll("li");
      expect(items).toHaveLength(3);
    });

    test("renders friend display names", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Charlie");
      expect(wrapper.text()).toContain("Alice");
      expect(wrapper.text()).toContain("Bob");
    });

    test("renders friend avatar images", () => {
      const wrapper = mountComponent();
      const images = wrapper.findAll("img");
      expect(images).toHaveLength(3);
    });

    test("applies user colour to display name", () => {
      const wrapper = mountComponent();
      const nameSpan = wrapper.find('span[style*="--user-colour"]');
      expect(nameSpan.exists()).toBe(true);
    });

    test("renders empty list when no mutual friends", () => {
      const wrapper = mountComponent({ mutualFriends: [] });
      const items = wrapper.findAll("li");
      expect(items).toHaveLength(0);
      expect(wrapper.text()).toContain("0");
    });
  });

  describe("loading state", () => {
    test("disables refresh button when loading", () => {
      const wrapper = mountComponent({ isMutualFriendsLoading: true });
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeDefined();
    });

    test("refresh button is enabled when not loading", () => {
      const wrapper = mountComponent({ isMutualFriendsLoading: false });
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeUndefined();
    });
  });

  describe("click interactions", () => {
    test("calls showUserDialog when a friend is clicked", async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
      const userStore = useUserStore(pinia);
      userStore.$patch({
        userDialog: {
          id: "usr_target",
          ref: { id: "usr_target" },
          mutualFriends: [...MOCK_MUTUAL_FRIENDS],
          mutualFriendSorting: userDialogMutualFriendSortingOptions.alphabetical,
          isMutualFriendsLoading: false,
        },
        currentUser: { id: "usr_me" },
      });
      const showUserDialogSpy = vi.spyOn(userCoordinatorModule, "showUserDialog").mockImplementation(() => undefined);

      const wrapper = mount(UserDialogMutualFriendsTab, {
        global: {
          plugins: [pinia],
          stubs: {
            RefreshCw: { template: '<svg class="refresh-icon" />' },
          },
        },
      });

      const firstItem = wrapper.findAll("li")[0];
      if (firstItem === undefined) throw new Error("mutual friend item not rendered");
      await firstItem.trigger("click");
      expect(showUserDialogSpy).toHaveBeenCalledWith("usr_1");
    });
  });
});
