import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import type { GroupSidebarEntry } from "../../../../src/views/Sidebar/groups-sidebar-utils";

const mocks = vi.hoisted(() => {
  const groupInstances: GroupSidebarEntry[] = [
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
  ];
  return {
    isAgeGatedInstancesVisible: { value: true },
    groupInstances: { value: groupInstances },
    sortGroupInstancesByInGame: (a: GroupSidebarEntry, b: GroupSidebarEntry) => (a.group?.name ?? "").localeCompare(b.group?.name ?? ""),
    showLaunchDialog: vi.fn<(location: string) => Promise<void>>().mockResolvedValue(undefined),
    checkCanInviteSelf: vi.fn<(location: string | null | undefined) => boolean>(() => true),
    selfInvite: vi.fn<(request: { worldId: string; instanceId: string }) => Promise<void>>().mockResolvedValue(undefined),
    showGroupDialog: vi.fn<(groupId: string) => void>(),
    toastSuccess: vi.fn<(message: string) => void>(),
  };
});

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: <T>(store: T) => store,
  };
});
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/vue-virtual", () => ({
  useVirtualizer: (optionsRef: { value: { count: number; getItemKey: (index: number) => string | number } }) => ({
    value: {
      getVirtualItems: () =>
        Array.from({ length: optionsRef.value.count }, (_, index) => ({
          index,
          key: optionsRef.value.getItemKey(index),
          start: index * 52,
        })),
      getTotalSize: () => optionsRef.value.count * 52,
      measure: vi.fn<() => void>(),
      measureElement: vi.fn<(node: Element | null) => void>(),
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
    showLaunchDialog: mocks.showLaunchDialog,
  }),
}));

vi.mock("../../../../src/composables/use-invite-checks", () => ({
  useInviteChecks: () => ({
    checkCanInviteSelf: mocks.checkCanInviteSelf,
  }),
}));

vi.mock("../../../../src/shared/utils/common", () => ({
  convertFileUrlToImageUrl: (url: string) => `${url}?small`,
}));
vi.mock("../../../../src/shared/utils/location-parser", () => ({
  parseLocation: (location: string) => ({
    isRealInstance: !!location,
    worldId: location.split(":")[0],
    instanceId: location.split(":")[1],
  }),
}));

vi.mock("../../../../src/coordinators/group-dialog-coordinator", () => ({
  showGroupDialog: mocks.showGroupDialog,
}));

vi.mock("../../../../src/api/instance", () => ({
  instanceRequest: {
    selfInvite: mocks.selfInvite,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
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

    const [launchItem, selfInviteItem] = wrapper.findAll('[data-testid="ctx-item"]');
    if (!launchItem || !selfInviteItem) {
      throw new Error("context menu items not rendered");
    }
    await launchItem.trigger("click");
    expect(mocks.showLaunchDialog).toHaveBeenCalledWith("wrld_1:123");

    await selfInviteItem.trigger("click");
    await Promise.resolve();
    expect(mocks.selfInvite).toHaveBeenCalledWith({
      worldId: "wrld_1",
      instanceId: "123",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.invite.self_sent");
  });
});
