import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  openExternalLink: vi.fn<(...args: unknown[]) => void>(),
  getVRChatResolution: vi.fn((res: string) => res),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  appApi: {
    ReadConfigFileSafe: vi.fn<() => Promise<string>>().mockResolvedValue(""),
    WriteConfigFile: vi.fn<(json: string) => Promise<void>>().mockResolvedValue(undefined),
  },
  assetBundleManager: {
    DeleteAllCache: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
  sweepVRChatCache: vi.fn<(...args: unknown[]) => void>(),
  getVRChatCacheSize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  folderSelectorDialog: vi.fn<(oldPath?: string | null) => Promise<string | null>>().mockResolvedValue(null),
  confirm: vi.fn<(options: unknown) => Promise<{ ok: boolean }>>().mockResolvedValue({ ok: false }),
}));

const isVRChatConfigDialogVisible = ref(false);
const VRChatUsedCacheSize = ref("5.2");
const VRChatTotalCacheSize = ref("30");
const VRChatCacheSizeLoading = ref(false);

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
  defineStore: (_id: string, setup: unknown) => setup,
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    locale: ref("en"),
  }),
}));

vi.mock("../../../../src/stores/game", () => ({
  useGameStore: () => ({
    VRChatUsedCacheSize,
    VRChatTotalCacheSize,
    VRChatCacheSizeLoading,
    getVRChatCacheSize: mocks.getVRChatCacheSize,
  }),
}));
vi.mock("../../../../src/stores/settings/advanced", () => ({
  useAdvancedSettingsStore: () => ({
    isVRChatConfigDialogVisible,
    folderSelectorDialog: mocks.folderSelectorDialog,
  }),
}));
vi.mock("../../../../src/stores/modal", () => ({
  useModalStore: () => ({
    confirm: mocks.confirm,
  }),
}));

vi.mock("../../../../src/shared/utils/app-actions", () => ({
  openExternalLink: (...args: unknown[]) => mocks.openExternalLink(...args),
}));
vi.mock("../../../../src/shared/utils/setting", () => ({
  getVRChatResolution: (res: string) => mocks.getVRChatResolution(res),
}));

vi.mock("../../../../src/shared/constants/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/shared/constants/settings")>();
  return {
    ...actual,
    VRChatCameraResolutions: [
      { name: "1920x1080 (1080p)", width: 1920, height: 1080 },
      { name: "3840x2160 (4K)", width: 3840, height: 2160 },
      { name: "Default", width: 0, height: 0 },
    ],
    VRChatScreenshotResolutions: [
      { name: "1920x1080 (1080p)", width: 1920, height: 1080 },
      { name: "3840x2160 (4K)", width: 3840, height: 2160 },
      { name: "Default", width: 0, height: 0 },
    ],
  };
});

vi.mock("vue-sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("../../../../src/coordinators/game-coordinator", () => ({
  runSweepVRChatCacheFlow: (...args: unknown[]) => mocks.sweepVRChatCache(...args),
}));

vi.stubGlobal("AppApi", mocks.appApi);
vi.stubGlobal("AssetBundleManager", mocks.assetBundleManager);

import VRChatConfigDialog from "../../../../src/views/Settings/dialogs/VRChatConfigDialog.vue";

function mountComponent() {
  return mount(VRChatConfigDialog, {
    global: {
      stubs: {
        Dialog: {
          props: ["open"],
          emits: ["update:open"],
          template: '<div data-testid="dialog" v-if="open"><slot /></div>',
        },
        DialogContent: { template: "<div><slot /></div>" },
        DialogHeader: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<h2><slot /></h2>" },
        DialogFooter: {
          template: '<div data-testid="footer"><slot /></div>',
        },
        Button: {
          emits: ["click"],
          props: ["variant", "disabled", "size"],
          template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
        },
        InputGroupAction: {
          props: ["modelValue", "placeholder", "size", "type", "min", "max"],
          emits: ["update:modelValue", "input"],
          template:
            '<div data-testid="input-group"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'input\')" /><slot name="actions" /></div>',
        },
        Select: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: '<div data-testid="select"><slot /></div>',
        },
        SelectTrigger: {
          props: ["size"],
          template: "<div><slot /></div>",
        },
        SelectValue: {
          props: ["placeholder"],
          template: "<span>{{ placeholder }}</span>",
        },
        SelectContent: { template: "<div><slot /></div>" },
        SelectGroup: { template: "<div><slot /></div>" },
        SelectItem: {
          props: ["value"],
          template: '<option :value="value"><slot /></option>',
        },
        Checkbox: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        },
        TooltipWrapper: {
          props: ["side", "content"],
          template: "<div><slot /></div>",
        },
        Spinner: { template: '<span data-testid="spinner" />' },
        RefreshCw: { template: "<span />" },
        FolderOpen: { template: "<span />" },
      },
    },
  });
}

describe("VRChatConfigDialog.vue", () => {
  beforeEach(() => {
    isVRChatConfigDialogVisible.value = false;
    VRChatUsedCacheSize.value = "5.2";
    VRChatTotalCacheSize.value = "30";
    VRChatCacheSizeLoading.value = false;
    mocks.appApi.ReadConfigFileSafe.mockResolvedValue("");
    mocks.confirm.mockResolvedValue({ ok: false });
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    test("does not render when not visible", () => {
      const wrapper = mountComponent();
      expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);
    });
  });
});
