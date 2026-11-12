import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { KeepAlive, defineComponent, h } from "vue";
import { TooltipProvider } from "reka-ui";

import type { SightingRow } from "../../../src/shared/utils/instance-sightings";
import type { FriendStay, PresenceEvent, RepeatEncounter, TimeSpan, VoteKickEvent } from "../../../src/shared/utils/people-patterns";

const mocks = vi.hoisted(() => ({
  getRepeatEncounters: vi.fn<(selfId: string) => Promise<RepeatEncounter[]>>(),
  getFriendStays: vi.fn<(since: string) => Promise<FriendStay[]>>(),
  getFriendPresenceSince: vi.fn<(since: string) => Promise<PresenceEvent[]>>(),
  getOwnLocationSpans: vi.fn<(since: string) => Promise<TimeSpan[]>>(),
  showUserDialog: vi.fn<(userId: unknown) => void>(),
  getVoteKickEvents: vi.fn<() => Promise<VoteKickEvent[]>>(),
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
vi.mock("../../../src/shared/utils/base/format", () => ({ timeToText: (ms: number) => `${ms}ms` }));
vi.mock("../../../src/coordinators/user-coordinator", () => ({ showUserDialog: mocks.showUserDialog, lookupUser: mocks.lookupUser }));
vi.mock("../../../src/services/database", () => ({
  database: {
    getRepeatEncounters: mocks.getRepeatEncounters,
    getFriendStays: mocks.getFriendStays,
    getFriendPresenceSince: mocks.getFriendPresenceSince,
    getOwnLocationSpans: mocks.getOwnLocationSpans,
    getVoteKickEvents: mocks.getVoteKickEvents,
    getInstanceSightings: mocks.getInstanceSightings,
  },
}));
vi.mock("../../../src/stores/user", () => ({ useUserStore: () => ({ currentUser: { id: "usr_me" } }) }));
vi.mock("../../../src/stores/settings/appearance", () => ({ useAppearanceSettingsStore: () => ({ tablePageSizes: [10, 25, 50], tablePageSize: 25 }) }));
vi.mock("../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import PeoplePatterns from "../../../src/views/Tools/PeoplePatterns.vue";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 11, 12);
const LONG = "N".repeat(5000);

function encounter(id: string, displayName: string, placeCount: number): RepeatEncounter {
  return { id: `usr_${id}`, displayName, placeCount, lastSeenAt: "2026-11-01T00:00:00.000Z", timeTogether: placeCount * HOUR };
}

function stay(userId: string, displayName: string, fromHour: number, toHour: number, location = "wrld_a:1"): FriendStay {
  return {
    location,
    worldName: "Black Cat",
    groupName: "",
    userId,
    displayName,
    startedAt: NOW - 100 * HOUR + fromHour * HOUR,
    endedAt: NOW - 100 * HOUR + toHour * HOUR,
  };
}

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

const Host = defineComponent({ render: () => h(TooltipProvider, null, { default: () => h(KeepAlive, null, { default: () => h(PeoplePatterns) }) }) });

async function open() {
  const wrapper = mount(Host, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

async function showTab(wrapper: Awaited<ReturnType<typeof open>>, name: string) {
  await wrapper.get(`[data-testid="people-tab-${name}"]`).trigger("mousedown", { button: 0 });
  await flushPromises();
}

function names(wrapper: Awaited<ReturnType<typeof open>>): string[] {
  return wrapper.findAll('[data-testid="person-name"]').map((cell) => cell.text());
}

describe("PeoplePatterns.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    mocks.getRepeatEncounters.mockResolvedValue([encounter("a", "Ann", 4), encounter("b", "Bob", 12), encounter("c", "Cy", 7)]);
    mocks.getFriendStays.mockResolvedValue([stay("usr_x", "Xan", 0, 3), stay("usr_y", "Yuri", 1, 2), stay("usr_z", "Zed", 9, 10)]);
    mocks.getFriendPresenceSince.mockResolvedValue([
      { userId: "usr_x", displayName: "Xan", at: NOW - 10 * HOUR, isOnline: true },
      { userId: "usr_x", displayName: "Xan", at: NOW - 6 * HOUR, isOnline: false },
    ]);
    mocks.getOwnLocationSpans.mockResolvedValue([{ startedAt: NOW - 8 * HOUR, endedAt: NOW - 4 * HOUR }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("lists strangers by how many instances you shared and opens one on click", async () => {
    const wrapper = await open();
    expect(mocks.getRepeatEncounters).toHaveBeenCalledWith("usr_me");
    expect(names(wrapper)).toEqual(["Bob", "Cy", "Ann"]);
    expect(wrapper.get('[data-testid="people-hint"]').text()).toBe("view.tools.people_patterns.hint_repeat");
    expect(mocks.getFriendStays).not.toHaveBeenCalled();
    await wrapper.findAll('[data-testid="person-name"]')[0]?.trigger("click");
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_b");
    wrapper.unmount();
  });

  test("shows friends who were in an instance together, read from the last 90 days", async () => {
    const wrapper = await open();
    await showTab(wrapper, "gatherings");
    expect(mocks.getFriendStays).toHaveBeenCalledWith("2026-08-13T12:00:00.000Z");
    expect(names(wrapper)).toEqual(["Xan", "Yuri"]);
    expect(wrapper.text()).toContain("Black Cat");
    expect(wrapper.text()).toContain(`${HOUR}ms`);
    wrapper.unmount();
  });

  test("ranks friends by time online together and loads each tab once", async () => {
    const wrapper = await open();
    await showTab(wrapper, "overlap");
    expect(names(wrapper)).toEqual(["Xan"]);
    expect(wrapper.text()).toContain(`${2 * HOUR}ms`);
    expect(wrapper.text()).toContain("50%");
    await showTab(wrapper, "repeat");
    await showTab(wrapper, "overlap");
    expect(mocks.getFriendPresenceSince).toHaveBeenCalledTimes(1);
    expect(mocks.getRepeatEncounters).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  test("lists vote kicks newest first with their result and looks a name up on click", async () => {
    mocks.lookupUser.mockResolvedValue();
    mocks.getVoteKickEvents.mockResolvedValue([
      { at: "2026-11-01T10:00:00.000Z", text: "A vote kick has been initiated against Rude, do you agree?", worldName: "Black Cat" },
      { at: "2026-11-01T10:00:40.000Z", text: "Vote to kick Rude succeeded", worldName: "Black Cat" },
      { at: "2026-11-03T10:00:00.000Z", text: "A vote kick has been initiated against Loud, do you agree?", worldName: "" },
      { at: "2026-11-05T10:00:00.000Z", text: "You have been kicked from the instance", worldName: "Pub" },
    ]);
    const wrapper = await open();
    await showTab(wrapper, "votekicks");
    expect(wrapper.findAll('[data-testid="vote-outcome"]').map((cell) => cell.text())).toEqual([
      "view.tools.people_patterns.outcome_self",
      "view.tools.people_patterns.outcome_started",
      "view.tools.people_patterns.outcome_passed",
    ]);
    expect(names(wrapper)).toEqual(["Loud", "Rude"]);
    expect(wrapper.text()).toContain("view.tools.people_patterns.unknown_world");
    await wrapper.findAll('[data-testid="person-name"]')[1]?.trigger("click");
    expect(mocks.lookupUser).toHaveBeenCalledWith({ displayName: "Rude" });
    wrapper.unmount();
  });

  test("lists the instances seen with who made them and who was inside", async () => {
    mocks.lookupUser.mockResolvedValue();
    mocks.getInstanceSightings.mockResolvedValue([
      seen("1", "2026-11-10T10:00:00.000Z", "Black Cat", "", "", ["Ann"], 0),
      seen("2", "2026-11-12T10:00:00.000Z", "Miami Beach", "usr_owner", "Sheepa", ["Amnesty"], 4),
      seen("3", "2026-11-11T10:00:00.000Z", "", "grp_1", "", [], 0),
    ]);
    const wrapper = await open();
    await showTab(wrapper, "seen");
    expect(names(wrapper)).toEqual(["Sheepa", "Amnesty", "Ann"]);
    expect(wrapper.findAll('[data-testid="sighting-creator"]').map((cell) => cell.text())).toEqual(["Sheepa", "grp_1", ""]);
    expect(wrapper.get('[data-testid="sighting-extra"]').text()).toBe("+4");
    expect(wrapper.text()).toContain("5/60");
    expect(wrapper.text()).toContain("view.tools.people_patterns.unknown_world");
    expect(wrapper.get('[data-testid="people-hint"]').text()).toBe("view.tools.people_patterns.hint_seen");
    const people = wrapper.findAll('[data-testid="person-name"]');
    await people[0]?.trigger("click");
    expect(mocks.showUserDialog).toHaveBeenCalledWith("usr_owner");
    await people[1]?.trigger("click");
    expect(mocks.lookupUser).toHaveBeenCalledWith({ displayName: "Amnesty" });
    await wrapper.get("input").setValue("black");
    expect(names(wrapper)).toEqual(["Ann"]);
    wrapper.unmount();
  });

  test("keeps a crowded sighting with oversized names inside its cell", async () => {
    const crowd = Array.from({ length: 80 }, (_, position) => (position === 0 ? LONG : `Guest ${String(position).padStart(2, "0")}`));
    mocks.getInstanceSightings.mockResolvedValue([seen("1", "2026-11-12T10:00:00.000Z", LONG, "usr_owner", LONG, crowd, 9)]);
    const wrapper = await open();
    await showTab(wrapper, "seen");
    expect(names(wrapper)).toHaveLength(7);
    for (const cell of wrapper.findAll('[data-testid="person-name"]')) {
      expect(cell.classes()).toEqual(expect.arrayContaining(["min-w-0", "max-w-full", "truncate"]));
    }
    expect(wrapper.get('[data-testid="sighting-extra"]').text()).toBe("+83");
    expect(wrapper.get('[data-testid="sighting-people"]').classes()).toEqual(expect.arrayContaining(["min-w-0", "flex-wrap"]));
    expect(wrapper.get('[data-testid="sighting-creator"]').classes()).toContain("min-w-0");
    wrapper.unmount();
  });

  test("search narrows the list and refresh reads it again", async () => {
    const wrapper = await open();
    await wrapper.get("input").setValue("cy");
    expect(names(wrapper)).toEqual(["Cy"]);
    expect(wrapper.get("input").attributes("maxlength")).toBe("100");
    await wrapper.get('[data-testid="people-refresh"]').trigger("click");
    await flushPromises();
    expect(mocks.getRepeatEncounters).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  test("says so when a list cannot be read and leaves refresh usable", async () => {
    mocks.getRepeatEncounters.mockRejectedValue(new Error("locked"));
    const wrapper = await open();
    expect(mocks.toastError).toHaveBeenCalledWith("view.tools.people_patterns.load_failed");
    expect(names(wrapper)).toEqual([]);
    expect(wrapper.get('[data-testid="people-refresh"]').attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  test("keeps oversized names clipped and caps how many gathering names are drawn", async () => {
    mocks.getRepeatEncounters.mockResolvedValue([encounter("long", LONG, 123456)]);
    mocks.getFriendStays.mockResolvedValue(
      Array.from({ length: 40 }, (_, position) => stay(`usr_${position}`, position === 0 ? LONG : `Friend ${String(position).padStart(2, "0")}`, 0, 2))
    );
    const wrapper = await open();
    const cell = wrapper.get('[data-testid="person-name"]');
    expect(cell.classes()).toEqual(expect.arrayContaining(["min-w-0", "max-w-full", "truncate"]));
    expect(cell.attributes("title")).toBe(LONG);
    expect(wrapper.text()).toContain("123,456");
    expect(wrapper.get('[data-testid="people-hint"]').classes()).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    await showTab(wrapper, "gatherings");
    expect(names(wrapper)).toHaveLength(6);
    expect(wrapper.get('[data-testid="gathering-people"]').text()).toContain("+34");
    expect(wrapper.get('[data-testid="gathering-people"]').classes()).toEqual(expect.arrayContaining(["min-w-0", "flex-wrap"]));
    wrapper.unmount();
  });
});
