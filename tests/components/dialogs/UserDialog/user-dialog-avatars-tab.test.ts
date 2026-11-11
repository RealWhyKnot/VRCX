import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { createCurrentUserState, createUserDialogState } from "../../../../src/stores/user-state";
import type { CurrentUserState, UserDialogState } from "../../../../src/stores/user-state";

vi.mock("vue-i18n", async () => {
  const vue = await import("vue");

  const { ref } = vue;
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
      locale: ref("en"),
    }),
    createI18n: () => ({
      global: { t: (key: string) => key, locale: ref("en") },
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

import UserDialogAvatarsTab from "../../../../src/components/dialogs/UserDialog/UserDialogAvatarsTab.vue";
import { useUserStore } from "../../../../src/stores/user";

const MOCK_AVATARS = [
  {
    id: "avtr_1",
    name: "Alpha",
    thumbnailImageUrl: "https://img/1.png",
    releaseStatus: "public",
    authorId: "usr_me",
  },
  {
    id: "avtr_2",
    name: "Beta",
    thumbnailImageUrl: "https://img/2.png",
    releaseStatus: "private",
    authorId: "usr_me",
  },
  {
    id: "avtr_3",
    name: "Gamma",
    thumbnailImageUrl: "https://img/3.png",
    releaseStatus: "public",
    authorId: "usr_me",
  },
];

type MountOverrides = Partial<UserDialogState> & { currentUser?: Partial<CurrentUserState> };

function mountComponent({ currentUser: currentUserOverrides, ...overrides }: MountOverrides = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

  const userStore = useUserStore(pinia);
  const userDialog: Partial<UserDialogState> = {
    id: "usr_me",
    ref: { id: "usr_me" },
    avatars: [...MOCK_AVATARS],
    avatarSorting: "name",
    avatarReleaseStatus: "all",
    isAvatarsLoading: false,
    isWorldsLoading: false,
    ...overrides,
  };
  const currentUser: Partial<CurrentUserState> = {
    id: "usr_me",
    ...currentUserOverrides,
  };
  userStore.userDialog = { ...createUserDialogState(), ...userDialog };
  userStore.currentUser = { ...createCurrentUserState(), ...currentUser };

  return mount(UserDialogAvatarsTab, {
    global: {
      plugins: [pinia],
      stubs: {
        RefreshCw: { template: '<svg class="refresh-icon" />' },
      },
    },
  });
}

describe("UserDialogAvatarsTab.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("renders avatar count", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("3");
    });

    test("renders avatar names", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Alpha");
      expect(wrapper.text()).toContain("Beta");
      expect(wrapper.text()).toContain("Gamma");
    });

    test("renders avatar thumbnails", () => {
      const wrapper = mountComponent();
      const images = wrapper.findAll("img");
      expect(images).toHaveLength(3);
      expect(images[0]?.attributes("src")).toBe("https://img/1.png");
    });

    test("shows empty state when no avatars and not loading", () => {
      const wrapper = mountComponent({ avatars: [] });
      expect(wrapper.text()).toContain("0");
    });
  });

  describe("filtering by releaseStatus", () => {
    test('shows only public avatars when releaseStatus is "public"', () => {
      const wrapper = mountComponent({ avatarReleaseStatus: "public" });
      expect(wrapper.text()).toContain("Alpha");
      expect(wrapper.text()).toContain("Gamma");
      expect(wrapper.text()).not.toContain("Beta");
    });

    test('shows only private avatars when releaseStatus is "private"', () => {
      const wrapper = mountComponent({ avatarReleaseStatus: "private" });
      expect(wrapper.text()).toContain("Beta");
      expect(wrapper.text()).not.toContain("Alpha");
      expect(wrapper.text()).not.toContain("Gamma");
    });
  });

  describe("search", () => {
    test("renders search input for current user", () => {
      const wrapper = mountComponent();
      const input = wrapper.find("input");
      expect(input.exists()).toBe(true);
    });

    test("renders search input for other users too", () => {
      const wrapper = mountComponent({
        id: "usr_other",
        ref: { id: "usr_other" },
      });
      const input = wrapper.find("input");
      expect(input.exists()).toBe(true);
    });

    test("filters avatars by search query", async () => {
      const wrapper = mountComponent();
      const input = wrapper.find("input");
      await input.setValue("alpha");
      expect(wrapper.text()).toContain("Alpha");
      expect(wrapper.text()).not.toContain("Beta");
      expect(wrapper.text()).not.toContain("Gamma");
    });

    test("search is case-insensitive", async () => {
      const wrapper = mountComponent();
      const input = wrapper.find("input");
      await input.setValue("BETA");
      expect(wrapper.text()).toContain("Beta");
    });

    test("shows all avatars when search query is cleared", async () => {
      const wrapper = mountComponent();
      const input = wrapper.find("input");
      await input.setValue("alpha");
      await input.setValue("");
      expect(wrapper.text()).toContain("Alpha");
      expect(wrapper.text()).toContain("Beta");
      expect(wrapper.text()).toContain("Gamma");
    });
  });

  describe("loading state", () => {
    test("disables refresh button when loading", () => {
      const wrapper = mountComponent({ isAvatarsLoading: true });
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeDefined();
    });
  });
});
