import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

type FriendFixture = {
  id: string;
  state: "online" | "offline";
  name: string;
  ref: { location: string };
};

type LastLocationMock = {
  location: string;
  friendList: Map<string, unknown>;
};

type FriendsLocationsVm = {
  searchTerm: string;
  activeSegment: string;
};

const mocks = vi.hoisted(() => {
  const makeRef = <T>(value: T) => ({ value, __v_isRef: true });
  return {
    onlineFriends: makeRef<FriendFixture[]>([]),
    allFavoriteOnlineFriends: makeRef<FriendFixture[]>([]),
    allFavoriteFriendIds: makeRef(new Set<string>()),
    activeFriends: makeRef<FriendFixture[]>([]),
    offlineFriends: makeRef<FriendFixture[]>([]),
    friendsInSameInstance: makeRef<FriendFixture[][]>([]),
    isSidebarDivideByFriendGroup: makeRef(false),
    sidebarFavoriteGroups: makeRef<string[]>([]),
    sidebarFavoriteGroupOrder: makeRef<string[]>([]),
    sidebarSortMethods: makeRef("status"),
    favoriteFriendGroups: makeRef<{ key: string; displayName: string }[]>([]),
    groupedByGroupKeyFavoriteFriends: makeRef<Record<string, FriendFixture[]>>({}),
    localFriendFavorites: makeRef<Record<string, string[]>>({}),
    lastLocation: makeRef<LastLocationMock>({
      location: "wrld_home:123",
      friendList: new Map<string, unknown>(),
    }),
    configGetString: vi.fn<(key: string, defaultValue: string) => Promise<string>>(),
    configGetBool: vi.fn<(key: string, defaultValue: boolean | null) => Promise<boolean | null>>(),
    configSetString: vi.fn<(key: string, value: string) => Promise<void>>(),
    configSetBool: vi.fn<(key: string, value: boolean) => Promise<void>>(),
    virtualMeasure: vi.fn<() => void>(),
  };
});

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    storeToRefs: (store: unknown) => store,
  };
});

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref("en"),
    }),
  };
});

vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({
    onlineFriends: mocks.onlineFriends,
    allFavoriteOnlineFriends: mocks.allFavoriteOnlineFriends,
    allFavoriteFriendIds: mocks.allFavoriteFriendIds,
    activeFriends: mocks.activeFriends,
    offlineFriends: mocks.offlineFriends,
    friendsInSameInstance: mocks.friendsInSameInstance,
  }),
}));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    isSidebarDivideByFriendGroup: mocks.isSidebarDivideByFriendGroup,
    sidebarFavoriteGroups: mocks.sidebarFavoriteGroups,
    sidebarFavoriteGroupOrder: mocks.sidebarFavoriteGroupOrder,
    sidebarSortMethods: mocks.sidebarSortMethods,
  }),
}));
vi.mock("../../../src/stores/favorite", () => ({
  useFavoriteStore: () => ({
    favoriteFriendGroups: mocks.favoriteFriendGroups,
    groupedByGroupKeyFavoriteFriends: mocks.groupedByGroupKeyFavoriteFriends,
    localFriendFavorites: mocks.localFriendFavorites,
  }),
}));
vi.mock("../../../src/stores/location", () => ({
  useLocationStore: () => ({
    lastLocation: mocks.lastLocation,
  }),
}));

vi.mock("../../../src/services/config.ts", () => ({
  configRepository: {
    getString: (key: string, defaultValue: string) => mocks.configGetString(key, defaultValue),
    getBool: (key: string, isFallback: boolean | null) => mocks.configGetBool(key, isFallback),
    setString: (key: string, value: string) => mocks.configSetString(key, value),
    setBool: (key: string, isEnabled: boolean) => mocks.configSetBool(key, isEnabled),
  },
}));

vi.mock("../../../src/shared/utils/location", () => ({
  getFriendsLocations: (friends: { ref?: { location?: string } }[]) => friends[0]?.ref?.location ?? "",
}));

vi.mock("../../../src/shared/utils/friend", () => ({
  getFriendsSortFunction: () => (a: FriendFixture, b: FriendFixture) => a.name.localeCompare(b.name),
}));

vi.mock("@tanstack/vue-virtual", () => ({
  useVirtualizer: (optionsRef: { value: { count: number } }) => ({
    value: {
      getVirtualItems: () =>
        Array.from({ length: optionsRef.value.count }, (_, index) => ({
          index,
          key: index,
          start: index * 64,
        })),
      getTotalSize: () => optionsRef.value.count * 64,
      measure: () => mocks.virtualMeasure(),
      measureElement: vi.fn<(node: Element) => void>(),
    },
  }),
}));

vi.mock("lucide-vue-next", () => ({
  ChevronDown: { template: "<span />" },
  Loader2: { template: "<span />" },
  Settings: { template: "<span />" },
}));

vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/tabs/Tabs.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<div data-testid="tabs">' +
      "<button data-testid=\"segment-online\" @click=\"$emit('update:modelValue', 'online')\">online</button>" +
      "<button data-testid=\"segment-offline\" @click=\"$emit('update:modelValue', 'offline')\">offline</button>" +
      "<slot />" +
      "</div>",
  },
}));
vi.mock("@/components/ui/tabs/TabsList.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/tabs/TabsTrigger.vue", () => ({
  default: {
    props: ["value"],
    template: '<button :data-value="value"><slot /></button>',
  },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>",
  },
}));

vi.mock("@/components/ui/data-table/DataTableEmpty.vue", () => ({
  default: {
    props: ["type"],
    template: '<div data-testid="empty-state">{{ type }}</div>',
  },
}));

vi.mock("@/components/ui/input-group/InputGroupSearch.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<input data-testid="friend-locations-search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}));

vi.mock("../../../src/components/ui/popover/Popover.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/popover/PopoverContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/popover/PopoverTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/ui/slider/Slider.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<button data-testid="set-scale" @click="$emit(\'update:modelValue\', [0.8])">set-scale</button>',
  },
}));

vi.mock("../../../src/components/ui/switch/Switch.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<button data-testid="toggle-same-instance" @click="$emit(\'update:modelValue\', !modelValue)">toggle</button>',
  },
}));

vi.mock("../../../src/views/FriendsLocations/components/FriendsLocationsCard.vue", () => ({
  default: {
    props: ["friend"],
    template: '<div data-testid="friend-card">{{ friend.name }}</div>',
  },
}));

import FriendsLocations from "../../../src/views/FriendsLocations/FriendsLocations.vue";

function makeFriend(id: string, name: string, location = "wrld_1:instance"): FriendFixture {
  return {
    id,
    state: "online",
    name,
    ref: {
      location,
    },
  };
}

function isFriendsLocationsVm(value: unknown): value is FriendsLocationsVm {
  return typeof value === "object" && value !== null && "searchTerm" in value && "activeSegment" in value;
}

function requireFriendsLocationsVm(value: unknown): FriendsLocationsVm {
  if (!isFriendsLocationsVm(value)) {
    throw new Error("FriendsLocations.vue did not expose its setup state");
  }
  return value;
}

async function flushSettings() {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
  await nextTick();
}

describe("FriendsLocations.vue", () => {
  beforeEach(() => {
    mocks.onlineFriends.value = [];
    mocks.allFavoriteOnlineFriends.value = [];
    mocks.allFavoriteFriendIds.value = new Set();
    mocks.activeFriends.value = [];
    mocks.offlineFriends.value = [];
    mocks.friendsInSameInstance.value = [];
    mocks.isSidebarDivideByFriendGroup.value = false;
    mocks.sidebarFavoriteGroups.value = [];
    mocks.sidebarFavoriteGroupOrder.value = [];
    mocks.sidebarSortMethods.value = "status";
    mocks.favoriteFriendGroups.value = [];
    mocks.groupedByGroupKeyFavoriteFriends.value = {};
    mocks.localFriendFavorites.value = {};
    mocks.lastLocation.value = {
      location: "wrld_home:123",
      friendList: new Map<string, unknown>(),
    };

    mocks.configGetString.mockReset();
    mocks.configGetBool.mockReset();
    mocks.configSetString.mockReset();
    mocks.configSetBool.mockReset();
    mocks.configSetString.mockResolvedValue(undefined);
    mocks.configSetBool.mockResolvedValue(undefined);
    mocks.virtualMeasure.mockReset();

    mocks.configGetString.mockImplementation((_key, defaultValue) => Promise.resolve(defaultValue));
    mocks.configGetBool.mockResolvedValue(false);
  });

  test("renders online friend cards after initial settings load", async () => {
    mocks.onlineFriends.value = [makeFriend("usr_1", "Alice"), makeFriend("usr_2", "Bob")];
    const wrapper = mount(FriendsLocations);
    await flushSettings();

    const cards = wrapper.findAll('[data-testid="friend-card"]');
    expect(cards.map((node) => node.text())).toEqual(["Alice", "Bob"]);
  });

  test("filters cards by search text in DOM", async () => {
    mocks.onlineFriends.value = [makeFriend("usr_1", "Alice"), makeFriend("usr_2", "Bob")];
    const wrapper = mount(FriendsLocations);
    await flushSettings();

    await wrapper.get('[data-testid="friend-locations-search"]').setValue("bob");
    await flushSettings();

    const cards = wrapper.findAll('[data-testid="friend-card"]');
    expect(cards.map((node) => node.text())).toEqual(["Bob"]);
  });

  test("switches to offline segment and renders offline cards", async () => {
    mocks.onlineFriends.value = [makeFriend("usr_1", "Alice")];
    mocks.offlineFriends.value = [{ ...makeFriend("usr_3", "Carol"), state: "offline" }];
    const wrapper = mount(FriendsLocations);
    await flushSettings();

    await wrapper.get('[data-testid="segment-offline"]').trigger("click");
    await flushSettings();

    const cards = wrapper.findAll('[data-testid="friend-card"]');
    expect(cards.map((node) => node.text())).toEqual(["Carol"]);
  });

  test("persists card scale and same-instance preferences", async () => {
    vi.useFakeTimers();
    const wrapper = mount(FriendsLocations);
    await flushSettings();
    mocks.configSetString.mockClear();
    mocks.configSetBool.mockClear();

    await wrapper.get('[data-testid="set-scale"]').trigger("click");
    await wrapper.get('[data-testid="toggle-same-instance"]').trigger("click");
    vi.advanceTimersByTime(499);
    expect(mocks.configSetString).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(mocks.configSetString).toHaveBeenCalledWith("VRCX_FriendLocationCardScale", "0.8");
    expect(mocks.configSetBool).toHaveBeenCalledWith("VRCX_FriendLocationShowSameInstance", true);
    vi.useRealTimers();
  });

  test("coalesces repeated virtualizer measure requests in the same tick", async () => {
    const wrapper = mount(FriendsLocations);
    await flushSettings();
    mocks.virtualMeasure.mockClear();

    const vm = requireFriendsLocationsVm(wrapper.vm);
    vm.searchTerm = "alice";
    vm.activeSegment = "offline";
    await nextTick();
    await nextTick();

    expect(mocks.virtualMeasure).toHaveBeenCalledTimes(1);
  });

  test("renders empty state when no rows match", async () => {
    const wrapper = mount(FriendsLocations);
    await flushSettings();

    expect(wrapper.get('[data-testid="empty-state"]').text()).toBe("nomatch");
  });
});
