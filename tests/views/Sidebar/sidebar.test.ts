import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  openSearch: vi.fn(),
  markAllAsSeen: vi.fn(),
  refreshFriends: vi.fn(),
  hasUnseen: { value: true },
  centerOpen: { value: false },
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useMagicKeys: () => ({}),
    whenever: vi.fn(),
  };
});
vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({
    friends: ref(new Map()),
    isRefreshFriendsLoading: ref(false),
    onlineFriendCount: ref(0),
  }),
}));
vi.mock("../../../src/stores/group", () => ({
  useGroupStore: () => ({ groupInstances: ref([]) }),
}));
vi.mock("../../../src/stores/notification", () => ({
  useNotificationStore: () => ({
    isNotificationCenterOpen: mocks.centerOpen,
    hasUnseenNotifications: mocks.hasUnseen,
    markAllAsSeen: (...a) => mocks.markAllAsSeen(...a),
  }),
}));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    sidebarSortMethod1: ref(""),
    sidebarSortMethod2: ref(""),
    sidebarSortMethod3: ref(""),
    isSidebarGroupByInstance: ref(false),
    isHideFriendsInSameInstance: ref(false),
    isSameInstanceAboveFavorites: ref(false),
    isSidebarDivideByFriendGroup: ref(false),
    sidebarFavoriteGroups: ref([]),
    setSidebarSortMethod1: vi.fn(),
    setSidebarSortMethod2: vi.fn(),
    setSidebarSortMethod3: vi.fn(),
    setIsSidebarGroupByInstance: vi.fn(),
    setIsHideFriendsInSameInstance: vi.fn(),
    setIsSameInstanceAboveFavorites: vi.fn(),
    setIsSidebarDivideByFriendGroup: vi.fn(),
    setSidebarFavoriteGroups: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/favorite", () => ({
  useFavoriteStore: () => ({
    favoriteFriendGroups: ref([]),
    localFriendFavoriteGroups: ref([]),
  }),
}));
vi.mock("../../../src/stores/quick-search", () => ({
  useQuickSearchStore: () => ({ open: (...a) => mocks.openSearch(...a) }),
}));
vi.mock("../../../src/coordinators/friend-sync-coordinator", () => ({
  runRefreshFriendsListFlow: (...a) => mocks.refreshFriends(...a),
}));
vi.mock("../../../src/views/Sidebar/sidebar-settings-utils", () => ({
  normalizeFavoriteGroupsChange: (v) => v,
  resolveFavoriteGroups: (v) => v,
}));
vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/context-menu/ContextMenu.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuItem.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="ctx" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/popover/Popover.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/popover/PopoverTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/popover/PopoverContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/Select.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectValue.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectSeparator.vue", () => ({
  default: { template: "<hr />" },
}));
vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/tabs/TabsUnderline.vue", () => ({
  default: {
    template: '<div><slot name="friends" /><slot name="groups" /></div>',
  },
}));
vi.mock("@/components/ui/switch/Switch.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ui/spinner/Spinner.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/kbd/Kbd.vue", () => ({
  default: { template: "<kbd><slot /></kbd>" },
}));
vi.mock("@/components/ui/separator/Separator.vue", () => ({
  default: { template: "<hr />" },
}));
vi.mock("@/components/ui/collapsible/Collapsible.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/collapsible/CollapsibleTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/collapsible/CollapsibleContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("lucide-vue-next", () => ({
  Bell: { template: "<i />" },
  ChevronDown: { template: "<i />" },
  RefreshCw: { template: "<i />" },
  Search: { template: "<i />" },
  Settings: { template: "<i />" },
}));
vi.mock("../../../src/views/Sidebar/components/FriendsSidebar.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/views/Sidebar/components/GroupsSidebar.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/views/Sidebar/components/FavoriteFriendGroupOrderDialog.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/views/Sidebar/components/NotificationCenterSheet.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/components/QuickSearchDialog.vue", () => ({
  default: { template: "<div />" },
}));

import Sidebar from "../../../src/views/Sidebar/Sidebar.vue";

describe("Sidebar.vue", () => {
  beforeEach(() => {
    mocks.openSearch.mockClear();
    mocks.markAllAsSeen.mockClear();
  });

  it("opens quick search and marks notifications read", async () => {
    const wrapper = mount(Sidebar);
    const buttons = wrapper.findAll("button");
    for (const button of buttons) {
      await button.trigger("click");
      if (mocks.openSearch.mock.calls.length > 0) {
        break;
      }
    }
    await wrapper.get('[data-testid="ctx"]').trigger("click");

    expect(mocks.openSearch).toHaveBeenCalled();
    expect(mocks.markAllAsSeen).toHaveBeenCalled();
  });
});
