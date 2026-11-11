import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  selfInvite: vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve({})),
  writeText: vi.fn<(text: string) => Promise<void>>(() => Promise.resolve()),
  getBool: vi.fn<(...args: unknown[]) => Promise<boolean>>(() => Promise.resolve(false)),
  launchDialogData: {
    value: {
      visible: true,
      loading: true,
      tag: "wrld_1:123",
      shortName: "abc",
    },
  },
}));

vi.stubGlobal("navigator", { clipboard: { writeText: mocks.writeText } });
afterAll(() => vi.unstubAllGlobals());

vi.mock("pinia", async (importOriginal) => ({ ...(await importOriginal()), storeToRefs: (s: unknown) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({ friends: ref(new Map()) }),
}));
vi.mock("../../../src/stores/game", () => ({
  useGameStore: () => ({ isGameRunning: ref(false) }),
}));
vi.mock("../../../src/stores/invite", () => ({
  useInviteStore: () => ({ canOpenInstanceInGame: ref(false) }),
}));
vi.mock("../../../src/stores/launch", () => ({
  useLaunchStore: () => ({
    launchDialogData: mocks.launchDialogData,
    launchGame: vi.fn(),
    tryOpenInstanceInVrc: vi.fn(),
  }),
}));
vi.mock("../../../src/stores/location", () => ({
  useLocationStore: () => ({ lastLocation: ref({ friendList: new Map() }) }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({ confirm: vi.fn() }),
}));
vi.mock("../../../src/shared/utils/instance", () => ({
  getLaunchURL: () => "vrchat://launch",
  isRealInstance: () => true,
}));
vi.mock("../../../src/shared/utils/location-parser", () => ({
  parseLocation: () => ({
    isRealInstance: true,
    worldId: "wrld_1",
    instanceId: "123",
    tag: "wrld_1:123",
  }),
}));
vi.mock("../../../src/composables/use-invite-checks", () => ({
  useInviteChecks: () => ({ checkCanInvite: () => true }),
}));
vi.mock("../../../src/api/instance", () => ({
  instanceRequest: {
    selfInvite: (...args: unknown[]) => mocks.selfInvite(...args),
    getInstanceShortName: vi.fn(),
  },
}));
vi.mock("../../../src/api/query-request", () => ({
  queryRequest: { fetch: vi.fn() },
}));
vi.mock("../../../src/services/config", () => ({
  configRepository: { getBool: (...args: unknown[]) => mocks.getBool(...args), setBool: vi.fn() },
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
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenu.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/button-group/ButtonGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/input-group/InputGroupField.vue", () => ({
  default: { template: "<input />" },
}));
vi.mock("@/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/dialogs/InviteDialog/InviteDialog.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("lucide-vue-next", () => ({
  Copy: { template: "<i />" },
  Info: { template: "<i />" },
  MoreHorizontal: { template: "<i />" },
}));

import LaunchDialog from "../../../src/components/dialogs/LaunchDialog.vue";

describe("LaunchDialog.vue", () => {
  beforeEach(() => {
    mocks.selfInvite.mockClear();
  });

  it("renders launch dialog header", async () => {
    const wrapper = mount(LaunchDialog);
    await Promise.resolve();
    expect(wrapper.text()).toContain("dialog.launch.header");
  });
});
