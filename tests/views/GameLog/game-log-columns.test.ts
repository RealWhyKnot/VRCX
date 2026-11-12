import { beforeEach, describe, expect, test, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { TooltipProvider } from "reka-ui";

const mocks = vi.hoisted(() => ({
  showPreviousInstancesInfoDialog: vi.fn<(location: string) => void>(),
}));

vi.mock("pinia", async (importOriginal) => ({ ...(await importOriginal<typeof import("pinia")>()), storeToRefs: <T>(store: T) => store }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../../src/plugins/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("../../../src/stores/instance", () => ({
  useInstanceStore: () => ({ showPreviousInstancesInfoDialog: mocks.showPreviousInstancesInfoDialog }),
}));
vi.mock("../../../src/stores/ui", () => ({ useUiStore: () => ({ shiftHeld: ref(false) }) }));
vi.mock("../../../src/stores/settings/appearance", () => ({ useAppearanceSettingsStore: () => ({ tablePageSizes: [10, 25, 50], tablePageSize: 25 }) }));
vi.mock("../../../src/coordinators/user-coordinator", () => ({ lookupUser: vi.fn<() => Promise<void>>() }));
vi.mock("../../../src/coordinators/world-coordinator", () => ({ showWorldDialog: vi.fn<() => void>() }));
vi.mock("../../../src/coordinators/date-coordinator", () => ({ formatDateFilter: (value: string) => value }));
vi.mock("../../../src/components/Location.vue", () => ({ default: { template: "<span />" } }));

import DataTableLayout from "../../../src/components/ui/data-table/DataTableLayout.vue";
import { useVrcxVueTable } from "../../../src/lib/table/use-vrcx-vue-table";
import { createColumns } from "../../../src/views/GameLog/columns.tsx";
import type { GameLogEntry } from "../../../src/stores/gameLog/types";

function entry(type: string, location: string, minute: number): GameLogEntry {
  return { type, created_at: `2026-11-01T10:${String(minute).padStart(2, "0")}:00.000Z`, displayName: "Someone", userId: "usr_1", location };
}

async function open(rows: GameLogEntry[]) {
  const Host = defineComponent({
    components: { DataTableLayout, TooltipProvider },
    setup() {
      const { table } = useVrcxVueTable({
        persistKey: "gameLogColumnsTest",
        get data() {
          return rows;
        },
        columns: createColumns({ getCreatedAt: (row) => row.created_at, onDelete: vi.fn<() => void>(), onDeletePrompt: vi.fn<() => void>() }),
        getRowId: (row) => `${row.type}:${row.created_at}`,
        initialPagination: { pageIndex: 0, pageSize: 25 },
      });
      return { table, total: rows.length };
    },
    template: '<TooltipProvider><DataTableLayout :table="table" :loading="false" :page-sizes="[25]" :total-items="total" /></TooltipProvider>',
  });
  const wrapper = mount(Host, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe("Game Log action column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("offers the instance history on joined and left rows that know their instance", async () => {
    const wrapper = await open([
      entry("OnPlayerJoined", "wrld_a:1", 1),
      entry("OnPlayerLeft", "wrld_b:2", 2),
      entry("OnPlayerJoined", "", 3),
      entry("PortalSpawn", "wrld_c:3", 4),
    ]);
    const buttons = wrapper.findAll('[data-testid="gamelog-instance-info"]');
    expect(buttons).toHaveLength(2);
    await buttons[1]?.trigger("click");
    expect(mocks.showPreviousInstancesInfoDialog).toHaveBeenCalledTimes(1);
    expect(["wrld_a:1", "wrld_b:2"]).toContain(mocks.showPreviousInstancesInfoDialog.mock.calls[0]?.[0]);
    wrapper.unmount();
  });

  test("keeps the button on location rows", async () => {
    const wrapper = await open([entry("Location", "wrld_a:1", 1)]);
    expect(wrapper.findAll('[data-testid="gamelog-instance-info"]')).toHaveLength(1);
    wrapper.unmount();
  });
});
