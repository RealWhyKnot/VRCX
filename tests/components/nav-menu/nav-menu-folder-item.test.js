import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock("lucide-vue-next", () => ({
  ChevronRight: { template: "<i />" },
}));

vi.mock("@/components/ui/sidebar/SidebarMenuItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/sidebar/SidebarMenuButton.vue", () => ({
  default: {
    template: '<button data-testid="folder-btn"><slot /></button>',
  },
}));
vi.mock("@/components/ui/sidebar/SidebarMenuSub.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/sidebar/SidebarMenuSubItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/sidebar/SidebarMenuSubButton.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="submenu-btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/collapsible/Collapsible.vue", () => ({
  default: { template: '<div><slot :open="true" /></div>' },
}));
vi.mock("@/components/ui/collapsible/CollapsibleTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/collapsible/CollapsibleContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
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
    template: "<button @click=\"$emit('click')\"><slot /></button>",
  },
}));
vi.mock("@/components/ui/context-menu/ContextMenuSeparator.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/ui/dropdown-menu/DropdownMenu.vue", () => ({
  default: {
    emits: ["update:open"],
    template: '<div><button data-testid="dropdown-open" @click="$emit(\'update:open\', true)" /><slot /></div>',
  },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuItem.vue", () => ({
  default: {
    emits: ["select"],
    template: "<button @click=\"$emit('select', $event)\"><slot /></button>",
  },
}));

import NavMenuFolderItem from "../../../src/components/nav-menu/NavMenuFolderItem.vue";

const folderItem = {
  index: "group-1",
  icon: "ri-folder-line",
  title: "Folder",
  titleIsCustom: true,
  children: [
    {
      index: "feed",
      label: "nav_tooltip.feed",
      icon: "ri-rss-line",
      titleIsCustom: false,
    },
  ],
};

describe("NavMenuFolderItem", () => {
  it("emits submenu-click in expanded mode", async () => {
    const wrapper = mount(NavMenuFolderItem, {
      props: {
        item: folderItem,
        isCollapsed: false,
        activeMenuIndex: "",
        collapsedDropdownOpenId: null,
        hasNotifications: false,
        isEntryNotified: () => false,
        isNavItemNotified: () => false,
        isDashboardItem: () => false,
        isToolItem: () => false,
      },
    });

    await wrapper.find('[data-testid="submenu-btn"]').trigger("click");

    expect(wrapper.emitted("submenu-click")).toBeTruthy();
  });

  it("emits collapsed-dropdown-open-change in collapsed mode", async () => {
    const wrapper = mount(NavMenuFolderItem, {
      props: {
        item: folderItem,
        isCollapsed: true,
        activeMenuIndex: "",
        collapsedDropdownOpenId: null,
        hasNotifications: false,
        isEntryNotified: () => false,
        isNavItemNotified: () => false,
        isDashboardItem: () => false,
        isToolItem: () => false,
      },
    });

    await wrapper.find('[data-testid="dropdown-open"]').trigger("click");

    expect(wrapper.emitted("collapsed-dropdown-open-change")).toBeTruthy();
  });
});
