import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, type Ref } from "vue";
import PhotonEventTable from "../../../src/views/PlayerList/components/PhotonEventTable.vue";

const mocks = vi.hoisted(() => ({
  saveChatboxUserBlacklist: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  showUserDialog: vi.fn<(...args: unknown[]) => void>(),
  lookupUser: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  showWorldDialog: vi.fn<(...args: unknown[]) => void>(),
  showFullscreenImageDialog: vi.fn<(...args: unknown[]) => void>(),
  getCurrentInstanceUserList: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  tableSetOptions: vi.fn<(...args: unknown[]) => void>(),
  photonColumnToggleVisibility: vi.fn<(...args: unknown[]) => void>(),
  photonEventTableFilterChange: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
}));

const state: {
  randomUserColours: Ref<boolean>;
  photonLoggingEnabled: Ref<boolean>;
  chatboxUserBlacklist: Ref<Map<string, string>>;
  lastLocation: Ref<{ playerList: Set<unknown>; friendList: Set<unknown>; date: null }>;
  currentInstanceLocation: Ref<Record<string, unknown>>;
  currentInstanceWorld: Ref<{
    ref: {
      id: string;
      thumbnailImageUrl: string;
      imageUrl: string;
      name: string;
      authorId: string;
      authorName: string;
      releaseStatus: string;
      description: string;
    };
    fileAnalysis: Record<string, unknown>;
    isPC: boolean;
    isQuest: boolean;
    isIos: boolean;
  }>;
  currentInstanceUsersData: Ref<unknown[]>;
  currentUser: Ref<{ id: string; $homeLocation: null }>;
} = {
  randomUserColours: ref(false),
  photonLoggingEnabled: ref(false),
  chatboxUserBlacklist: ref(new Map<string, string>()),
  lastLocation: ref({ playerList: new Set(), friendList: new Set(), date: null }),
  currentInstanceLocation: ref({}),
  currentInstanceWorld: ref({
    ref: {
      id: "",
      thumbnailImageUrl: "",
      imageUrl: "",
      name: "",
      authorId: "",
      authorName: "",
      releaseStatus: "public",
      description: "",
    },
    fileAnalysis: {},
    isPC: false,
    isQuest: false,
    isIos: false,
  }),
  currentInstanceUsersData: ref([]),
  currentUser: ref({ id: "usr_me", $homeLocation: null }),
};

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: <T>(store: T) => store,
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref("en"),
  }),
}));

vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    randomUserColours: state.randomUserColours,
  }),
}));
vi.mock("../../../src/stores/photon", () => ({
  usePhotonStore: () => ({
    photonLoggingEnabled: state.photonLoggingEnabled,
    chatboxUserBlacklist: state.chatboxUserBlacklist,
    saveChatboxUserBlacklist: (...args: unknown[]) => mocks.saveChatboxUserBlacklist(...args),
    photonEventTable: ref({ data: [], pageSize: 10 }),
    photonEventTablePrevious: ref({ data: [], pageSize: 10 }),
    photonEventTableTypeFilter: ref([]),
    photonEventTableFilter: ref(""),
    photonEventIcon: ref(false),
    photonEventTableFilterChange: (...args: unknown[]) => mocks.photonEventTableFilterChange(...args),
    showUserFromPhotonId: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: state.currentUser,
  }),
}));
vi.mock("../../../src/stores/world", () => ({
  useWorldStore: () => ({
    showWorldDialog: (...args: unknown[]) => mocks.showWorldDialog(...args),
  }),
}));
vi.mock("../../../src/stores/location", () => ({
  useLocationStore: () => ({
    lastLocation: state.lastLocation,
  }),
}));
vi.mock("../../../src/stores/instance", () => ({
  useInstanceStore: () => ({
    currentInstanceLocation: state.currentInstanceLocation,
    currentInstanceWorld: state.currentInstanceWorld,
    currentInstanceUsersData: state.currentInstanceUsersData,
    getCurrentInstanceUserList: (...args: unknown[]) => mocks.getCurrentInstanceUserList(...args),
  }),
}));
vi.mock("../../../src/stores/gallery", () => ({
  useGalleryStore: () => ({
    showFullscreenImageDialog: (...args: unknown[]) => mocks.showFullscreenImageDialog(...args),
  }),
}));
vi.mock("../../../src/stores/search", () => ({
  useSearchStore: () => ({
    stringComparer: { value: (a: string, b: string) => a.localeCompare(b) },
  }),
}));
vi.mock("../../../src/stores/avatar", () => ({
  useAvatarStore: () => ({
    showAvatarDialog: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/group", () => ({
  useGroupStore: () => ({
    showGroupDialog: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/vrcx", () => ({
  useVrcxStore: () => ({
    ipcEnabled: ref(false),
  }),
}));

vi.mock("../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: (...args: unknown[]) => mocks.showUserDialog(...args),
  lookupUser: (...args: unknown[]) => mocks.lookupUser(...args),
}));

vi.mock("../../../src/lib/table/use-vrcx-vue-table", () => ({
  useVrcxVueTable: () => ({
    table: {
      setOptions: (...args: unknown[]) => mocks.tableSetOptions(...args),
      getColumn: (id: string) =>
        id === "photonId"
          ? {
              toggleVisibility: (...args: unknown[]) => mocks.photonColumnToggleVisibility(...args),
            }
          : null,
      getRowModel: () => ({ rows: state.currentInstanceUsersData.value }),
    },
  }),
}));

vi.mock("../../../src/views/PlayerList/columns.tsx", () => ({
  createColumns: () => [{ id: "photonId" }],
}));

vi.mock("../../../src/shared/utils/base/string", () => ({
  commaNumber: (value: string | number | undefined) => String(value ?? ""),
}));
vi.mock("../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: (value: string | number | undefined) => String(value ?? ""),
}));

vi.mock("@/components/ui/data-table/DataTableLayout.vue", () => ({
  default: {
    props: ["onRowClick"],
    template:
      "<div>" +
      "<button data-testid=\"row-click-with-id\" @click=\"onRowClick?.({ original: { ref: { id: 'usr_1', displayName: 'Alice' } } })\">row-id</button>" +
      '<button data-testid="row-click-without-id" @click="onRowClick?.({ original: { ref: { displayName: \'Bob\' } } })">row-no-id</button>' +
      "</div>",
  },
}));

vi.mock("@/components/ui/badge/Badge.vue", () => ({
  default: { template: "<span><slot /></span>" },
}));

vi.mock("@/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/LocationWorld.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("../../../src/components/Timer.vue", () => ({
  default: { template: "<span />" },
}));

vi.mock("../../../src/views/PlayerList/dialogs/ChatboxBlacklistDialog.vue", () => ({
  default: {
    props: ["chatboxBlacklistDialog"],
    emits: ["delete-chatbox-user-blacklist"],
    template:
      '<div data-testid="chatbox-dialog" :data-visible="String(chatboxBlacklistDialog.visible)">' +
      "<button data-testid=\"emit-delete-chatbox\" @click=\"$emit('delete-chatbox-user-blacklist', 'usr_blocked')\">delete</button>" +
      "</div>",
  },
}));

vi.mock("lucide-vue-next", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(actual).map((key) => [key, { template: "<span />" }]));
});

import PlayerList from "../../../src/views/PlayerList/PlayerList.vue";

const mountOptions = {
  global: {
    stubs: {
      TooltipWrapper: { template: "<div><slot /></div>" },
      LocationWorld: { template: "<div />" },
    },
  },
};

describe("PlayerList.vue", () => {
  beforeEach(() => {
    state.randomUserColours.value = false;
    state.photonLoggingEnabled.value = false;
    state.chatboxUserBlacklist.value = new Map([["usr_blocked", "Blocked User"]]);
    state.currentInstanceUsersData.value = [];

    mocks.saveChatboxUserBlacklist.mockReset();
    mocks.saveChatboxUserBlacklist.mockResolvedValue(undefined);
    mocks.showUserDialog.mockReset();
    mocks.lookupUser.mockReset();
    mocks.lookupUser.mockResolvedValue(undefined);
    mocks.showWorldDialog.mockReset();
    mocks.showFullscreenImageDialog.mockReset();
    mocks.getCurrentInstanceUserList.mockReset();
    mocks.getCurrentInstanceUserList.mockResolvedValue(undefined);
    mocks.tableSetOptions.mockReset();
    mocks.photonColumnToggleVisibility.mockReset();
    mocks.photonEventTableFilterChange.mockReset();
    mocks.photonEventTableFilterChange.mockResolvedValue(undefined);
  });

  test("loads current instance user list on mount and wires table options", () => {
    mount(PlayerList, mountOptions);

    expect(mocks.getCurrentInstanceUserList).toHaveBeenCalledTimes(1);
    expect(mocks.tableSetOptions).toHaveBeenCalledTimes(1);
    expect(mocks.photonColumnToggleVisibility).toHaveBeenCalledWith(false);
  });

  test("row click opens user dialog when id exists, otherwise lookups user", async () => {
    const wrapper = mount(PlayerList, mountOptions);

    await wrapper.get('[data-testid="row-click-with-id"]').trigger("click");
    await wrapper.get('[data-testid="row-click-without-id"]').trigger("click");

    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_1");
    expect(mocks.lookupUser).toHaveBeenCalledWith({ displayName: "Bob" });
  });

  test("toggles photonId column visibility when photon logging changes", async () => {
    mount(PlayerList, mountOptions);
    mocks.photonColumnToggleVisibility.mockClear();

    state.photonLoggingEnabled.value = true;
    await nextTick();

    expect(mocks.photonColumnToggleVisibility).toHaveBeenCalledWith(true);
  });

  test("opens chatbox blacklist dialog from photon event table", async () => {
    state.photonLoggingEnabled.value = true;
    const wrapper = mount(PlayerList, mountOptions);

    expect(wrapper.get('[data-testid="chatbox-dialog"]').attributes("data-visible")).toBe("false");
    wrapper.findComponent(PhotonEventTable).vm.$emit("show-chatbox-blacklist");
    await nextTick();

    expect(wrapper.get('[data-testid="chatbox-dialog"]').attributes("data-visible")).toBe("true");
  });

  test("deletes chatbox blacklist user and refreshes list", async () => {
    const wrapper = mount(PlayerList, mountOptions);

    await wrapper.get('[data-testid="emit-delete-chatbox"]').trigger("click");

    expect(state.chatboxUserBlacklist.value.has("usr_blocked")).toBe(false);
    expect(mocks.saveChatboxUserBlacklist).toHaveBeenCalledTimes(1);
    expect(mocks.getCurrentInstanceUserList).toHaveBeenCalledTimes(2);
  });
});
