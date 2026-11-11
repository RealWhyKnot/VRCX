import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

type FeedFilterSettings = { status: string };
type SharedFeedFilters = { noty: FeedFilterSettings; wrist: FeedFilterSettings };

const mocks = vi.hoisted(() => {
  const sharedFeedFilters: { __v_isRef: true; value: SharedFeedFilters } = {
    __v_isRef: true,
    value: {
      noty: { status: "all" },
      wrist: { status: "none" },
    },
  };
  const photonLoggingEnabled: { __v_isRef: true; value: boolean } = { __v_isRef: true, value: false };
  return {
    sharedFeedFilters,
    photonLoggingEnabled,
    loadSharedFeed: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
    setString: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  };
});

vi.mock("pinia", async (importOriginal: () => Promise<Record<string, unknown>>) => ({
  ...(await importOriginal()),
  storeToRefs: (store: unknown) => store,
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

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
    loadSharedFeed: (...args: unknown[]) => mocks.loadSharedFeed(...args),
  }),
}));

vi.mock("../../../../src/services/config", () => ({
  configRepository: {
    setString: (...args: unknown[]) => mocks.setString(...args),
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
    if (!closeButton) {
      throw new Error("close button not found");
    }
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
    if (!resetButton) {
      throw new Error("reset button not found");
    }
    await resetButton.trigger("click");

    expect(mocks.sharedFeedFilters.value.noty).toEqual({
      status: "default-noty",
    });
    expect(mocks.setString).toHaveBeenCalled();
  });
});
