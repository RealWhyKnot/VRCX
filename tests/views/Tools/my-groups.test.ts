import { beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { KeepAlive, defineComponent, h, reactive } from "vue";
import { TooltipProvider } from "reka-ui";

import type { GroupNotificationStats, GroupVisitStats } from "../../../src/shared/utils/group-overview";

type GroupEntry = { id: string; name: string; iconUrl: string; memberCount: number; ownerId: string };

const mocks = vi.hoisted(() => ({
  getGroupVisitStats: vi.fn<() => Promise<Map<string, GroupVisitStats>>>(),
  getGroupNotificationStats: vi.fn<() => Promise<Map<string, GroupNotificationStats>>>(),
  getCurrentUserGroups: vi.fn<() => Promise<void>>(),
  leaveGroupPrompt: vi.fn<(groupId: string) => void>(),
  showGroupDialog: vi.fn<(groupId: string) => Promise<void>>(),
  routerPush: vi.fn<(to: { name: string }) => Promise<void>>(),
  toastError: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
  groups: { value: new Map<string, GroupEntry>() },
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("../../../src/plugins/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("../../../src/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string, format: string) => `${format}:${value}` }));
vi.mock("../../../src/shared/utils/base/format", () => ({ timeToText: (ms: number) => `${ms}ms` }));
vi.mock("../../../src/shared/utils/common", () => ({ convertFileUrlToImageUrl: (url: string) => url }));
vi.mock("../../../src/coordinators/group-dialog-coordinator", () => ({ showGroupDialog: mocks.showGroupDialog }));
vi.mock("../../../src/coordinators/group-membership-coordinator", () => ({
  getCurrentUserGroups: mocks.getCurrentUserGroups,
  leaveGroupPrompt: mocks.leaveGroupPrompt,
}));
vi.mock("../../../src/services/database", () => ({
  database: { getGroupVisitStats: mocks.getGroupVisitStats, getGroupNotificationStats: mocks.getGroupNotificationStats },
}));
vi.mock("../../../src/stores/group", () => ({ useGroupStore: () => ({ currentUserGroups: mocks.groups.value }) }));
vi.mock("../../../src/stores/user", () => ({ useUserStore: () => ({ currentUser: { id: "usr_me" } }) }));
vi.mock("../../../src/stores/settings/appearance", () => ({ useAppearanceSettingsStore: () => ({ tablePageSizes: [10, 25, 50], tablePageSize: 25 }) }));
vi.mock("../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import MyGroups from "../../../src/views/Tools/MyGroups.vue";

const LONG = "G".repeat(5000);

function group(id: string, name: string, overrides: Partial<GroupEntry> = {}): GroupEntry {
  return { id: `grp_${id}`, name, iconUrl: "", memberCount: 10, ownerId: "usr_other", ...overrides };
}

function setGroups(entries: GroupEntry[]) {
  mocks.groups.value = reactive(new Map(entries.map((entry) => [entry.id, entry])));
}

const Host = defineComponent({ render: () => h(TooltipProvider, null, { default: () => h(KeepAlive, null, { default: () => h(MyGroups) }) }) });

async function open() {
  const wrapper = mount(Host, { attachTo: document.body, global: { stubs: { TooltipWrapper: { template: "<div><slot /></div>" } } } });
  await flushPromises();
  return wrapper;
}

function names(wrapper: Awaited<ReturnType<typeof open>>): string[] {
  return wrapper.findAll('[data-testid="group-name"]').map((cell) => cell.text());
}

describe("MyGroups.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setGroups([group("a", "Alpha"), group("b", "Beta"), group("c", "Gamma", { ownerId: "usr_me" })]);
    mocks.getGroupVisitStats.mockResolvedValue(
      new Map([
        ["grp_a", { visitCount: 5, lastVisitAt: "2026-11-01T00:00:00.000Z", timeSpent: 1000 }],
        ["grp_c", { visitCount: 1, lastVisitAt: "2025-07-01T00:00:00.000Z", timeSpent: 10 }],
      ])
    );
    mocks.getGroupNotificationStats.mockResolvedValue(new Map([["grp_b", { notificationCount: 1234, lastNotificationAt: "2026-11-02T00:00:00.000Z" }]]));
    mocks.getCurrentUserGroups.mockResolvedValue();
  });

  test("lists groups with the ones not visited for longest first", async () => {
    const wrapper = await open();
    expect(names(wrapper)).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(wrapper.get('[data-testid="group-count"]').text()).toBe("3 / 200");
    const text = wrapper.text();
    expect(text).toContain("view.tools.my_groups.never");
    expect(text).toContain("short:2025-07-01T00:00:00.000Z");
    expect(text).toContain("1,234");
    wrapper.unmount();
  });

  test("filters by name and keeps the full count", async () => {
    const wrapper = await open();
    await wrapper.get("input").setValue("gam");
    expect(names(wrapper)).toEqual(["Gamma"]);
    expect(wrapper.get('[data-testid="group-count"]').text()).toBe("3 / 200");
    expect(wrapper.get("input").attributes("maxlength")).toBe("100");
    wrapper.unmount();
  });

  test("opens a group and asks before leaving, but offers no leave for a group you own", async () => {
    const wrapper = await open();
    await wrapper.findAll('[data-testid="group-name"]')[0]?.trigger("click");
    expect(mocks.showGroupDialog).toHaveBeenCalledWith("grp_b");
    const leaveButtons = wrapper.findAll('[data-testid="group-leave"]');
    expect(leaveButtons).toHaveLength(2);
    await leaveButtons[0]?.trigger("click");
    expect(mocks.leaveGroupPrompt).toHaveBeenCalledWith("grp_b");
    expect(wrapper.text()).toContain("view.tools.my_groups.owner");
    wrapper.unmount();
  });

  test("drops a group from the list once it leaves the store", async () => {
    const wrapper = await open();
    mocks.groups.value.delete("grp_b");
    await flushPromises();
    expect(names(wrapper)).toEqual(["Gamma", "Alpha"]);
    expect(wrapper.get('[data-testid="group-count"]').text()).toBe("2 / 200");
    wrapper.unmount();
  });

  test("refresh reloads the group list and the history", async () => {
    const wrapper = await open();
    await wrapper.get('[data-testid="groups-refresh"]').trigger("click");
    await flushPromises();
    expect(mocks.getCurrentUserGroups).toHaveBeenCalledTimes(1);
    expect(mocks.getGroupVisitStats).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  test("says so when the history cannot be read and still lists the groups", async () => {
    mocks.getGroupVisitStats.mockRejectedValue(new Error("locked"));
    const wrapper = await open();
    expect(mocks.toastError).toHaveBeenCalledWith("view.tools.my_groups.load_failed");
    expect(names(wrapper)).toHaveLength(3);
    expect(wrapper.get('[data-testid="groups-refresh"]').attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  test("flags a full group list and keeps oversized names on one clipped line", async () => {
    setGroups(Array.from({ length: 200 }, (_, position) => group(`n${position}`, position === 0 ? LONG : `Group ${position}`, { memberCount: 123456789 })));
    mocks.getGroupVisitStats.mockResolvedValue(new Map());
    const wrapper = await open();
    expect(wrapper.get('[data-testid="group-count"]').text()).toBe("200 / 200");
    await wrapper.get("input").setValue("GGGG");
    const cell = wrapper.get('[data-testid="group-name"]');
    expect(cell.classes()).toEqual(expect.arrayContaining(["min-w-0", "w-full"]));
    expect(cell.get("span:last-child").classes()).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    expect(cell.attributes("title")).toBe(LONG);
    expect(wrapper.get('[data-testid="history-hint"]').classes()).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    expect(wrapper.text()).toContain("123,456,789");
    wrapper.unmount();
  });
});
