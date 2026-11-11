import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PlayerModerationEntry } from "../../../src/stores/moderation";

type VNodeProps = {
  onClick?: () => void;
  [name: string]: unknown;
};

type VNodeLike = {
  type: unknown;
  props: VNodeProps;
  children: unknown[];
};

type CellContext = {
  row: { original: Partial<PlayerModerationEntry> };
};

type CellColumn = {
  accessorKey?: unknown;
  id?: unknown;
  cell: (context: CellContext) => unknown;
};

const mocks = vi.hoisted(() => ({
  shiftHeld: { value: false, __v_isRef: true },
  currentUser: { value: { id: "usr_me" }, __v_isRef: true },
  showUserDialog: vi.fn<(userId: string) => void>(),
  t: vi.fn((key: string) => key),
  te: vi.fn((key: string) => key === "view.moderation.filters.block"),
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    storeToRefs: (store: unknown) => store,
  };
});

vi.mock("../../../src/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => mocks.t(key),
      te: (key: string) => mocks.te(key),
    },
  },
}));

vi.mock("../../../src/stores/ui", () => ({
  useUiStore: () => ({
    shiftHeld: mocks.shiftHeld,
  }),
}));
vi.mock("../../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: mocks.currentUser,
  }),
}));

vi.mock("../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: (userId: string) => mocks.showUserDialog(userId),
}));

vi.mock("../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: (value: string, format: string) => `${format}:${value}`,
}));

vi.mock("../../../src/components/ui/badge/Badge.vue", () => ({
  default: "Badge",
}));
vi.mock("../../../src/components/ui/button/Button.vue", () => ({
  default: "Button",
}));
vi.mock("../../../src/components/ui/tooltip/Tooltip.vue", () => ({
  default: "Tooltip",
}));
vi.mock("../../../src/components/ui/tooltip/TooltipContent.vue", () => ({
  default: "TooltipContent",
}));
vi.mock("../../../src/components/ui/tooltip/TooltipTrigger.vue", () => ({
  default: "TooltipTrigger",
}));
vi.mock("lucide-vue-next", () => ({
  ArrowUpDown: "ArrowUpDown",
  Trash2: "Trash2",
  X: "X",
}));

import { createColumns } from "../../../src/views/Moderation/columns.tsx";

function createElement(type: unknown, props: VNodeProps | null, ...children: unknown[]): VNodeLike {
  return {
    type,
    props: props ?? {},
    children: children.flat(),
  };
}

function isVNodeLike(value: unknown): value is VNodeLike {
  return typeof value === "object" && value !== null && "type" in value && "props" in value && "children" in value;
}

function isCellColumn(value: unknown): value is CellColumn {
  return typeof value === "object" && value !== null && "cell" in value && typeof value.cell === "function";
}

function findNode(node: unknown, predicate: (candidate: VNodeLike) => boolean): VNodeLike | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findNode(item, predicate);
      if (result) return result;
    }
    return null;
  }

  if (!isVNodeLike(node)) return null;
  if (predicate(node)) return node;
  return findNode(node.children, predicate);
}

function clickNode(node: unknown, predicate: (candidate: VNodeLike) => boolean) {
  const target = findNode(node, predicate);
  if (!target?.props.onClick) {
    throw new Error("Expected a clickable node");
  }
  target.props.onClick();
}

function findCellColumn(columns: unknown[], match: (column: CellColumn) => boolean): CellColumn {
  const column = columns.find((item): item is CellColumn => isCellColumn(item) && match(item));
  if (!column) {
    throw new Error("Expected column to exist");
  }
  return column;
}

describe("views/Moderation/columns.tsx", () => {
  beforeEach(() => {
    Object.assign(globalThis, { React: { createElement } });
    mocks.shiftHeld.value = false;
    mocks.currentUser.value = { id: "usr_me" };
    mocks.showUserDialog.mockReset();
  });

  test("source and target cells open corresponding user dialog", () => {
    const cols = createColumns({
      onDelete: vi.fn<(row: PlayerModerationEntry) => void>(),
      onDeletePrompt: vi.fn<(row: PlayerModerationEntry) => void>(),
    });
    const sourceCol = findCellColumn(cols, (column) => column.accessorKey === "sourceDisplayName");
    const targetCol = findCellColumn(cols, (column) => column.accessorKey === "targetDisplayName");
    const row = {
      original: {
        sourceUserId: "usr_source",
        sourceDisplayName: "Source",
        targetUserId: "usr_target",
        targetDisplayName: "Target",
      },
    };

    const sourceCell = sourceCol.cell({ row });
    const targetCell = targetCol.cell({ row });
    clickNode(sourceCell, (n) => n.type === "span" && typeof n.props.onClick === "function");
    clickNode(targetCell, (n) => n.type === "span" && typeof n.props.onClick === "function");

    expect(mocks.showUserDialog).toHaveBeenNthCalledWith(1, "usr_source");
    expect(mocks.showUserDialog).toHaveBeenNthCalledWith(2, "usr_target");
  });

  test("action cell hidden when source user is not current user", () => {
    const cols = createColumns({
      onDelete: vi.fn<(row: PlayerModerationEntry) => void>(),
      onDeletePrompt: vi.fn<(row: PlayerModerationEntry) => void>(),
    });
    const actionCol = findCellColumn(cols, (column) => column.id === "action");
    const vnode = actionCol.cell({
      row: {
        original: {
          sourceUserId: "usr_other",
        },
      },
    });

    expect(vnode).toBeNull();
  });

  test("action cell routes to onDeletePrompt or onDelete based on shift", () => {
    const onDelete = vi.fn<(row: PlayerModerationEntry) => void>();
    const onDeletePrompt = vi.fn<(row: PlayerModerationEntry) => void>();
    const cols = createColumns({ onDelete, onDeletePrompt });
    const actionCol = findCellColumn(cols, (column) => column.id === "action");
    const row = {
      original: {
        sourceUserId: "usr_me",
        targetUserId: "usr_target",
        type: "block",
      },
    };

    const promptCell = actionCol.cell({ row });
    clickNode(promptCell, (n) => n.type === "button");
    expect(onDeletePrompt).toHaveBeenCalledWith(row.original);
    expect(onDelete).not.toHaveBeenCalled();

    mocks.shiftHeld.value = true;
    const directCell = actionCol.cell({ row });
    clickNode(directCell, (n) => n.type === "button");
    expect(onDelete).toHaveBeenCalledWith(row.original);
  });
});
