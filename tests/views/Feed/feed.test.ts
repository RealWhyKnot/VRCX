import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount, type DOMWrapper } from "@vue/test-utils";

type MockRef<T> = { value: T; __v_isRef: true };
type FeedTableMock = {
  loading: boolean;
  vip: boolean;
  filter: string[];
  search: string;
  dateFrom: string;
  dateTo: string;
};
type PaginationMock = { pageIndex: number; pageSize: number };
type MockRow = { id: unknown };

const mocks = vi.hoisted(() => {
  const makeRef = <T>(value: T): MockRef<T> => ({ value, __v_isRef: true });
  const filteredRows: MockRow[] = [{ id: "r1" }];
  return {
    makeRef,
    feedTable: makeRef<FeedTableMock>({
      loading: false,
      vip: false,
      filter: [],
      search: "",
      dateFrom: "",
      dateTo: "",
    }),
    feedTableData: makeRef<unknown[]>([]),
    feedTableLookup: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    pagination: makeRef<PaginationMock>({ pageIndex: 2, pageSize: 10 }),
    filteredRows,
    tablePageSizes: [10, 25, 50],
    tablePageSize: 25,
    maxTableSize: 100,
  };
});

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: "en-US" },
  }),
}));

vi.mock("@internationalized/date", () => ({
  getLocalTimeZone: () => "UTC",
  today: () => ({}),
}));

vi.mock("../../../src/stores/feed", () => ({
  useFeedStore: () => ({
    feedTable: mocks.feedTable,
    feedTableData: mocks.feedTableData,
    feedTableLookup: mocks.feedTableLookup,
  }),
}));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    tablePageSizes: mocks.tablePageSizes,
    tablePageSize: mocks.tablePageSize,
  }),
}));
vi.mock("../../../src/stores/vrcx", () => ({
  useVrcxStore: () => ({
    maxTableSize: mocks.maxTableSize,
  }),
}));

vi.mock("../../../src/lib/table/use-vrcx-vue-table", () => ({
  useVrcxVueTable: () => ({
    table: {
      getFilteredRowModel: () => ({ rows: mocks.filteredRows }),
    },
    pagination: mocks.pagination,
  }),
}));

vi.mock("../../../src/views/Feed/columns.tsx", () => ({
  columns: [],
}));

vi.mock("../../../src/components/ui/data-table/DataTableLayout.vue", () => ({
  default: {
    props: ["totalItems", "onPageSizeChange"],
    template:
      '<div data-testid="data-table-layout">' +
      '<slot name="toolbar" />' +
      '<button data-testid="set-page-size" @click="onPageSizeChange?.(50)">set-page-size</button>' +
      '<span data-testid="total-items">{{ totalItems }}</span>' +
      "</div>",
  },
}));

vi.mock("../../../src/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>",
  },
}));

vi.mock("../../../src/components/ui/popover/Popover.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open"],
    template: "<div><slot /></div>",
  },
}));
vi.mock("../../../src/components/ui/popover/PopoverTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/popover/PopoverContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/ui/toggle-group/ToggleGroup.vue", () => ({
  default: {
    emits: ["update:model-value"],
    template:
      '<div data-testid="toggle-group">' +
      "<button data-testid=\"select-gps\" @click=\"$emit('update:model-value', ['GPS'])\">gps</button>" +
      "<button data-testid=\"select-all\" @click=\"$emit('update:model-value', ['All'])\">all</button>" +
      "<slot />" +
      "</div>",
  },
}));
vi.mock("../../../src/components/ui/toggle-group/ToggleGroupItem.vue", () => ({
  default: {
    props: ["value"],
    template: '<button :data-value="value"><slot /></button>',
  },
}));

vi.mock("../../../src/components/ui/toggle/Toggle.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<button data-testid="vip-toggle" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>',
  },
}));

vi.mock("../../../src/components/ui/input-group/InputGroupField.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue", "change", "keyup.enter"],
    template: '<input data-testid="feed-search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />',
  },
}));

vi.mock("../../../src/components/ui/range-calendar/RangeCalendar.vue", () => ({
  default: {
    emits: ["update:modelValue"],
    template:
      '<button data-testid="set-date-range" @click="$emit(\'update:modelValue\', { start: { year: 2026, month: 3, day: 1 }, end: { year: 2026, month: 3, day: 2 } })">set-date-range</button>',
  },
}));

vi.mock("../../../src/components/ui/badge/Badge.vue", () => ({
  default: { template: "<span><slot /></span>" },
}));

vi.mock("../../../src/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("lucide-vue-next", () => ({
  ListFilter: { template: "<span />" },
  Star: { template: "<span />" },
}));

import Feed from "../../../src/views/Feed/Feed.vue";

function clickButtonByText(wrapper: { findAll: (selector: string) => DOMWrapper<Element>[] }, text: string) {
  const button = wrapper.findAll("button").find((node) => node.text().includes(text));
  if (!button) {
    throw new Error(`Cannot find button with text: ${text}`);
  }
  return button.trigger("click");
}

describe("Feed.vue", () => {
  beforeEach(() => {
    mocks.feedTable.value = {
      loading: false,
      vip: false,
      filter: [],
      search: "",
      dateFrom: "",
      dateTo: "",
    };
    mocks.feedTableData.value = [];
    mocks.feedTableLookup.mockReset();
    mocks.pagination.value = { pageIndex: 2, pageSize: 10 };
    mocks.filteredRows = [{ id: "r1" }];
    mocks.maxTableSize = 100;
  });

  test("applies date filter from calendar and triggers lookup", async () => {
    const wrapper = mount(Feed);

    await wrapper.get('[data-testid="set-date-range"]').trigger("click");
    await clickButtonByText(wrapper, "common.actions.confirm");

    expect(mocks.feedTable.value.dateFrom).toContain("T");
    expect(mocks.feedTable.value.dateTo).toContain("T");
    expect(new Date(mocks.feedTable.value.dateFrom).getTime()).toBeLessThan(new Date(mocks.feedTable.value.dateTo).getTime());
    expect(mocks.feedTableLookup).toHaveBeenCalledTimes(1);
  });

  test("clears date filter and triggers lookup", async () => {
    mocks.feedTable.value.dateFrom = "2026-03-01T00:00:00.000Z";
    mocks.feedTable.value.dateTo = "2026-03-02T23:59:59.999Z";
    const wrapper = mount(Feed);

    await clickButtonByText(wrapper, "common.actions.clear");

    expect(mocks.feedTable.value.dateFrom).toBe("");
    expect(mocks.feedTable.value.dateTo).toBe("");
    expect(mocks.feedTableLookup).toHaveBeenCalledTimes(1);
  });

  test("updates feed type filters via toggle group", async () => {
    const wrapper = mount(Feed);

    await wrapper.get('[data-testid="select-gps"]').trigger("click");
    expect(mocks.feedTable.value.filter).toEqual(["GPS"]);

    await wrapper.get('[data-testid="select-all"]').trigger("click");
    expect(mocks.feedTable.value.filter).toEqual([]);
    expect(mocks.feedTableLookup).toHaveBeenCalledTimes(2);
  });

  test("resets page index when page size changes", async () => {
    const wrapper = mount(Feed);

    await wrapper.get('[data-testid="set-page-size"]').trigger("click");

    expect(mocks.pagination.value).toEqual({
      pageIndex: 0,
      pageSize: 50,
    });
  });

  test("caps total items when table length is slightly above max table size", () => {
    mocks.filteredRows = Array.from({ length: 120 }, (_, i) => ({ id: i }));
    mocks.maxTableSize = 100;
    const wrapper = mount(Feed);

    expect(wrapper.get('[data-testid="total-items"]').text()).toBe("100");
  });
});
