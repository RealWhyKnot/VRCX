import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { DOMWrapper } from "@vue/test-utils";
import type { NavLayoutEntry } from "../../../src/components/nav-menu/nav-menu-types";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("@/shared/utils/app-actions", () => ({
  openExternalLink: vi.fn(),
}));
vi.mock("../../../src/stores/dashboard", () => ({
  useDashboardStore: () => ({
    createDashboard: vi.fn(() =>
      Promise.resolve({
        id: "dashboard-1",
        name: "Dashboard",
        icon: "ri-dashboard-line",
      })
    ),
    getDashboard: vi.fn(() => ({
      id: "dashboard-1",
      name: "Dashboard",
      icon: "ri-dashboard-line",
    })),
    updateDashboard: vi.fn(() => Promise.resolve()),
    deleteDashboard: vi.fn(() => Promise.resolve()),
    setEditingDashboardId: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({
    confirm: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));
vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/hover-card/HoverCard.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/hover-card/HoverCardContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/hover-card/HoverCardTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/input-group/InputGroupButton.vue", () => ({
  default: { template: "<button><slot /></button>" },
}));
vi.mock("@/components/ui/input-group/InputGroupField.vue", () => ({
  default: { template: "<input />" },
}));
vi.mock("@/components/ui/separator/Separator.vue", () => ({
  default: { template: "<hr />" },
}));
vi.mock("@/components/ui/tree/Tree.vue", () => ({
  default: {
    props: ["items"],
    template: '<div><slot :flatten-items="[]" /></div>',
  },
}));
vi.mock("@dnd-kit/vue", () => ({
  DragDropProvider: { template: "<div><slot /></div>" },
}));
vi.mock("@dnd-kit/vue/sortable", () => ({ isSortable: () => false }));
vi.mock("lucide-vue-next", () => new Proxy({}, { get: () => ({ template: "<i />" }) }));
vi.mock("../../../src/components/dialogs/SortableTreeNode.vue", () => ({
  default: { template: "<div />" },
}));

import CustomNavDialog from "../../../src/components/dialogs/CustomNavDialog.vue";

const findButtonByText = (buttons: DOMWrapper<Element>[], text: string) => {
  const button = buttons.find((candidate) => candidate.text().includes(text));
  if (!button) {
    throw new Error(`no button contains "${text}"`);
  }
  return button;
};

describe("CustomNavDialog.vue", () => {
  it("keeps folder nameKey when restoring defaults and saving", async () => {
    const defaultLayout: NavLayoutEntry[] = [
      {
        type: "folder",
        id: "default-folder-social",
        nameKey: "nav_tooltip.social",
        name: "Social",
        icon: "ri-group-line",
        items: ["friend-log"],
      },
    ];

    const wrapper = mount(CustomNavDialog, {
      props: {
        visible: true,
        layout: [],
        hiddenKeys: [],
        defaultLayout,
      },
    });

    const buttons = wrapper.findAll('[data-testid="btn"]');
    const resetButton = findButtonByText(buttons, "nav_menu.custom_nav.restore_default");
    const saveButton = findButtonByText(buttons, "common.actions.confirm");

    await resetButton.trigger("click");
    await saveButton.trigger("click");

    const emitted = wrapper.emitted<[NavLayoutEntry[], string[]]>("save");
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0]).toEqual(defaultLayout);
    expect(emitted?.[0]?.[0]?.[0]).toMatchObject({ nameKey: "nav_tooltip.social" });
  });
});
