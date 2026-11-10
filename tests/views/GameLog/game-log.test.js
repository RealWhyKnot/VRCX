import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  makeRef: (value) => ({ value, __v_isRef: true }),
  setSessionsViewMode: vi.fn(),
  table: { value: { vip: false, filter: [], search: "" } },
  sessionsViewMode: { value: "table", __v_isRef: true },
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock("../../../src/stores", () => ({
  useGameLogStore: () => ({
    gameLogTableLookup: (...a) => mocks.lookup(...a),
    setSessionsViewMode: (...a) => mocks.setSessionsViewMode(...a),
    gameLogTable: mocks.table,
    gameLogTableData: ref([]),
    sessionsViewMode: mocks.sessionsViewMode,
  }),
  useAppearanceSettingsStore: () => ({
    tablePageSizes: [20, 50],
    tablePageSize: 20,
  }),
  useVrcxStore: () => ({ maxTableSize: 500 }),
  useModalStore: () => ({ confirm: vi.fn() }),
}));
vi.mock("../../../src/components/ui/data-table", () => ({
  DataTableLayout: { template: '<div><slot name="toolbar" /></div>' },
}));
vi.mock("../../../src/components/ui/tooltip", () => ({
  TooltipWrapper: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/input-group", () => ({
  InputGroupField: { template: "<input />" },
}));
vi.mock("@/components/ui/select", () => ({
  Select: {
    emits: ["update:modelValue"],
    template: "<button data-testid=\"sel\" @click=\"$emit('update:modelValue', ['Event'])\"><slot /></button>",
  },
  SelectTrigger: { template: "<div><slot /></div>" },
  SelectValue: { template: "<div><slot /></div>" },
  SelectContent: { template: "<div><slot /></div>" },
  SelectGroup: { template: "<div><slot /></div>" },
  SelectItem: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/toggle", () => ({
  Toggle: { template: "<button><slot /></button>" },
}));
vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: {
    emits: ["update:model-value"],
    template: "<div><slot /></div>",
  },
  ToggleGroupItem: {
    props: ["value"],
    template: '<button :data-value="value"><slot /></button>',
  },
}));
vi.mock("lucide-vue-next", () => ({
  Star: { template: "<i />" },
  Logs: { template: "<i />" },
  Table2: { template: "<i />" },
}));
vi.mock("../../../src/views/GameLog/components/GameLogSessions.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/services/database", () => ({
  database: { deleteGameLogEntry: vi.fn() },
}));
vi.mock("../../../src/shared/utils", () => ({ removeFromArray: vi.fn() }));
vi.mock("../../../src/lib/table/use-vrcx-vue-table", () => ({
  useVrcxVueTable: () => ({
    table: { getFilteredRowModel: () => ({ rows: [] }) },
    pagination: ref({ pageIndex: 0, pageSize: 20 }),
  }),
}));
vi.mock("../../../src/views/GameLog/columns.jsx", () => ({ createColumns: () => [] }));

import GameLog from "../../../src/views/GameLog/GameLog.vue";

describe("GameLog.vue", () => {
  it("updates filter and triggers lookup when filter changes", async () => {
    const wrapper = mount(GameLog);
    await wrapper.get('[data-testid="sel"]').trigger("click");

    expect(mocks.lookup).toHaveBeenCalled();
    expect(mocks.table.value.filter).toEqual(["Event"]);
  });
});
