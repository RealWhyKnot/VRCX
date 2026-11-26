import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import type { FriendLogHistoryRow } from "../../../src/stores/friend-types";

type TableFilterMock = { value: unknown };

type FriendLogTableMock = {
  loading: boolean;
  data: FriendLogHistoryRow[];
  filters: TableFilterMock[];
};

type PaginationMock = {
  pageIndex: number;
  pageSize: number;
};

type FriendLogVm = {
  deleteFriendLog: (row: FriendLogHistoryRow) => void;
};

const mocks = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  return {
    hideUnfriends: ref(false),
    friendLogHistoryTotal: ref(580),
    sorting: ref<{ id: string; desc: boolean }[]>([]),
    loadPage: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    friendLogTable: ref<FriendLogTableMock>({
      loading: false,
      data: [],
      filters: [{ value: [] }, { value: "" }, { value: false }],
    }),
    pagination: ref<PaginationMock>({
      pageIndex: 3,
      pageSize: 10,
    }),
    configSetString: vi.fn<(key: string, value: string) => Promise<void>>(),
    deleteFriendLogHistory: vi.fn<(row: FriendLogHistoryRow) => Promise<void>>().mockResolvedValue(undefined),
    removeFromArray: vi.fn((arr: FriendLogHistoryRow[], row: FriendLogHistoryRow) => {
      const idx = arr.indexOf(row);
      if (idx !== -1) {
        arr.splice(idx, 1);
      }
    }),
  };
});

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  return {
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref("en"),
    }),
  };
});

vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    tablePageSizes: [10, 25, 50],
    tablePageSize: 25,
    hideUnfriends: mocks.hideUnfriends,
  }),
}));
vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({
    friendLogTable: mocks.friendLogTable,
    friendLogHistoryTotal: mocks.friendLogHistoryTotal,
    loadFriendLogHistoryPage: mocks.loadPage,
  }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({
    confirm: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));
vi.mock("../../../src/stores/vrcx", () => ({
  useVrcxStore: () => ({
    maxTableSize: 100,
  }),
}));

vi.mock("../../../src/lib/table/use-vrcx-vue-table", () => ({
  useVrcxVueTable: (options: { data: FriendLogHistoryRow[] }) => ({
    table: {
      getFilteredRowModel: () => ({ rows: options.data }),
    },
    pagination: mocks.pagination,
    sorting: mocks.sorting,
  }),
}));

vi.mock("../../../src/views/FriendLog/columns.tsx", () => ({
  createColumns: () => [],
}));

vi.mock("../../../src/components/ui/data-table/DataTableLayout.vue", () => ({
  default: {
    props: ["totalItems", "onPageSizeChange"],
    template:
      '<div data-testid="friend-log-layout">' +
      '<slot name="toolbar" />' +
      '<button data-testid="page-size-50" @click="onPageSizeChange?.(50)">page-size</button>' +
      '<span data-testid="total-items">{{ totalItems }}</span>' +
      "</div>",
  },
}));

vi.mock("../../../src/components/ui/select/Select.vue", () => ({
  default: {
    emits: ["update:modelValue"],
    template: "<div><button data-testid=\"set-type-filter\" @click=\"$emit('update:modelValue', ['Friend'])\">set-filter</button><slot /></div>",
  },
}));
vi.mock("../../../src/components/ui/select/SelectContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/select/SelectGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/select/SelectItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/select/SelectTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/select/SelectValue.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/ui/input-group/InputGroupField.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}));

vi.mock("../../../src/services/config", () => ({
  configRepository: {
    setString: (key: string, value: string) => mocks.configSetString(key, value),
  },
}));

vi.mock("../../../src/services/database", () => ({
  database: {
    deleteFriendLogHistory: (row: FriendLogHistoryRow) => mocks.deleteFriendLogHistory(row),
    waitForFriendLogHistoryWrites: () => Promise.resolve(),
  },
}));

vi.mock("../../../src/shared/utils/base/array", () => ({
  removeFromArray: (arr: FriendLogHistoryRow[], row: FriendLogHistoryRow) => mocks.removeFromArray(arr, row),
}));

vi.mock("../../../src/services/watch-state", () => ({ watchState: { isLoggedIn: true } }));

import FriendLog from "../../../src/views/FriendLog/FriendLog.vue";
import DashboardPanel from "../../../src/views/Dashboard/components/DashboardPanel.vue";

vi.mock("../../../src/views/Dashboard/components/panel-registry", async () => ({
  panelComponentMap: { "friend-log": (await import("../../../src/views/FriendLog/FriendLog.vue")).default },
}));
vi.mock("../../../src/views/Dashboard/components/PanelSelector.vue", () => ({ default: { template: "<div />" } }));

function makeRow(row: Partial<FriendLogHistoryRow>): FriendLogHistoryRow {
  return {
    rowId: null,
    created_at: null,
    type: null,
    userId: null,
    displayName: null,
    friendNumber: null,
    ...row,
  };
}

function isFriendLogVm(value: unknown): value is FriendLogVm {
  return typeof value === "object" && value !== null && "deleteFriendLog" in value;
}

function requireFriendLogVm(value: unknown): FriendLogVm {
  if (!isFriendLogVm(value)) {
    throw new Error("FriendLog.vue did not expose its setup state");
  }
  return value;
}

enableAutoUnmount(afterEach);

describe("FriendLog.vue", () => {
  beforeEach(() => {
    mocks.hideUnfriends.value = false;
    mocks.loadPage.mockClear();
    mocks.friendLogTable.value = {
      loading: false,
      data: [],
      filters: [{ value: [] }, { value: "" }, { value: false }],
    };
    mocks.pagination.value = {
      pageIndex: 3,
      pageSize: 10,
    };
    mocks.configSetString.mockReset();
    mocks.configSetString.mockResolvedValue(undefined);
    mocks.deleteFriendLogHistory.mockReset().mockResolvedValue(undefined);
    mocks.removeFromArray.mockClear();
  });

  test.each(["friend-log", { key: "friend-log", config: {} }])("loads inside a dashboard panel without a Friend Log route: %j", async (panelData) => {
    const wrapper = mount(DashboardPanel, { props: { panelData } });
    expect(wrapper.findComponent(FriendLog).exists()).toBe(true);
    await vi.waitFor(() => expect(mocks.loadPage).toHaveBeenCalled());
    expect(mocks.loadPage.mock.calls[0]?.slice(0, 2)).toEqual([0, 10]);
    wrapper.unmount();
  });

  test("syncs hideUnfriends setting to table filter via watcher", () => {
    mocks.hideUnfriends.value = true;
    mount(FriendLog);

    expect(mocks.friendLogTable.value.filters[2]?.value).toBe(true);
  });

  test("loads a server page and displays the full filtered count", async () => {
    const alice = makeRow({
      rowId: 1,
      type: "Friend",
      displayName: "Alice",
      userId: "usr_alice",
      created_at: "2026-03-08T00:00:00.000Z",
    });
    mocks.friendLogTable.value.data = [
      alice,
      makeRow({
        rowId: 2,
        type: "Friend",
        displayName: "Bob",
        userId: "usr_bob",
        created_at: "2026-03-09T00:00:00.000Z",
      }),
      makeRow({
        rowId: 3,
        type: "Unfriend",
        displayName: "Alice2",
        userId: "usr_alice2",
        created_at: "2026-03-10T00:00:00.000Z",
      }),
    ];
    mocks.friendLogTable.value.filters = [{ value: ["Friend"] }, { value: "ali" }, { value: true }];
    const wrapper = mount(FriendLog);

    await vi.waitFor(() => expect(mocks.loadPage).toHaveBeenCalledWith(0, 10, false, true));
    expect(wrapper.get('[data-testid="total-items"]').text()).toBe("580");
  });

  test("updates type filter and persists filter selection", async () => {
    const wrapper = mount(FriendLog);

    await wrapper.get('[data-testid="set-type-filter"]').trigger("click");

    expect(mocks.friendLogTable.value.filters[0]?.value).toEqual(["Friend"]);
    expect(mocks.configSetString).toHaveBeenCalledWith("VRCX_friendLogTableFilters", JSON.stringify(["Friend"]));
  });

  test("deletes deletable friend log row and writes to database", () => {
    const row = makeRow({
      rowId: 55,
      type: "Friend",
      userId: "usr_55",
      created_at: "2026-03-08T00:00:00.000Z",
    });
    mocks.friendLogTable.value.data = [row];
    const wrapper = mount(FriendLog);

    const vm = requireFriendLogVm(wrapper.vm);
    vm.deleteFriendLog(row);

    expect(mocks.removeFromArray).toHaveBeenCalledWith(mocks.friendLogTable.value.data, row);
    expect(mocks.deleteFriendLogHistory).toHaveBeenCalledWith(row);
  });

  test("removes incomplete friend log row without writing to database", () => {
    const row = makeRow({ rowId: 56 });
    mocks.friendLogTable.value.data = [row];
    const wrapper = mount(FriendLog);

    const vm = requireFriendLogVm(wrapper.vm);
    vm.deleteFriendLog(row);

    expect(mocks.removeFromArray).toHaveBeenCalledWith(mocks.friendLogTable.value.data, row);
    expect(mocks.deleteFriendLogHistory).not.toHaveBeenCalled();
  });

  test("loads the first page once on mount without re-triggering its own watcher", async () => {
    mount(FriendLog);
    await flushPromises();

    expect(mocks.loadPage).toHaveBeenCalledTimes(1);
    expect(mocks.loadPage).toHaveBeenCalledWith(0, 10, false, true);
    expect(mocks.pagination.value.pageIndex).toBe(0);
  });

  test("keeps the chosen page and loads it when the page index changes", async () => {
    mount(FriendLog);
    await flushPromises();
    mocks.loadPage.mockClear();

    mocks.pagination.value = { ...mocks.pagination.value, pageIndex: 2 };
    await flushPromises();

    expect(mocks.pagination.value.pageIndex).toBe(2);
    expect(mocks.loadPage).toHaveBeenCalledTimes(1);
    expect(mocks.loadPage).toHaveBeenCalledWith(2, 10, false, false);
  });

  test("returns to the first page and reloads when a filter changes", async () => {
    mount(FriendLog);
    await flushPromises();
    mocks.pagination.value = { ...mocks.pagination.value, pageIndex: 4 };
    await flushPromises();
    mocks.loadPage.mockClear();

    mocks.sorting.value = [{ id: "created_at", desc: false }];
    await flushPromises();

    expect(mocks.pagination.value.pageIndex).toBe(0);
    expect(mocks.loadPage).toHaveBeenCalledWith(0, 10, true, true);
  });

  test("resets page index when page size changes", async () => {
    const wrapper = mount(FriendLog);

    await wrapper.get('[data-testid="page-size-50"]').trigger("click");

    expect(mocks.pagination.value).toEqual({
      pageIndex: 0,
      pageSize: 50,
    });
  });
});
