import { beforeEach, describe, expect, test, vi } from "vitest";
import { ref } from "vue";

const mocks = vi.hoisted(() => {
  const state: { userDialog: unknown; currentUser: unknown; isGameRunning: unknown; lastLocation: unknown } = {
    userDialog: undefined,
    currentUser: undefined,
    isGameRunning: undefined,
    lastLocation: undefined,
  };
  return {
    moderateInstanceUser: vi.fn<(params: { userId: string; type: string; reason: string; worldId: string; instanceId: string }) => Promise<unknown>>(),
    prompt: vi.fn<(options: { title: string; description: string; pattern?: RegExp }) => Promise<{ ok: boolean; value: string }>>(),
    toastSuccess: vi.fn<(message: string) => void>(),
    logError: vi.fn<(err: unknown) => void>(),
    state,
    groups: new Map<string, { myMember: { permissions: string[] } }>(),
  };
});

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("pinia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("pinia")>()),
  storeToRefs: (store: unknown) => store,
}));
vi.mock("../../../../src/api/player-moderation", () => ({ playerModerationRequest: { moderateInstanceUser: mocks.moderateInstanceUser } }));
vi.mock("../../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../../../src/stores/modal", () => ({ useModalStore: () => ({ prompt: mocks.prompt }) }));
vi.mock("../../../../src/stores/group", () => ({ useGroupStore: () => ({ cachedGroups: mocks.groups }) }));
vi.mock("../../../../src/stores/user", () => ({ useUserStore: () => ({ userDialog: mocks.state.userDialog, currentUser: mocks.state.currentUser }) }));
vi.mock("../../../../src/stores/game", () => ({ useGameStore: () => ({ isGameRunning: mocks.state.isGameRunning }) }));
vi.mock("../../../../src/stores/location", () => ({ useLocationStore: () => ({ lastLocation: mocks.state.lastLocation }) }));

import {
  MODERATION_REASON_MAX_LENGTH,
  canModerateInstance,
  useInstanceModeration,
} from "../../../../src/components/dialogs/UserDialog/composables/use-instance-moderation";

const ME = "usr_me";
const OTHER = "usr_other";
const MY_INSTANCE = `wrld_1:12345~private(${ME})~region(eu)`;
const GROUP_INSTANCE = "wrld_1:12345~group(grp_1)~groupAccessType(members)~region(eu)";

function noGroup() {
  return undefined;
}

function setState(location: string, options: { isGameRunning?: boolean; players?: string[]; targetId?: string } = {}) {
  const userDialog = ref({ id: options.targetId ?? OTHER, ref: { displayName: "Other Person" } });
  const lastLocation = ref({ location, playerList: new Map((options.players ?? [ME, OTHER]).map((id) => [id, {}])) });
  mocks.state.userDialog = userDialog;
  mocks.state.currentUser = ref({ id: ME });
  mocks.state.isGameRunning = ref(options.isGameRunning ?? true);
  mocks.state.lastLocation = lastLocation;
  return { userDialog, lastLocation };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("canModerateInstance", () => {
  test("allows the owner of a private instance", () => {
    expect(canModerateInstance(MY_INSTANCE, ME, noGroup)).toBe(true);
  });

  test("refuses someone else's instance and public ones", () => {
    expect(canModerateInstance(`wrld_1:12345~private(${OTHER})~region(eu)`, ME, noGroup)).toBe(false);
    expect(canModerateInstance("wrld_1:12345~region(eu)", ME, noGroup)).toBe(false);
  });

  test("needs the instance moderation permission in a group instance", () => {
    expect(canModerateInstance(GROUP_INSTANCE, ME, noGroup)).toBe(false);
    expect(canModerateInstance(GROUP_INSTANCE, ME, () => ({ myMember: { permissions: ["group-instance-join"] } }))).toBe(false);
    expect(canModerateInstance(GROUP_INSTANCE, ME, () => ({ myMember: { permissions: ["group-instance-moderate"] } }))).toBe(true);
    expect(canModerateInstance(GROUP_INSTANCE, ME, () => ({ myMember: { permissions: ["*"] } }))).toBe(true);
  });

  test.each([[""], ["offline"], ["private"], ["traveling"], ["local:1"], ["wrld_1"]])("refuses %j", (location) => {
    expect(canModerateInstance(location, ME, noGroup)).toBe(false);
  });

  test("refuses when nobody is signed in", () => {
    expect(canModerateInstance(MY_INSTANCE, "", noGroup)).toBe(false);
  });
});

describe("useInstanceModeration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groups.clear();
    mocks.moderateInstanceUser.mockResolvedValue({});
    mocks.prompt.mockResolvedValue({ ok: true, value: "  being rude  " });
  });

  test("offers moderation for another player in my instance", () => {
    setState(MY_INSTANCE);
    expect(useInstanceModeration().canModerateTarget.value).toBe(true);
  });

  test("hides it for myself, absent players, a closed game and other people's instances", () => {
    setState(MY_INSTANCE, { targetId: ME });
    expect(useInstanceModeration().canModerateTarget.value).toBe(false);
    setState(MY_INSTANCE, { players: [ME] });
    expect(useInstanceModeration().canModerateTarget.value).toBe(false);
    setState(MY_INSTANCE, { isGameRunning: false });
    expect(useInstanceModeration().canModerateTarget.value).toBe(false);
    setState(`wrld_1:12345~private(${OTHER})`);
    expect(useInstanceModeration().canModerateTarget.value).toBe(false);
  });

  test("uses cached group permissions in a group instance", () => {
    setState(GROUP_INSTANCE);
    expect(useInstanceModeration().canModerateTarget.value).toBe(false);
    mocks.groups.set("grp_1", { myMember: { permissions: ["group-instance-moderate"] } });
    setState(GROUP_INSTANCE);
    expect(useInstanceModeration().canModerateTarget.value).toBe(true);
  });

  test("kicks with the trimmed reason and confirms", async () => {
    setState(MY_INSTANCE);
    useInstanceModeration().moderateTarget("kick");
    await settle();
    expect(mocks.moderateInstanceUser).toHaveBeenCalledWith({
      userId: OTHER,
      type: "kick",
      reason: "being rude",
      worldId: "wrld_1",
      instanceId: `12345~private(${ME})~region(eu)`,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("message.user.instance_kick_done");
  });

  test("sends nothing when the prompt is cancelled or the reason is blank", async () => {
    setState(MY_INSTANCE);
    mocks.prompt.mockResolvedValueOnce({ ok: false, value: "typed then cancelled" });
    useInstanceModeration().moderateTarget("warn");
    await settle();
    mocks.prompt.mockResolvedValueOnce({ ok: true, value: "    " });
    useInstanceModeration().moderateTarget("warn");
    await settle();
    expect(mocks.moderateInstanceUser).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  test("limits the reason length in the prompt and in the request", async () => {
    setState(MY_INSTANCE);
    mocks.prompt.mockResolvedValueOnce({ ok: true, value: "r".repeat(100_000) });
    useInstanceModeration().moderateTarget("warn");
    await settle();
    const pattern = mocks.prompt.mock.calls[0]?.[0].pattern;
    expect(pattern?.test("r".repeat(MODERATION_REASON_MAX_LENGTH))).toBe(true);
    expect(pattern?.test("r".repeat(MODERATION_REASON_MAX_LENGTH + 1))).toBe(false);
    expect(pattern?.test("")).toBe(false);
    expect(mocks.moderateInstanceUser.mock.calls[0]?.[0].reason).toHaveLength(MODERATION_REASON_MAX_LENGTH);
  });

  test("logs a refused request and shows no success", async () => {
    setState(MY_INSTANCE);
    mocks.moderateInstanceUser.mockRejectedValueOnce(new Error("You cannot moderate this user"));
    useInstanceModeration().moderateTarget("kick");
    await settle();
    await settle();
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
