import { describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";

import type { SightingSummary } from "../../../../src/services/database/sightings";

const mocks = vi.hoisted(() => ({ showWorldDialog: vi.fn<(tag: string) => void>() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/coordinators/world-coordinator", () => ({ showWorldDialog: mocks.showWorldDialog }));
vi.mock("@/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string) => `date:${value}` }));
vi.mock("@/shared/utils/base/format", () => ({ timeAgo: (value: string) => `ago:${value}` }));

import UserDialogHistoryRows from "../../../../src/components/dialogs/UserDialog/UserDialogHistoryRows.vue";
import type { UserDialogTrustChange } from "../../../../src/stores/user-state";

const stubs = {
  TooltipWrapper: { props: ["content"], template: '<div><div data-testid="tip">{{ content }}<slot name="content" /></div><slot /></div>' },
};

function change(index: number): UserDialogTrustChange {
  return { created_at: `2026-10-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`, from: `Rank${index}`, to: `Rank${index + 1}` };
}

const NO_SIGHTINGS: SightingSummary = { spottedAt: "", spottedLocation: "", spottedWorldName: "", hostedCount: 0, lastHostedAt: "" };

function open(firstMet: string, trustHistory: UserDialogTrustChange[], sightings = NO_SIGHTINGS) {
  return mount(UserDialogHistoryRows, { props: { firstMet, sightings, trustHistory }, global: { stubs } });
}

describe("UserDialogHistoryRows", () => {
  test("shows nothing for someone with no history", () => {
    const wrapper = open("", []);
    expect(wrapper.find('[data-testid="user-first-met"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="user-rank-changed"]').exists()).toBe(false);
  });

  test("shows when I first met them and when their rank last changed", () => {
    const wrapper = open("2025-06-20T05:12:48.986Z", [change(0), change(1)]);
    expect(wrapper.get('[data-testid="user-first-met"]').text()).toContain("ago:2025-06-20T05:12:48.986Z");
    expect(wrapper.get('[data-testid="user-rank-changed"]').text()).toContain("ago:2026-10-30T00:00:00.000Z");
    expect(wrapper.text()).toContain("Rank0 → Rank1: date:2026-10-30T00:00:00.000Z");
  });

  test("lists at most eight rank changes however long the history is", () => {
    const wrapper = open(
      "",
      Array.from({ length: 25 }, (_, index) => change(index))
    );
    const tip = wrapper.get('[data-testid="tip"]').text();
    expect(tip).toContain("Rank7 → Rank8");
    expect(tip).not.toContain("Rank8 → Rank9");
  });

  test("shows where I last spotted them and opens that world on click", async () => {
    const location = "wrld_1:75245~region(jp)";
    const wrapper = open("", [], { ...NO_SIGHTINGS, spottedAt: "2026-11-12T08:15:59.028Z", spottedLocation: location, spottedWorldName: "Sunset Bay" });
    const row = wrapper.get('[data-testid="user-spotted"]');
    expect(row.text()).toContain("dialog.user.info.spotted");
    expect(row.text()).toContain("Sunset Bay");
    expect(wrapper.text()).toContain("date:2026-11-12T08:15:59.028Z");
    await row.trigger("click");
    expect(mocks.showWorldDialog).toHaveBeenCalledWith(location);
    expect(wrapper.find('[data-testid="user-hosted"]').exists()).toBe(false);
  });

  test("falls back to how long ago when the world name is unknown", () => {
    const wrapper = open("", [], { ...NO_SIGHTINGS, spottedAt: "2026-11-12T08:15:59.028Z", spottedLocation: "wrld_1:1" });
    expect(wrapper.get('[data-testid="user-spotted"]').text()).toContain("ago:2026-11-12T08:15:59.028Z");
  });

  test("counts the instances they hosted and keeps a long world name inside the row", () => {
    const wrapper = open("", [], {
      spottedAt: "2026-11-12T08:15:59.028Z",
      spottedLocation: "wrld_1:1",
      spottedWorldName: "W".repeat(5000),
      hostedCount: 12345,
      lastHostedAt: "2026-11-11T00:00:00.000Z",
    });
    expect(wrapper.get('[data-testid="user-hosted"]').text()).toContain("12,345");
    expect(wrapper.text()).toContain("date:2026-11-11T00:00:00.000Z");
    const name = wrapper.get('[data-testid="user-spotted"] span:last-child');
    expect(name.classes()).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
  });
});
