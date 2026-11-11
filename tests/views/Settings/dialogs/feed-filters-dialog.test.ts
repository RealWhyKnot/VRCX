import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  sharedFeedFilters: {
    __v_isRef: true,
    value: {
      noty: { status: "all" },
      wrist: { status: "none" },
    },
  },
  photonLoggingEnabled: { __v_isRef: true, value: false },
  loadSharedFeed: vi.fn(),
  setString: vi.fn(),
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));

vi.mock("../../../../src/stores/photon", () => ({
  usePhotonStore: () => ({
    photonLoggingEnabled: mocks.photonLoggingEnabled,
  }),
}));
vi.mock("../../../../src/stores/settings/notifications", () => ({
  useNotificationsSettingsStore: () => ({
    sharedFeedFilters: mocks.sharedFeedFilters,
  }),
}));
vi.mock("../../../../src/stores/shared-feed", () => ({
  useSharedFeedStore: () => ({
    loadSharedFeed: (...a) => mocks.loadSharedFeed(...a),
  }),
}));

vi.mock("../../../../src/services/config", () => ({
  configRepository: {
    setString: (...a) => mocks.setString(...a),
  },
}));

vi.mock("../../../../src/shared/constants/feed-filters", () => ({
  feedFiltersOptions: () => ({
    notyFeedFiltersOptions: [
      {
        key: "status",
        name: "Noty Status",
        options: [{ label: "all", textKey: "all" }],
      },
    ],
    wristFeedFiltersOptions: [
      {
        key: "status",
        name: "Wrist Status",
        options: [{ label: "none", textKey: "none" }],
      },
    ],
    photonFeedFiltersOptions: [],
  }),
  sharedFeedFiltersDefaults: {
    noty: { status: "default-noty" },
    wrist: { status: "default-wrist" },
  },
}));

vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: {
    emits: ["update:open"],
    template: '<div><button data-testid="dialog-close" @click="$emit(\'update:open\', false)" /><slot /></div>',
  },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: '<h2 data-testid="dialog-title"><slot /></h2>' },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("../../../../src/components/ui/toggle-group/ToggleGroup.vue", () => ({
  default: {
    emits: ["update:model-value"],
    template: "<div><button data-testid=\"toggle-update\" @click=\"$emit('update:model-value', 'all')\" /><slot /></div>",
  },
}));
vi.mock("../../../../src/components/ui/toggle-group/ToggleGroupItem.vue", () => ({
  default: { template: "<button><slot /></button>" },
}));

vi.mock("lucide-vue-next", () => ({
  AlertTriangle: { template: "<i />" },
  Info: { template: "<i />" },
}));

import FeedFiltersDialog from "../../../../src/views/Settings/dialogs/FeedFiltersDialog.vue";

describe("FeedFiltersDialog.vue", () => {
  beforeEach(() => {
    mocks.sharedFeedFilters.value = {
      noty: { status: "all" },
      wrist: { status: "none" },
    };
    mocks.loadSharedFeed.mockClear();
    mocks.setString.mockClear();
  });

  it("renders title by mode, saves filter change, and closes dialog", async () => {
    const wrapper = mount(FeedFiltersDialog, {
      props: {
        feedFiltersDialogMode: "wrist",
      },
      global: {
        stubs: {
          TooltipWrapper: { template: "<span><slot /></span>" },
        },
      },
    });

    expect(wrapper.get('[data-testid="dialog-title"]').text()).toBe("dialog.shared_feed_filters.wrist");

    await wrapper.get('[data-testid="toggle-update"]').trigger("click");
    expect(mocks.sharedFeedFilters.value.wrist.status).toBe("all");
    expect(mocks.setString).toHaveBeenCalledWith("sharedFeedFilters", JSON.stringify(mocks.sharedFeedFilters.value));
    expect(mocks.loadSharedFeed).toHaveBeenCalledTimes(1);

    const closeButton = wrapper.findAll('[data-testid="btn"]')[1];
    await closeButton.trigger("click");
    expect(wrapper.emitted("update:feedFiltersDialogMode")).toEqual([[""]]);
  });

  it("resets noty filters to defaults", async () => {
    const wrapper = mount(FeedFiltersDialog, {
      props: {
        feedFiltersDialogMode: "noty",
      },
    });

    const resetButton = wrapper.findAll('[data-testid="btn"]')[0];
    await resetButton.trigger("click");

    expect(mocks.sharedFeedFilters.value.noty).toEqual({
      status: "default-noty",
    });
    expect(mocks.setString).toHaveBeenCalled();
  });
});
