import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", async () => {
  const vue = await import("vue");

  const { ref } = vue;
  return {
    useI18n: () => ({
      t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
      locale: ref("en"),
    }),
    createI18n: () => ({
      global: { t: (key) => key, locale: ref("en") },
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

  const actual = await importOriginal();
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
    getString: vi.fn().mockImplementation((_k, d) => d ?? "{}"),
    setString: vi.fn(),
    getBool: vi.fn().mockImplementation((_k, d) => d ?? false),
    setBool: vi.fn(),
    getInt: vi.fn().mockImplementation((_k, d) => d ?? 0),
    setInt: vi.fn(),
    getFloat: vi.fn().mockImplementation((_k, d) => d ?? 0),
    setFloat: vi.fn(),
    getObject: vi.fn().mockReturnValue(null),
    setObject: vi.fn(),
    getArray: vi.fn().mockReturnValue([]),
    setArray: vi.fn(),
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

vi.mock("../../../../src/coordinators/world-coordinator", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, showWorldDialog: vi.fn() };
});

import UserDialogWorldsTab from "../../../../src/components/dialogs/UserDialog/UserDialogWorldsTab.vue";
import { useUserStore } from "../../../../src/stores/user";
import { userDialogWorldSortingOptions, userDialogWorldOrderOptions } from "../../../../src/shared/constants/user";

const MOCK_WORLDS = [
  {
    id: "wrld_1",
    name: "Sunset Valley",
    thumbnailImageUrl: "https://img/world1.png",
    occupants: 12,
    authorId: "usr_me",
  },
  {
    id: "wrld_2",
    name: "Midnight Club",
    thumbnailImageUrl: "https://img/world2.png",
    occupants: 5,
    authorId: "usr_me",
  },
  {
    id: "wrld_3",
    name: "Cozy Cottage",
    thumbnailImageUrl: "https://img/world3.png",
    occupants: 0,
    authorId: "usr_me",
  },
];

function mountComponent(overrides = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

  const userStore = useUserStore(pinia);
  userStore.$patch({
    userDialog: {
      id: "usr_me",
      ref: { id: "usr_me" },
      worlds: [...MOCK_WORLDS],
      worldSorting: userDialogWorldSortingOptions.name,
      worldOrder: userDialogWorldOrderOptions.descending,
      isWorldsLoading: false,
      ...overrides,
    },
    currentUser: {
      id: "usr_me",
      ...overrides.currentUser,
    },
  });

  return mount(UserDialogWorldsTab, {
    global: {
      plugins: [pinia],
      stubs: {
        RefreshCw: { template: '<svg class="refresh-icon" />' },
      },
    },
  });
}

describe("UserDialogWorldsTab.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("renders world count", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("3");
    });

    test("renders world names", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Sunset Valley");
      expect(wrapper.text()).toContain("Midnight Club");
      expect(wrapper.text()).toContain("Cozy Cottage");
    });

    test("renders world thumbnail images", () => {
      const wrapper = mountComponent();
      const images = wrapper.findAll("img");
      expect(images).toHaveLength(3);
      expect(images[0].attributes("src")).toBe("https://img/world1.png");
    });

    test("renders occupant count for worlds with occupants", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("12");
      expect(wrapper.text()).toContain("5");
    });

    test("renders empty state when no worlds and not loading", () => {
      const wrapper = mountComponent({ worlds: [] });
      expect(wrapper.text()).toContain("0");
    });
  });

  describe("loading state", () => {
    test("disables refresh button when loading", () => {
      const wrapper = mountComponent({ isWorldsLoading: true });
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeDefined();
    });

    test("refresh button is enabled when not loading", () => {
      const wrapper = mountComponent({ isWorldsLoading: false });
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeUndefined();
    });
  });
});
