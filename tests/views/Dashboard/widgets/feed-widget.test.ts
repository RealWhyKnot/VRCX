import { afterEach, describe, expect, test, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { FeedRow } from "../../../../src/services/database/feed";

const mocks = await vi.hoisted(async () => {
  const { shallowReactive } = await import("vue");
  return {
    feedStore: shallowReactive({ feedTableData: [] as FeedRow[] }),
    passThrough: { default: { template: "<div><slot /></div>" } },
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("../../../../src/stores/feed", () => ({
  useFeedStore: () => mocks.feedStore,
}));
vi.mock("../../../../src/stores/friend", () => ({
  useFriendStore: () => ({ friends: new Map() }),
}));
vi.mock("../../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: (value: string | null) => value ?? "",
}));
vi.mock("../../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: vi.fn(),
}));
vi.mock("../../../../src/shared/utils/user", () => ({
  statusClass: () => "",
}));

vi.mock("../../../../src/components/ui/button/Button.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenu.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuContent.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuSeparator.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuTrigger.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/Location.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/UserContextMenu.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/tooltip/TooltipWrapper.vue", () => mocks.passThrough);
vi.mock("../../../../src/views/Dashboard/widgets/WidgetHeader.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/table/Table.vue", () => ({ default: { template: "<table><slot /></table>" } }));
vi.mock("../../../../src/components/ui/table/TableBody.vue", () => ({ default: { template: "<tbody><slot /></tbody>" } }));
vi.mock("../../../../src/components/ui/table/TableRow.vue", () => ({ default: { template: '<tr data-testid="row"><slot /></tr>' } }));
vi.mock("../../../../src/components/ui/table/TableCell.vue", () => ({ default: { template: "<td><slot /></td>" } }));

import FeedWidget from "../../../../src/views/Dashboard/widgets/FeedWidget.vue";

function onlineRow(rowId: number, displayName: string): FeedRow {
  return {
    type: "Online",
    rowId,
    created_at: "2026-11-26T12:00:00.000Z",
    userId: `usr_${rowId}`,
    displayName,
    location: "",
    worldName: null,
    time: null,
    groupName: null,
  };
}

enableAutoUnmount(afterEach);

describe("FeedWidget", () => {
  test("keeps existing rows mounted when a new entry arrives", async () => {
    mocks.feedStore.feedTableData = [onlineRow(2, "Second"), onlineRow(1, "First")];
    const wrapper = mount(FeedWidget);
    const before = wrapper.findAll('[data-testid="row"]').map((row) => row.element);

    mocks.feedStore.feedTableData = [onlineRow(3, "Third"), ...mocks.feedStore.feedTableData];
    await nextTick();

    const after = wrapper.findAll('[data-testid="row"]');
    expect(after.map((row) => row.text())).toEqual([expect.stringContaining("Third"), expect.stringContaining("Second"), expect.stringContaining("First")]);
    expect(after[1]?.element).toBe(before[0]);
    expect(after[2]?.element).toBe(before[1]);
  });
});
