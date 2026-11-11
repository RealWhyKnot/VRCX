import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";

import en from "../../src/localization/en.json";

vi.mock("../../src/views/Feed/Feed.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../src/views/Feed/columns.tsx", () => ({ columns: [] }));
vi.mock("../../src/plugins/router", () => ({
  router: {
    beforeEach: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: ref({ path: "/", name: "", meta: {} }),
    isReady: vi.fn().mockResolvedValue(true),
  },
  initRouter: vi.fn(),
}));
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
    })),
  };
});
vi.mock("../../src/plugins/interop-api", () => ({ initInteropApi: vi.fn() }));
vi.mock("../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target: object, prop: string | symbol) => {
        if (prop === "__esModule") return false;
        return vi.fn().mockResolvedValue(null);
      },
    }
  ),
}));
vi.mock("../../src/services/config", () => ({
  configRepository: {
    init: vi.fn(),
    getString: vi.fn().mockResolvedValue("{}"),
    setString: vi.fn(),
    getBool: vi.fn().mockImplementation((_key: string, fallback?: unknown) => fallback ?? false),
    setBool: vi.fn(),
    getInt: vi.fn().mockImplementation((_key: string, fallback?: unknown) => fallback ?? 0),
    setInt: vi.fn(),
    getFloat: vi.fn().mockImplementation((_key: string, fallback?: unknown) => fallback ?? 0),
    setFloat: vi.fn(),
    getObject: vi.fn().mockReturnValue(null),
    setObject: vi.fn(),
    getArray: vi.fn().mockReturnValue([]),
    setArray: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../src/services/json-storage", () => ({ VrcxJsonStorage: vi.fn() }));
vi.mock("../../src/services/watch-state", () => ({
  watchState: { isLoggedIn: false },
}));
vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  const i18n = actual.createI18n({
    locale: "en",
    fallbackLocale: "en",
    legacy: false,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en },
  });
  return {
    ...actual,
    useI18n: () => i18n.global,
  };
});

type MockFn = (...args: unknown[]) => unknown;

const mockShowUserDialog = vi.fn<MockFn>();
const mockShowAvatarDialog = vi.fn<MockFn>();
const mockShowGroupDialog = vi.fn<MockFn>();
const mockShowWorldDialog = vi.fn<MockFn>();
const mockGetInstanceFromShortName = vi.fn<MockFn>();
const mockGroupStrictsearch = vi.fn<MockFn>();

vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    cachedUsers: new Map(),
    showUserDialogHistory: new Set(),
    currentUser: ref({ id: "usr_me", homeLocation: "" }),
  }),
}));
vi.mock("../../src/stores/avatar", () => ({
  useAvatarStore: () => ({}),
}));
vi.mock("../../src/stores/group", () => ({
  useGroupStore: () => ({}),
}));
vi.mock("../../src/stores/world", () => ({
  useWorldStore: () => ({}),
}));

vi.mock("../../src/stores/friend", () => ({
  useFriendStore: () => ({
    friends: new Map(),
  }),
}));
vi.mock("../../src/stores/modal", () => ({
  useModalStore: () => ({
    prompt: vi.fn().mockResolvedValue({ ok: false, value: "" }),
  }),
}));
vi.mock("../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    appLanguage: "en",
  }),
}));

function makeApiMock() {
  return {
    instanceRequest: {
      getInstanceFromShortName: (...args: unknown[]) => mockGetInstanceFromShortName(...args),
    },
    userRequest: {
      getUsers: vi.fn().mockResolvedValue({ json: [] }),
    },
    groupRequest: {
      groupStrictsearch: (...args: unknown[]) => mockGroupStrictsearch(...args),
    },
    queryRequest: {},
    miscRequest: {},
  };
}
vi.mock("../../src/api/instance", () => ({ instanceRequest: makeApiMock().instanceRequest }));
vi.mock("../../src/api/user", () => ({ userRequest: makeApiMock().userRequest }));
vi.mock("../../src/api/group", () => ({ groupRequest: makeApiMock().groupRequest }));

vi.mock("../../src/coordinators/user-coordinator", () => ({
  showUserDialog: (...args: unknown[]) => mockShowUserDialog(...args),
  lookupUser: vi.fn(),
}));
vi.mock("../../src/coordinators/user-profile-apply", () => ({
  applyUser: vi.fn(),
}));
vi.mock("../../src/coordinators/avatar-coordinator", () => ({
  showAvatarDialog: (...args: unknown[]) => mockShowAvatarDialog(...args),
  getAvatarName: vi.fn(),
}));
vi.mock("../../src/coordinators/group-dialog-coordinator", () => ({
  showGroupDialog: (...args: unknown[]) => mockShowGroupDialog(...args),
}));
vi.mock("../../src/coordinators/world-coordinator", () => ({
  showWorldDialog: (...args: unknown[]) => mockShowWorldDialog(...args),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { useSearchStore } from "../../src/stores/search";

describe("useSearchStore", () => {
  let store: ReturnType<typeof useSearchStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useSearchStore();
    vi.clearAllMocks();
  });

  describe("directAccessParse", () => {
    test("returns false for empty input", () => {
      expect(store.directAccessParse("")).toBe(false);
      expect(store.directAccessParse(null)).toBe(false);
      expect(store.directAccessParse(undefined)).toBe(false);
    });

    test("opens user dialog for usr_ prefix", () => {
      store.directAccessParse("usr_abc123");
      expect(mockShowUserDialog).toHaveBeenCalledWith("usr_abc123");
    });

    test("opens user dialog for 10-char alphanumeric ID", () => {
      store.directAccessParse("Ab3dEf7h9J");
      expect(mockShowUserDialog).toHaveBeenCalledWith("Ab3dEf7h9J");
    });

    test("opens avatar dialog for avtr_ prefix", () => {
      store.directAccessParse("avtr_abc123");
      expect(mockShowAvatarDialog).toHaveBeenCalledWith("avtr_abc123");
    });

    test("opens avatar dialog for b_ prefix", () => {
      store.directAccessParse("b_something");
      expect(mockShowAvatarDialog).toHaveBeenCalledWith("b_something");
    });

    test("opens group dialog for grp_ prefix", () => {
      store.directAccessParse("grp_abc123");
      expect(mockShowGroupDialog).toHaveBeenCalledWith("grp_abc123");
    });

    test("parses vrchat.com user URL", () => {
      store.directAccessParse("https://vrchat.com/home/user/usr_abc123");
      expect(mockShowUserDialog).toHaveBeenCalledWith("usr_abc123");
    });

    test("parses vrchat.com avatar URL", () => {
      store.directAccessParse("https://vrchat.com/home/avatar/avtr_abc123");
      expect(mockShowAvatarDialog).toHaveBeenCalledWith("avtr_abc123");
    });

    test("parses vrchat.com group URL", () => {
      store.directAccessParse("https://vrchat.com/home/group/grp_abc123");
      expect(mockShowGroupDialog).toHaveBeenCalledWith("grp_abc123");
    });

    test("parses vrc.group short URL", () => {
      mockGroupStrictsearch.mockResolvedValue({ json: [] });
      store.directAccessParse("https://vrc.group/ABC.1234");
      expect(mockGroupStrictsearch).toHaveBeenCalledWith({
        query: "ABC.1234",
      });
    });

    test("parses group short code (e.g. ABCD.1234)", () => {
      mockGroupStrictsearch.mockResolvedValue({ json: [] });
      store.directAccessParse("ABCD.1234");
      expect(mockGroupStrictsearch).toHaveBeenCalledWith({
        query: "ABCD.1234",
      });
    });

    test("returns false for unrecognized input", () => {
      expect(store.directAccessParse("hello world")).toBe(false);
    });

    test("returns false for short vrchat URL with insufficient path segments", () => {
      expect(store.directAccessParse("https://vrchat.com/home")).toBe(false);
    });
  });

  describe("directAccessWorld", () => {
    test("returns false for unrecognized input", () => {
      expect(store.directAccessWorld("hello")).toBe(false);
    });

    test("opens world dialog for wrld_ prefix", () => {
      store.directAccessWorld("wrld_abc123:12345~friends");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc123:12345~friends");
    });

    test("opens world dialog for wld_ prefix", () => {
      store.directAccessWorld("wld_abc");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wld_abc");
    });

    test("opens world dialog for o_ prefix", () => {
      store.directAccessWorld("o_test123");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("o_test123");
    });

    test("handles wrld_ with &instanceId= by internally rewriting to URL", () => {
      store.directAccessWorld("wrld_abc&instanceId=123");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc:123");
    });

    test("resolves 8-char shortName via API", async () => {
      mockGetInstanceFromShortName.mockResolvedValue({
        json: { location: "wrld_abc:123", shortName: "AbCdEfGh" },
      });
      store.directAccessWorld("AbCdEfGh");
      expect(mockGetInstanceFromShortName).toHaveBeenCalledWith({
        shortName: "AbCdEfGh",
      });
      await vi.waitFor(() => {
        expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc:123", "AbCdEfGh");
      });
    });

    test("resolves vrch.at short URL via API", async () => {
      mockGetInstanceFromShortName.mockResolvedValue({
        json: { location: "wrld_abc:123", shortName: "XyZ12345" },
      });
      store.directAccessWorld("https://vrch.at/XyZ12345");
      expect(mockGetInstanceFromShortName).toHaveBeenCalledWith({
        shortName: "XyZ12345",
      });
      await vi.waitFor(() => {
        expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc:123", "XyZ12345");
      });
    });

    test("parses vrchat.com/home/world/ URL", () => {
      store.directAccessWorld("https://vrchat.com/home/world/wrld_abc123");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc123");
    });

    test("parses launch URL with worldId only", () => {
      store.directAccessWorld("https://vrchat.com/home/launch?worldId=wrld_abc");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc");
    });

    test("parses launch URL with worldId and instanceId", () => {
      store.directAccessWorld("https://vrchat.com/home/launch?worldId=wrld_abc&instanceId=123");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc:123");
    });

    test("parses launch URL with shortName via API", async () => {
      mockGetInstanceFromShortName.mockResolvedValue({
        json: {
          location: "wrld_abc:123",
          shortName: "myShort1",
        },
      });
      store.directAccessWorld("https://vrchat.com/home/launch?worldId=wrld_abc&instanceId=123&shortName=myShort1");
      expect(mockGetInstanceFromShortName).toHaveBeenCalledWith({
        shortName: "myShort1",
      });
      await vi.waitFor(() => {
        expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_abc:123", "myShort1");
      });
    });

    test("handles /home/ relative path by prepending https://vrchat.com", () => {
      store.directAccessWorld("/home/world/wrld_relpath");
      expect(mockShowWorldDialog).toHaveBeenCalledWith("wrld_relpath");
    });
  });
});
