import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { createCurrentUserState, createUserDialogState } from "../../../../src/stores/user-state";
import type { CurrentUserState, UserDialogState } from "../../../../src/stores/user-state";
import { createDefaultUserRef } from "../../../../src/shared/utils/user-transforms";

vi.mock("vue-i18n", async () => {
  const vue = await import("vue");
  return {
    useI18n: () => {
      const { ref } = vue;
      return {
        t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
        locale: ref("en"),
      };
    },
    createI18n: () => ({
      global: { t: (key: string) => key },
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

import UserDialogInfoTab from "../../../../src/components/dialogs/UserDialog/UserDialogInfoTab.vue";
import { queryRequest } from "../../../../src/api/query-request";
import { useAdvancedSettingsStore } from "../../../../src/stores/settings/advanced";
import { useAppearanceSettingsStore } from "../../../../src/stores/settings/appearance";
import { useLocationStore } from "../../../../src/stores/location";
import { useModalStore } from "../../../../src/stores/modal";
import { useUserStore } from "../../../../src/stores/user";

type MountOverrides = {
  userDialog?: Partial<UserDialogState>;
  currentUser?: Partial<CurrentUserState>;
};

function mountComponent(overrides: MountOverrides = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });

  const appearanceSettingsStore = useAppearanceSettingsStore(pinia);
  appearanceSettingsStore.$patch({
    hideUserNotes: false,
    hideUserMemos: false,
  });

  const advancedSettingsStore = useAdvancedSettingsStore(pinia);
  advancedSettingsStore.$patch({
    bioLanguage: "en",
    translationApi: false,
    translationApiType: "google",
  });
  const advancedSettings = advancedSettingsStore;
  advancedSettings.translateText = vi.fn().mockResolvedValue("");

  const userStore = useUserStore(pinia);
  const userDialog: Partial<UserDialogState> = {
    id: "usr_target",
    friend: {
      state: "online",
      ref: createDefaultUserRef({ location: "wrld_test:123" }),
    },
    ref: {
      id: "usr_target",
      location: "wrld_test:123",
      travelingToLocation: "",
      profilePicOverride: "",
      currentAvatarImageUrl: "",
      currentAvatarTags: [],
      bio: "",
      bioLinks: [],
      state: "online",
      $online_for: 1000,
      last_login: "2025-01-01T00:00:00.000Z",
      last_activity: "2025-01-01T00:00:00.000Z",
      date_joined: "2020-01-01",
      allowAvatarCopying: true,
      displayName: "Target",
    },
    $location: {
      tag: "wrld_test:123",
      shortName: "Test",
      userId: "",
    },
    instance: {
      ...createUserDialogState().instance,
      ref: {},
      friendCount: 0,
    },
    users: [
      createDefaultUserRef({
        id: "usr_friend_1",
        displayName: "Friend A",
        $userColour: "#ffffff",
        location: "traveling",
        $travelingToTime: Date.now(),
        $location_at: Date.now(),
      }),
    ],
    note: "",
    memo: "",
    isRepresentedGroupLoading: false,
    representedGroup: createUserDialogState().representedGroup,
    lastSeen: "2025-01-01T00:00:00.000Z",
    joinCount: 0,
    timeSpent: 0,
    dateFriendedInfo: [],
    unFriended: false,
    dateFriended: "2025-01-01T00:00:00.000Z",
    $homeLocationName: "",
    ...overrides.userDialog,
  };
  const currentUser: Partial<CurrentUserState> = {
    id: "usr_me",
    allowAvatarCopying: true,
    isBoopingEnabled: true,
    hasSharedConnectionsOptOut: false,
    hasDiscordFriendsOptOut: false,
    homeLocation: "",
    ...overrides.currentUser,
  };
  userStore.userDialog = { ...createUserDialogState(), ...userDialog };
  userStore.currentUser = { ...createCurrentUserState(), ...currentUser };
  userStore.$patch({ currentUserCredits: null });

  const locationStore = useLocationStore(pinia);
  locationStore.$patch({
    lastLocation: {
      location: "wrld_test:123",
    },
  });

  const modal = useModalStore(pinia);
  modal.confirm = vi.fn().mockResolvedValue({ ok: false });

  return shallowMount(UserDialogInfoTab, {
    global: {
      plugins: [pinia],
      stubs: {
        Location: true,
        Timer: true,
        TooltipWrapper: true,
        AvatarInfo: true,
      },
    },
  });
}

describe("UserDialogInfoTab.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unit behavior", () => {
    test("onTabActivated fetches VRChat credits only once after first success", async () => {
      const response = { json: { balance: 42 }, cache: false };
      const creditsSpy = vi.spyOn(queryRequest, "fetch").mockResolvedValue(response);
      const wrapper = mountComponent({ currentUser: { id: "usr_target" } });

      wrapper.vm.onTabActivated();
      await flushPromises();
      wrapper.vm.onTabActivated();
      await flushPromises();

      expect(creditsSpy).toHaveBeenCalledExactlyOnceWith("vrchatCredits");
      expect(useUserStore().currentUserCredits).toBe(42);
    });

    test("does not fetch credits for another user", async () => {
      const creditsSpy = vi.spyOn(queryRequest, "fetch");
      const wrapper = mountComponent();
      wrapper.vm.onTabActivated();
      await flushPromises();
      expect(creditsSpy).not.toHaveBeenCalled();
    });
  });

  describe("dom rendering", () => {
    test("renders imported InstanceActionBar and Spinner components when conditions are met", () => {
      const wrapper = mountComponent();

      expect(wrapper.find("instance-action-bar-stub").exists()).toBe(true);
      expect(wrapper.find("spinner-stub").exists()).toBe(true);
    });
  });
});
