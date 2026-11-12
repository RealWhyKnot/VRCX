import { describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string) => `date:${value}` }));
vi.mock("@/shared/utils/base/format", () => ({ timeAgo: (value: string) => `ago:${value}` }));

import UserDialogHistoryRows from "../../../../src/components/dialogs/UserDialog/UserDialogHistoryRows.vue";
import type { UserDialogTrustChange } from "../../../../src/stores/user-state";

const stubs = {
  TooltipWrapper: { template: '<div><div data-testid="tip"><slot name="content" /></div><slot /></div>' },
};

function change(index: number): UserDialogTrustChange {
  return { created_at: `2026-10-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`, from: `Rank${index}`, to: `Rank${index + 1}` };
}

function open(firstMet: string, trustHistory: UserDialogTrustChange[]) {
  return mount(UserDialogHistoryRows, { props: { firstMet, trustHistory }, global: { stubs } });
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
});
