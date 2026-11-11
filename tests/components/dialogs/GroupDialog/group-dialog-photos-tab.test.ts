import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", async () => {
  const vue = await import("vue");
  return {
    useI18n: () => ({
      t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
      locale: vue.ref("en"),
    }),
    createI18n: () => ({
      global: { t: (key) => key, locale: vue.ref("en") },
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
    setString: vi.fn().mockResolvedValue(undefined),
    getBool: vi.fn().mockImplementation((_k, d) => d ?? false),
    setBool: vi.fn().mockResolvedValue(undefined),
    getInt: vi.fn().mockImplementation((_k, d) => d ?? 0),
    setInt: vi.fn().mockResolvedValue(undefined),
    getFloat: vi.fn().mockImplementation((_k, d) => d ?? 0),
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
vi.mock("../../../../src/api/query-request", () => ({
  queryRequest: {
    fetch: vi.fn().mockResolvedValue({ json: [], params: {} }),
  },
}));
vi.mock("../../../../src/api/user", () => ({
  userRequest: {},
}));

import GroupDialogPhotosTab from "../../../../src/components/dialogs/GroupDialog/GroupDialogPhotosTab.vue";
import { useGroupStore } from "../../../../src/stores/group";

const MOCK_GALLERIES = [
  {
    id: "g1",
    name: "Photos",
    description: "General photos",
    membersOnly: false,
  },
  {
    id: "g2",
    name: "Screenshots",
    description: "Game screenshots",
    membersOnly: true,
    roleIdsToView: null,
  },
];

const MOCK_GALLERY_IMAGES = {
  g1: [
    {
      id: "img1",
      imageUrl: "https://img/photo1.png",
      groupId: "grp_1",
      galleryId: "g1",
    },
    {
      id: "img2",
      imageUrl: "https://img/photo2.png",
      groupId: "grp_1",
      galleryId: "g1",
    },
  ],
  g2: [
    {
      id: "img3",
      imageUrl: "https://img/screen1.png",
      groupId: "grp_1",
      galleryId: "g2",
    },
  ],
};

function mountComponent(overrides = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });

  const groupStore = useGroupStore(pinia);
  groupStore.$patch({
    groupDialog: {
      id: "grp_1",
      visible: true,
      ref: {
        galleries: [...MOCK_GALLERIES],
      },
      galleries: { ...MOCK_GALLERY_IMAGES },
      ...overrides,
    },
  });

  return mount(GroupDialogPhotosTab, {
    global: {
      plugins: [pinia],
      stubs: {
        RefreshCw: { template: '<svg class="refresh-icon" />' },
      },
    },
  });
}

describe("GroupDialogPhotosTab.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("renders gallery names", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Photos");
      expect(wrapper.text()).toContain("Screenshots");
    });

    test("renders gallery image counts", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("2");
      expect(wrapper.text()).toContain("1");
    });

    test("renders gallery descriptions", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("General photos");
    });

    test("renders gallery images", () => {
      const wrapper = mountComponent();
      const images = wrapper.findAll("img");
      expect(images.length).toBeGreaterThan(0);
    });

    test("renders refresh button", () => {
      const wrapper = mountComponent();
      const button = wrapper.find("button");
      expect(button.exists()).toBe(true);
    });

    test("renders zero count for empty gallery", () => {
      const wrapper = mountComponent({
        galleries: { g1: [], g2: [] },
      });
      expect(wrapper.text()).toContain("0");
    });
  });

  describe("loading state", () => {
    test("refresh button is enabled initially", () => {
      const wrapper = mountComponent();
      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeUndefined();
    });
  });

  describe("with no galleries", () => {
    test("renders without gallery tabs when ref.galleries is empty", () => {
      const wrapper = mountComponent({
        ref: { galleries: [] },
        galleries: {},
      });

      expect(wrapper.text()).not.toContain("Photos");
      expect(wrapper.text()).not.toContain("Screenshots");
    });
  });
});
