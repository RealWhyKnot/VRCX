import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  checkCanInviteSelf: vi.fn(() => true),
  parseLocation: vi.fn(() => ({
    isRealInstance: true,
    instanceId: "inst_1",
    worldId: "wrld_1",
    tag: "wrld_1:inst_1",
  })),
  hasGroupPermission: vi.fn(() => false),
  formatDateFilter: vi.fn(() => "formatted-date"),
  selfInvite: vi.fn(() => Promise.resolve({})),
  closeInstance: vi.fn(() => Promise.resolve({ json: { id: "inst_closed" } })),
  showUserDialog: vi.fn(),
  toastSuccess: vi.fn(),
  applyInstance: vi.fn(),
  showLaunchDialog: vi.fn(() => Promise.resolve()),
  tryOpenInstanceInVrc: vi.fn(() => Promise.resolve()),
  modalConfirm: vi.fn(() => Promise.resolve({ ok: true })),
  instanceJoinHistory: { value: new Map<string, number>() },
  canOpenInstanceInGame: false,
  isOpeningInstance: false,
  lastLocation: {
    location: "wrld_here:111",
    playerList: new Set(["u1", "u2"]),
  },
  currentUser: { id: "usr_me" },
  cachedGroups: new Map<string, unknown>(),
}));

function unwrapStoreValue(key: string, value: unknown) {
  if (key === "instanceJoinHistory") return value;
  if (typeof value === "object" && value !== null && "value" in value) return value.value;
  return value;
}

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => Object.fromEntries(Object.entries(store).map(([key, value]) => [key, unwrapStoreValue(key, value)])),
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

vi.mock("../../src/stores/location", () => ({
  useLocationStore: () => ({
    lastLocation: mocks.lastLocation,
  }),
}));
vi.mock("../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: mocks.currentUser,
  }),
}));
vi.mock("../../src/stores/group", () => ({
  useGroupStore: () => ({
    cachedGroups: mocks.cachedGroups,
  }),
}));
vi.mock("../../src/stores/instance", () => ({
  useInstanceStore: () => ({
    instanceJoinHistory: mocks.instanceJoinHistory,
    applyInstance: mocks.applyInstance,
  }),
}));
vi.mock("../../src/stores/modal", () => ({
  useModalStore: () => ({
    confirm: mocks.modalConfirm,
  }),
}));
vi.mock("../../src/stores/launch", () => ({
  useLaunchStore: () => ({
    isOpeningInstance: mocks.isOpeningInstance,
    showLaunchDialog: mocks.showLaunchDialog,
    tryOpenInstanceInVrc: mocks.tryOpenInstanceInVrc,
  }),
}));
vi.mock("../../src/stores/invite", () => ({
  useInviteStore: () => ({
    canOpenInstanceInGame: mocks.canOpenInstanceInGame,
  }),
}));

vi.mock("../../src/composables/use-invite-checks", () => ({
  useInviteChecks: () => ({
    checkCanInviteSelf: mocks.checkCanInviteSelf,
  }),
}));

vi.mock("../../src/shared/utils/location-parser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/shared/utils/location-parser")>()),
  parseLocation: mocks.parseLocation,
}));
vi.mock("../../src/shared/utils/group", () => ({
  hasGroupPermission: mocks.hasGroupPermission,
}));
vi.mock("../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: mocks.formatDateFilter,
}));

vi.mock("../../src/api/instance", () => ({
  instanceRequest: {
    selfInvite: mocks.selfInvite,
  },
}));
vi.mock("../../src/api/misc", () => ({
  miscRequest: {
    closeInstance: mocks.closeInstance,
  },
}));

vi.mock("../../src/coordinators/user-coordinator", () => ({
  showUserDialog: mocks.showUserDialog,
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}));

vi.mock("lucide-vue-next", () => ({
  CalendarDays: { template: '<i data-testid="icon-calendar-days" />' },
  CalendarPlus: { template: '<i data-testid="icon-calendar-plus" />' },
  History: { template: '<i data-testid="icon-history" />' },
  Loader2: { template: '<i data-testid="icon-loader" />' },
  LogIn: { template: '<i data-testid="icon-login" />' },
  Mail: { template: '<i data-testid="icon-mail" />' },
  MapPin: { template: '<i data-testid="icon-map" />' },
  Megaphone: { template: '<i data-testid="icon-megaphone" />' },
  Pencil: { template: '<i data-testid="icon-pencil" />' },
  PowerIcon: { template: '<i data-testid="icon-power" />' },
  RefreshCw: { template: '<i data-testid="icon-refresh" />' },
  UsersRound: { template: '<i data-testid="icon-users" />' },
  SquareStack: { template: '<i data-testid="icon-stack" />' },
  Star: { template: '<i data-testid="icon-star" />' },
  IdCard: { template: '<i data-testid="icon-id-card" />' },
  TrainFront: { template: '<i data-testid="icon-train" />' },
  UserLock: { template: '<i data-testid="icon-user-lock" />' },
  UserPlus2: { template: '<i data-testid="icon-user-plus" />' },
}));

import InstanceActionBar from "../../src/components/InstanceActionBar.vue";

type MountBarProps = Partial<{
  launchLocation: string;
  inviteLocation: string;
  showLaunch: boolean;
  showInvite: boolean;
  showRefresh: boolean;
  showHistory: boolean;
  showInstanceInfo: boolean;
  onRefresh: () => void;
  onHistory: () => void;
}>;

function getActionButton(wrapper: ReturnType<typeof mountBar>, index: number) {
  const button = wrapper.findAll('[data-testid="btn"]')[index];
  if (!button) throw new Error(`no action button at index ${index}`);
  return button;
}

function mountBar(props: MountBarProps = {}) {
  return mount(InstanceActionBar, {
    props: {
      location: "wrld_base:111",
      launchLocation: "",
      inviteLocation: "",
      lastJoinLocation: "",
      instanceLocation: "",
      shortname: "sn",
      instance: {
        ownerId: "usr_me",
        capacity: 16,
        userCount: 4,
        hasCapacityForYou: true,
        platforms: { standalonewindows: 1, android: 2, ios: 0 },
        gameServerVersion: 123,
        $disabledContentSettings: [],
      },
      friendcount: 2,
      currentlocation: "",
      showLaunch: true,
      showInvite: true,
      showRefresh: true,
      showHistory: true,
      showLastJoin: true,
      showInstanceInfo: true,
      refreshTooltip: "refresh",
      historyTooltip: "history",
      onRefresh: vi.fn(),
      onHistory: vi.fn(),
      ...props,
    },
    global: {
      stubs: {
        TooltipWrapper: {
          props: ["content"],
          template: '<div><slot /><slot name="content" /><span v-if="content">{{ content }}</span></div>',
        },
        Timer: {
          props: ["epoch"],
          template: '<span data-testid="timer">{{ epoch }}</span>',
        },
      },
    },
  });
}

describe("InstanceActionBar.vue", () => {
  beforeEach(() => {
    mocks.checkCanInviteSelf.mockReturnValue(true);
    mocks.parseLocation.mockReturnValue({
      isRealInstance: true,
      instanceId: "inst_1",
      worldId: "wrld_1",
      tag: "wrld_1:inst_1",
    });
    mocks.hasGroupPermission.mockReturnValue(false);
    mocks.selfInvite.mockClear();
    mocks.closeInstance.mockClear();
    mocks.showUserDialog.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.applyInstance.mockClear();
    mocks.showLaunchDialog.mockClear();
    mocks.tryOpenInstanceInVrc.mockClear();
    mocks.modalConfirm.mockImplementation(() => Promise.resolve({ ok: true }));
    mocks.instanceJoinHistory.value = new Map([["wrld_base:111", 1700000000]]);
    mocks.canOpenInstanceInGame = false;
    mocks.isOpeningInstance = false;
    mocks.lastLocation.location = "wrld_here:111";
    mocks.lastLocation.playerList = new Set(["u1", "u2"]);
    mocks.currentUser.id = "usr_me";
    mocks.cachedGroups = new Map();
  });

  it("renders launch and invite buttons when invite-self is allowed", () => {
    const wrapper = mountBar({
      showRefresh: false,
      showHistory: false,
      showInstanceInfo: false,
    });

    expect(wrapper.findAll('[data-testid="btn"]').map((button) => button.attributes("aria-label"))).toEqual([
      "dialog.user.info.launch_invite_tooltip",
      "dialog.user.info.self_invite_tooltip",
      "dialog.user.info.rename_instance",
      "dialog.user.info.close_instance",
    ]);
    expect(wrapper.text()).toContain("dialog.user.info.launch_invite_tooltip");
    expect(wrapper.text()).toContain("dialog.user.info.self_invite_tooltip");
  });

  it("launch button opens launch dialog with resolved launchLocation", async () => {
    const wrapper = mountBar({
      launchLocation: "wrld_launch:222",
      showRefresh: false,
      showHistory: false,
      showInstanceInfo: false,
    });
    const launchBtn = getActionButton(wrapper, 0);

    await launchBtn.trigger("click");

    expect(mocks.showLaunchDialog).toHaveBeenCalledWith("wrld_launch:222");
  });

  it("invite button sends self-invite when canOpenInstanceInGame is false", async () => {
    const wrapper = mountBar({
      inviteLocation: "wrld_invite:333",
      showRefresh: false,
      showHistory: false,
      showInstanceInfo: false,
    });
    const inviteBtn = getActionButton(wrapper, 1);

    await inviteBtn.trigger("click");
    await Promise.resolve();

    expect(mocks.selfInvite).toHaveBeenCalledWith({
      instanceId: "inst_1",
      worldId: "wrld_1",
      shortName: "sn",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.invite.self_sent");
  });

  it("invite button opens in VRChat when canOpenInstanceInGame is true", async () => {
    mocks.canOpenInstanceInGame = true;
    const wrapper = mountBar({
      inviteLocation: "wrld_invite:333",
      showRefresh: false,
      showHistory: false,
      showInstanceInfo: false,
    });
    const inviteBtn = getActionButton(wrapper, 1);

    await inviteBtn.trigger("click");

    expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith("wrld_1:inst_1", "sn");
    expect(mocks.selfInvite).not.toHaveBeenCalled();
  });

  it("refresh/history callbacks run when buttons clicked", async () => {
    const onRefresh = vi.fn();
    const onHistory = vi.fn();
    const wrapper = mountBar({
      onRefresh,
      onHistory,
      showLaunch: false,
      showInvite: false,
      showInstanceInfo: false,
    });
    const buttons = wrapper.findAll('[data-testid="btn"]');
    expect(buttons.map((button) => button.attributes("aria-label"))).toEqual([
      "dialog.user.info.rename_instance",
      "dialog.user.info.close_instance",
      "common.actions.refresh",
      "dialog.social_status.history",
    ]);

    await wrapper.get('[aria-label="common.actions.refresh"]').trigger("click");
    await wrapper.get('[aria-label="dialog.social_status.history"]').trigger("click");

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it("hides launch and invite buttons when invite-self is not allowed", () => {
    mocks.checkCanInviteSelf.mockReturnValue(false);
    const wrapper = mountBar({
      showRefresh: false,
      showHistory: false,
      showInstanceInfo: false,
    });

    expect(wrapper.findAll('[data-testid="btn"]').map((button) => button.attributes("aria-label"))).toEqual([
      "dialog.user.info.rename_instance",
      "dialog.user.info.close_instance",
    ]);
  });
});
