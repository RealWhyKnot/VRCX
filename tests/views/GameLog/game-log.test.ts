import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => {
  const table: { value: { vip: boolean; filter: string[]; search: string } } = { value: { vip: false, filter: [], search: "" } };
  return {
    lookup: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
    setSessionsViewMode: vi.fn<(...args: unknown[]) => unknown>(),
    table,
    sessionsViewMode: { value: "table", __v_isRef: true },
  };
});

vi.mock("pinia", async (importOriginal) => ({ ...(await importOriginal<typeof import("pinia")>()), storeToRefs: <T>(store: T) => store }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../../src/stores/gameLog", () => ({
  useGameLogStore: () => ({
    gameLogTableLookup: (...args: unknown[]) => mocks.lookup(...args),
    setSessionsViewMode: (...args: unknown[]) => mocks.setSessionsViewMode(...args),
    gameLogTable: mocks.table,
    gameLogTableData: ref([]),
    sessionsViewMode: mocks.sessionsViewMode,
  }),
}));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    tablePageSizes: [20, 50],
    tablePageSize: 20,
  }),
}));
vi.mock("../../../src/stores/vrcx", () => ({
  useVrcxStore: () => ({ maxTableSize: 500 }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({ confirm: vi.fn() }),
}));
vi.mock("../../../src/components/ui/data-table/DataTableLayout.vue", () => ({
  default: { template: '<div><slot name="toolbar" /></div>' },
}));
vi.mock("../../../src/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/input-group/InputGroupField.vue", () => ({
  default: { template: "<input />" },
}));
vi.mock("@/components/ui/select/Select.vue", () => ({
  default: {
    emits: ["update:modelValue"],
    template: "<button data-testid=\"sel\" @click=\"$emit('update:modelValue', ['Event'])\"><slot /></button>",
  },
}));
vi.mock("@/components/ui/select/SelectTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectValue.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/toggle/Toggle.vue", () => ({
  default: { template: "<button><slot /></button>" },
}));
vi.mock("@/components/ui/toggle-group/ToggleGroup.vue", () => ({
  default: {
    emits: ["update:model-value"],
    template: "<div><slot /></div>",
  },
}));
vi.mock("@/components/ui/toggle-group/ToggleGroupItem.vue", () => ({
  default: {
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
vi.mock("../../../src/shared/utils/base/array", () => ({
  removeFromArray: vi.fn(),
}));
vi.mock("../../../src/lib/table/use-vrcx-vue-table", () => ({
  useVrcxVueTable: () => ({
    table: { getFilteredRowModel: () => ({ rows: [] }) },
    pagination: ref({ pageIndex: 0, pageSize: 20 }),
  }),
}));
vi.mock("../../../src/views/GameLog/columns.tsx", () => ({ createColumns: () => [] }));

import GameLog from "../../../src/views/GameLog/GameLog.vue";

describe("GameLog.vue", () => {
  it("updates filter and triggers lookup when filter changes", async () => {
    const wrapper = mount(GameLog);
    await wrapper.get('[data-testid="sel"]').trigger("click");

    expect(mocks.lookup).toHaveBeenCalled();
    expect(mocks.table.value.filter).toEqual(["Event"]);
  });
});
