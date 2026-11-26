import { afterEach, describe, expect, test, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import type { GameLogRow } from "../../../../src/services/database/game-log-union";
import type { GameLogEntry } from "../../../../src/stores/gameLog/types";

const mocks = await vi.hoisted(async () => {
  const { reactive, shallowReactive } = await import("vue");
  return {
    gameLogStore: shallowReactive({ latestGameLogEntry: null as GameLogEntry | null }),
    watchState: reactive({ isLoggedIn: true }),
    lookupGameLogDatabase: vi.fn<() => Promise<GameLogRow[]>>(),
    passThrough: { default: { template: "<div><slot /></div>" } },
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("../../../../src/services/database", () => ({
  database: { lookupGameLogDatabase: mocks.lookupGameLogDatabase },
}));
vi.mock("../../../../src/services/watch-state", () => ({
  watchState: mocks.watchState,
}));
vi.mock("../../../../src/stores/gameLog", () => ({
  useGameLogStore: () => mocks.gameLogStore,
}));
vi.mock("../../../../src/stores/friend", () => ({
  useFriendStore: () => ({ friends: new Map(), localFavoriteFriends: new Set() }),
}));
vi.mock("../../../../src/stores/log-failure", () => ({
  logFailure: () => () => undefined,
}));
vi.mock("../../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: (value: string | null) => value ?? "",
}));
vi.mock("../../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: vi.fn(),
}));
vi.mock("../../../../src/shared/utils/app-actions", () => ({
  openExternalLink: vi.fn(),
}));

vi.mock("../../../../src/components/ui/button/Button.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenu.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuContent.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuSeparator.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/dropdown-menu/DropdownMenuTrigger.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/Location.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/tooltip/TooltipWrapper.vue", () => mocks.passThrough);
vi.mock("../../../../src/views/Dashboard/widgets/WidgetHeader.vue", () => mocks.passThrough);
vi.mock("../../../../src/components/ui/table/Table.vue", () => ({ default: { template: "<table><slot /></table>" } }));
vi.mock("../../../../src/components/ui/table/TableBody.vue", () => ({ default: { template: "<tbody><slot /></tbody>" } }));
vi.mock("../../../../src/components/ui/table/TableRow.vue", () => ({ default: { template: '<tr data-testid="row"><slot /></tr>' } }));
vi.mock("../../../../src/components/ui/table/TableCell.vue", () => ({ default: { template: "<td><slot /></td>" } }));

import GameLogWidget from "../../../../src/views/Dashboard/widgets/GameLogWidget.vue";

function joinRow(rowId: number, displayName: string): GameLogRow {
  return { rowId, created_at: "2026-11-26T12:00:00.000Z", type: "OnPlayerJoined", displayName, userId: `usr_${rowId}` };
}

enableAutoUnmount(afterEach);

describe("GameLogWidget", () => {
  test("keeps existing rows mounted when a new game log entry arrives", async () => {
    mocks.lookupGameLogDatabase.mockResolvedValue([joinRow(2, "Second"), joinRow(1, "First")]);
    const wrapper = mount(GameLogWidget);
    await flushPromises();
    const before = wrapper.findAll('[data-testid="row"]').map((row) => row.element);
    expect(before).toHaveLength(2);

    mocks.gameLogStore.latestGameLogEntry = { type: "OnPlayerJoined", created_at: "2026-11-26T12:00:00.000Z", displayName: "Third", userId: "usr_3" };
    await flushPromises();

    const after = wrapper.findAll('[data-testid="row"]');
    expect(after.map((row) => row.text())).toEqual([expect.stringContaining("Third"), expect.stringContaining("Second"), expect.stringContaining("First")]);
    expect(after[1]?.element).toBe(before[0]);
    expect(after[2]?.element).toBe(before[1]);
  });
});
