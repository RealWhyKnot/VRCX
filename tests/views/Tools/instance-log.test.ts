import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { KeepAlive, defineComponent, h } from "vue";
import { TooltipProvider } from "reka-ui";

import type { SightingRow } from "../../../src/shared/utils/instance-sightings";

const mocks = vi.hoisted(() => ({
  showUserDialog: vi.fn<(userId: unknown) => void>(),
  showGroupDialog: vi.fn<(groupId: string) => void>(),
  getInstanceSightings: vi.fn<() => Promise<SightingRow[]>>(),
  lookupUser: vi.fn<(ref: { displayName?: string }) => Promise<void>>(),
  routerPush: vi.fn<(to: { name: string }) => Promise<void>>(),
  toastError: vi.fn<(message: string) => void>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("../../../src/plugins/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("../../../src/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string, format: string) => `${format}:${value}` }));
vi.mock("../../../src/coordinators/user-coordinator", () => ({ showUserDialog: mocks.showUserDialog, lookupUser: mocks.lookupUser }));
vi.mock("../../../src/coordinators/group-dialog-coordinator", () => ({ showGroupDialog: mocks.showGroupDialog }));
vi.mock("../../../src/services/database", () => ({ database: { getInstanceSightings: mocks.getInstanceSightings } }));
vi.mock("../../../src/stores/settings/appearance", () => ({ useAppearanceSettingsStore: () => ({ tablePageSizes: [10, 25, 50], tablePageSize: 25 }) }));
vi.mock("../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../../src/components/Location.vue", () => ({
  default: (props: { location?: string; hint?: string }) => h("span", { "data-location": props.location }, props.hint ?? props.location),
}));

import InstanceLog from "../../../src/views/Tools/InstanceLog.vue";

const NOW = Date.UTC(2026, 10, 12, 12);
const LONG = "N".repeat(5000);

function seen(id: string, at: string, worldName: string, creatorId: string, creatorName: string, people: string[], unnamedCount: number): SightingRow {
  return {
    id,
    at,
    location: `wrld_${id}:1`,
    worldName,
    creatorId,
    creatorName,
    userCount: people.length + unnamedCount,
    capacity: 60,
    names: people,
    peopleCount: people.length + unnamedCount,
    unnamedCount,
    search: [worldName, creatorName, ...people].join("\n").toLowerCase(),
  };
}

const Host = defineComponent({ render: () => h(TooltipProvider, null, { default: () => h(KeepAlive, null, { default: () => h(InstanceLog) }) }) });

async function open() {
  const wrapper = mount(Host, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

function names(wrapper: Awaited<ReturnType<typeof open>>): string[] {
  return wrapper.findAll('[data-testid="person-name"]').map((cell) => cell.text());
}

describe("InstanceLog.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    mocks.lookupUser.mockResolvedValue();
    mocks.routerPush.mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("lists the instances seen with who made them and who was inside", async () => {
    mocks.getInstanceSightings.mockResolvedValue([
      seen("1", "2026-11-10T10:00:00.000Z", "Black Cat", "", "", ["Ann"], 0),
      seen("2", "2026-11-12T10:00:00.000Z", "Miami Beach", "usr_owner", "Sheepa", ["Amnesty"], 4),
      seen("3", "2026-11-11T10:00:00.000Z", "", "grp_1", "Party Club", [], 0),
      seen("4", "2026-11-09T10:00:00.000Z", "", "grp_2", "", [], 0),
    ]);
    const wrapper = await open();
    expect(wrapper.text()).toContain("view.tools.instance_log.title");
    expect(names(wrapper)).toEqual(["Sheepa", "Amnesty", "Party Club", "Ann", "grp_2"]);
    expect(wrapper.findAll('[data-testid="sighting-creator"]').map((cell) => cell.text())).toEqual(["Sheepa", "Party Club", "", "grp_2"]);
    expect(wrapper.get('[data-testid="sighting-extra"]').text()).toBe("+4");
    expect(wrapper.text()).toContain("5/60");
    expect(wrapper.findAll('[data-testid="sighting-world"] [data-location]').map((cell) => cell.attributes("data-location"))).toEqual([
      "wrld_2:1",
      "wrld_3:1",
      "wrld_1:1",
      "wrld_4:1",
    ]);
    const people = wrapper.findAll('[data-testid="person-name"]');
    await people[0]?.trigger("click");
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_owner");
    await people[1]?.trigger("click");
    expect(mocks.lookupUser).toHaveBeenCalledWith({ displayName: "Amnesty" });
    await people[2]?.trigger("click");
    expect(mocks.showGroupDialog).toHaveBeenCalledWith("grp_1");
    await wrapper.get("input").setValue("black");
    expect(names(wrapper)).toEqual(["Ann"]);
    expect(wrapper.get("input").attributes("maxlength")).toBe("100");
    wrapper.unmount();
  });

  test("keeps a crowded sighting with oversized names inside its cell", async () => {
    const crowd = Array.from({ length: 80 }, (_, position) => (position === 0 ? LONG : `Guest ${String(position).padStart(2, "0")}`));
    mocks.getInstanceSightings.mockResolvedValue([seen("1", "2026-11-12T10:00:00.000Z", LONG, "usr_owner", LONG, crowd, 9)]);
    const wrapper = await open();
    expect(names(wrapper)).toHaveLength(7);
    for (const cell of wrapper.findAll('[data-testid="person-name"]')) {
      expect(cell.classes()).toEqual(expect.arrayContaining(["min-w-0", "max-w-full", "truncate"]));
    }
    expect(wrapper.get('[data-testid="sighting-extra"]').text()).toBe("+83");
    expect(wrapper.get('[data-testid="sighting-people"]').classes()).toEqual(expect.arrayContaining(["min-w-0", "flex-wrap"]));
    expect(wrapper.get('[data-testid="sighting-creator"]').classes()).toContain("min-w-0");
    wrapper.unmount();
  });

  test("refresh reads the log again and back returns to Tools", async () => {
    mocks.getInstanceSightings.mockResolvedValue([]);
    const wrapper = await open();
    await wrapper.get('[data-testid="instance-log-refresh"]').trigger("click");
    await flushPromises();
    expect(mocks.getInstanceSightings).toHaveBeenCalledTimes(2);
    await wrapper.findAll("button")[0]?.trigger("click");
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: "tools" });
    wrapper.unmount();
  });

  test("says so when the log cannot be read and leaves refresh usable", async () => {
    mocks.getInstanceSightings.mockRejectedValue(new Error("locked"));
    const wrapper = await open();
    expect(mocks.toastError).toHaveBeenCalledWith("view.tools.instance_log.load_failed");
    expect(names(wrapper)).toEqual([]);
    expect(wrapper.get('[data-testid="instance-log-refresh"]').attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });
});
