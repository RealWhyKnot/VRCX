import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  selectResult: vi.fn((_item: unknown) => undefined),
  userImage: vi.fn((_user: unknown) => "https://example.com/u.png"),
  isOpen: { value: true },
  query: { value: "" },
  friendResults: { value: new Array<unknown>() },
  ownAvatarResults: { value: new Array<unknown>() },
  favoriteAvatarResults: { value: new Array<unknown>() },
  ownWorldResults: { value: new Array<unknown>() },
  favoriteWorldResults: { value: new Array<unknown>() },
  ownGroupResults: { value: new Array<unknown>() },
  joinedGroupResults: { value: new Array<unknown>() },
  hasResults: { value: false },
}));

vi.mock("pinia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("pinia")>()),
  storeToRefs: (store: object) => store,
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../src/stores/quick-search", () => ({
  useQuickSearchStore: () => ({
    isOpen: mocks.isOpen,
    query: mocks.query,
    friendResults: mocks.friendResults,
    ownAvatarResults: mocks.ownAvatarResults,
    favoriteAvatarResults: mocks.favoriteAvatarResults,
    ownWorldResults: mocks.ownWorldResults,
    favoriteWorldResults: mocks.favoriteWorldResults,
    ownGroupResults: mocks.ownGroupResults,
    joinedGroupResults: mocks.joinedGroupResults,
    hasResults: mocks.hasResults,
    selectResult: mocks.selectResult,
  }),
}));
vi.mock("../../src/composables/use-user-display", () => ({
  useUserDisplay: () => ({ userImage: mocks.userImage }),
}));
vi.mock("../../src/components/QuickSearchSync.vue", () => ({
  default: { template: '<div data-testid="sync" />' },
}));
vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogDescription.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/command/Command.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/command/CommandInput.vue", () => ({
  default: { template: "<input />" },
}));
vi.mock("@/components/ui/command/CommandList.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/command/CommandGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/command/CommandItem.vue", () => ({
  default: {
    emits: ["select"],
    template: '<button data-testid="cmd-item" @click="$emit(\'select\')"><slot /></button>',
  },
}));
vi.mock("lucide-vue-next", () => ({
  Globe: { template: "<i />" },
  Image: { template: "<i />" },
  Users: { template: "<i />" },
}));

import QuickSearchDialog from "../../src/components/QuickSearchDialog.vue";

describe("QuickSearchDialog.vue", () => {
  beforeEach(() => {
    mocks.selectResult.mockClear();
    mocks.query.value = "";
    mocks.hasResults.value = false;
    mocks.friendResults.value = [];
  });

  it("renders search dialog structure", () => {
    const wrapper = mount(QuickSearchDialog);
    expect(wrapper.text()).toContain("side_panel.search_placeholder");
    expect(wrapper.find('[data-testid="sync"]').exists()).toBe(true);
  });
});
