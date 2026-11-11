import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  cachedInstances: new Map<string, { displayName?: string; closedAt?: string }>(),
  lastInstanceApplied: { value: "" },
  showLaunchDialog: vi.fn((_tag: string, _shortName: string) => Promise.resolve()),
  showGroupDialog: vi.fn((_groupId: string) => undefined),
  getGroupName: vi.fn((_groupId: string) => Promise.resolve("Fetched Group")),
  parseLocation: vi.fn((_location: string) => ({
    isRealInstance: true,
    tag: "wrld_1:inst_1",
    groupId: "grp_1",
  })),
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pinia")>();
  return {
    ...actual,
    storeToRefs: (store: object) => store,
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/stores/instance", () => ({
  useInstanceStore: () => ({
    cachedInstances: mocks.cachedInstances,
    lastInstanceApplied: mocks.lastInstanceApplied,
  }),
}));
vi.mock("../../src/stores/launch", () => ({
  useLaunchStore: () => ({
    showLaunchDialog: mocks.showLaunchDialog,
  }),
}));
vi.mock("../../src/stores/group", () => ({
  useGroupStore: () => ({}),
}));

vi.mock("../../src/coordinators/group-dialog-coordinator", () => ({
  showGroupDialog: mocks.showGroupDialog,
}));

vi.mock("../../src/shared/constants/access-type", () => ({
  accessTypeLocaleKeyMap: {
    friends: "dialog.world.instance.friends",
    groupPublic: "dialog.world.instance.group_public",
    group: "dialog.world.instance.group",
  },
}));

vi.mock("../../src/shared/utils/group", () => ({
  getGroupName: mocks.getGroupName,
}));
vi.mock("../../src/shared/utils/location-parser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/shared/utils/location-parser")>()),
  parseLocation: mocks.parseLocation,
}));

vi.mock("lucide-vue-next", () => ({
  AlertTriangle: { template: '<i data-testid="alert" />' },
  Lock: { template: '<i data-testid="lock" />' },
  Unlock: { template: '<i data-testid="unlock" />' },
}));

import LocationWorld from "../../src/components/LocationWorld.vue";
import type { ParsedLocation } from "../../src/types/vrcx";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function findClickable(wrapper: ReturnType<typeof mountComponent>, index: number) {
  const element = wrapper.findAll(".cursor-pointer")[index];
  if (!element) throw new Error(`no clickable element at index ${index}`);
  return element;
}

function mountComponent(props: Partial<{ locationobject: ParsedLocation; currentuserid: string; worlddialogshortname: string; grouphint: string }> = {}) {
  return mount(LocationWorld, {
    props: {
      locationobject: {
        tag: "wrld_1:inst_1",
        isOffline: false,
        isPrivate: false,
        isTraveling: false,
        isRealInstance: true,
        worldId: "wrld_1",
        instanceId: "inst_1",
        instanceName: "Instance Name",
        accessType: "friends",
        accessTypeName: "friends",
        region: "eu",
        shortName: "short-1",
        userId: "usr_owner",
        hiddenId: null,
        privateId: null,
        friendsId: null,
        groupId: "grp_1",
        groupAccessType: null,
        canRequestInvite: false,
        strict: false,
        ageGate: false,
      },
      currentuserid: "usr_owner",
      worlddialogshortname: "",
      grouphint: "",
      ...props,
    },
    global: {
      stubs: {
        TooltipWrapper: {
          props: ["content"],
          template: "<span><slot /></span>",
        },
      },
    },
  });
}

describe("LocationWorld.vue", () => {
  beforeEach(() => {
    mocks.cachedInstances = new Map();
    mocks.lastInstanceApplied.value = "";
    mocks.showLaunchDialog.mockClear();
    mocks.showGroupDialog.mockClear();
    mocks.getGroupName.mockClear();
    mocks.parseLocation.mockClear();
    mocks.parseLocation.mockImplementation((_location: string) => ({
      isRealInstance: true,
      tag: "wrld_1:inst_1",
      groupId: "grp_1",
    }));
  });

  it("marks unlocked for owner and opens launch dialog on click", async () => {
    const wrapper = mountComponent();

    expect(wrapper.find('[data-testid="unlock"]').exists()).toBe(true);

    await findClickable(wrapper, 0).trigger("click");

    expect(mocks.showLaunchDialog).toHaveBeenCalledWith("wrld_1:inst_1", "short-1");
  });

  it("shows group hint and opens group dialog", async () => {
    const wrapper = mountComponent({ grouphint: "Hint Group" });

    expect(wrapper.text()).toContain("(Hint Group)");

    await findClickable(wrapper, 1).trigger("click");

    expect(mocks.showGroupDialog).toHaveBeenCalledWith("grp_1");
  });

  it("loads group name asynchronously when no hint", async () => {
    const wrapper = mountComponent({ grouphint: "" });
    await flush();

    expect(mocks.getGroupName).toHaveBeenCalledWith("grp_1");
    expect(wrapper.text()).toContain("(Fetched Group)");
  });

  it("shows closed indicator and strict lock from instance cache", () => {
    mocks.cachedInstances = new Map([
      [
        "wrld_1:inst_1",
        {
          displayName: "Resolved Name",
          closedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    ]);

    const wrapper = mountComponent({
      locationobject: {
        tag: "wrld_1:inst_1",
        isOffline: false,
        isPrivate: false,
        isTraveling: false,
        isRealInstance: true,
        worldId: "wrld_1",
        instanceId: "inst_1",
        instanceName: "Fallback Name",
        accessType: "friends",
        accessTypeName: "friends",
        region: "us",
        shortName: "short-1",
        userId: "usr_other",
        hiddenId: null,
        privateId: null,
        friendsId: null,
        groupId: "grp_1",
        groupAccessType: null,
        canRequestInvite: false,
        strict: true,
        ageGate: false,
      },
      currentuserid: "usr_me",
    });

    expect(wrapper.text()).toContain("#Resolved Name");
    expect(wrapper.find('[data-testid="alert"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="lock"]').exists()).toBe(true);
  });
});
