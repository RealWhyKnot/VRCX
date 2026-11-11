import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  isAgeGatedInstancesVisible: { value: true },
  groupInstances: {
    value: [
      {
        group: {
          groupId: "grp_1",
          name: "Group One",
          iconUrl: "https://example.com/icon.png",
        },
        instance: {
          id: "inst_1",
          ownerId: "usr_owner",
          userCount: 1,
          capacity: 16,
          location: "wrld_1:123",
        },
      },
    ],
  },
  sortGroupInstancesByInGame: (a, b) => a[0].group.name.localeCompare(b[0].group.name),
  showLaunchDialog: vi.fn(),
  checkCanInviteSelf: vi.fn(() => true),
  selfInvite: vi.fn().mockResolvedValue({}),
  showGroupDialog: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));

vi.mock("@tanstack/vue-virtual", () => ({
  useVirtualizer: (optionsRef) => ({
    value: {
      getVirtualItems: () =>
        Array.from({ length: optionsRef.value.count }, (_, index) => ({
          index,
          key: optionsRef.value.getItemKey(index),
          start: index * 52,
        })),
      getTotalSize: () => optionsRef.value.count * 52,
      measure: vi.fn(),
      measureElement: vi.fn(),
    },
  }),
}));

vi.mock("../../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    isAgeGatedInstancesVisible: mocks.isAgeGatedInstancesVisible,
  }),
}));
vi.mock("../../../../src/stores/group", () => ({
  useGroupStore: () => ({
    sortGroupInstancesByInGame: mocks.sortGroupInstancesByInGame,
    groupInstances: mocks.groupInstances,
  }),
}));
vi.mock("../../../../src/stores/launch", () => ({
  useLaunchStore: () => ({
    showLaunchDialog: (...a) => mocks.showLaunchDialog(...a),
  }),
}));

vi.mock("../../../../src/composables/use-invite-checks", () => ({
  useInviteChecks: () => ({
    checkCanInviteSelf: (...a) => mocks.checkCanInviteSelf(...a),
  }),
}));

vi.mock("../../../../src/shared/utils/common", () => ({
  convertFileUrlToImageUrl: (url) => `${url}?small`,
}));
vi.mock("../../../../src/shared/utils/location-parser", () => ({
  parseLocation: (location) => ({
    isRealInstance: !!location,
    worldId: location.split(":")[0],
    instanceId: location.split(":")[1],
  }),
}));

vi.mock("../../../../src/coordinators/group-coordinator", () => ({
  showGroupDialog: (...a) => mocks.showGroupDialog(...a),
}));

vi.mock("../../../../src/api/instance", () => ({
  default: {
    selfInvite: (...a) => mocks.selfInvite(...a),
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: (...a) => mocks.toastSuccess(...a),
  },
}));

vi.mock("../../../../src/components/ui/context-menu/ContextMenu.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../../src/components/ui/context-menu/ContextMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../../src/components/ui/context-menu/ContextMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../../src/components/ui/context-menu/ContextMenuItem.vue", () => ({
  default: {
    emits: ["click"],
    props: ["disabled"],
    template: '<button data-testid="ctx-item" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("../../../../src/components/BackToTop.vue", () => ({
  default: { template: '<div data-testid="back-to-top" />' },
}));

vi.mock("../../../../src/components/Location.vue", () => ({
  default: {
    props: ["location"],
    template: '<span data-testid="location">{{ location }}</span>',
  },
}));

vi.mock("lucide-vue-next", () => ({
  ChevronDown: { template: "<i />" },
  Users: { template: "<i />" },
}));

import GroupsSidebar from "../../../../src/views/Sidebar/components/GroupsSidebar.vue";

describe("GroupsSidebar.vue", () => {
  beforeEach(() => {
    mocks.showLaunchDialog.mockClear();
    mocks.selfInvite.mockClear();
    mocks.showGroupDialog.mockClear();
    mocks.toastSuccess.mockClear();
  });

  it("renders group rows and handles launch/self-invite actions", async () => {
    const wrapper = mount(GroupsSidebar);

    expect(wrapper.text()).toContain("Group One");

    await wrapper.get('[data-testid="location"]').trigger("click");
    expect(mocks.showGroupDialog).toHaveBeenCalledWith("usr_owner");

    const items = wrapper.findAll('[data-testid="ctx-item"]');
    await items[0].trigger("click");
    expect(mocks.showLaunchDialog).toHaveBeenCalledWith("wrld_1:123");

    await items[1].trigger("click");
    await Promise.resolve();
    expect(mocks.selfInvite).toHaveBeenCalledWith({
      worldId: "wrld_1",
      instanceId: "123",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.invite.self_sent");
  });
});
