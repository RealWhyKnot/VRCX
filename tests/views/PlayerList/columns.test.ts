import { beforeEach, describe, expect, test, vi } from "vitest";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  openExternalLink: vi.fn<(...args: unknown[]) => unknown>(),
  userImage: vi.fn<(...args: unknown[]) => string>(() => ""),
  getFaviconUrl: vi.fn<(...args: unknown[]) => string>((link: unknown) => `https://icon/${encodeURIComponent(String(link))}`),
  sortAlphabetically: vi.fn<(...args: unknown[]) => number>(() => 123),
  onBlockChatbox: vi.fn<(...args: unknown[]) => unknown>(),
  onUnblockChatbox: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("../../../src/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

vi.mock("../../../src/shared/utils/app-actions", () => ({
  openExternalLink: (...args: unknown[]) => mocks.openExternalLink(...args),
}));
vi.mock("../../../src/shared/utils/user", () => ({
  userImage: (...args: unknown[]) => mocks.userImage(...args),
  statusClass: () => "status-online",
  languageClass: (lang: unknown) => `lang-${String(lang)}`,
}));
vi.mock("../../../src/shared/utils/url-utils", () => ({
  getFaviconUrl: (...args: unknown[]) => mocks.getFaviconUrl(...args),
}));

vi.mock("../../../src/components/Timer.vue", () => ({ default: "Timer" }));
vi.mock("../../../src/components/ui/button/Button.vue", () => ({
  default: "Button",
}));
vi.mock("../../../src/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: "TooltipWrapper",
}));
vi.mock("lucide-vue-next", () => ({
  ArrowUpDown: "ArrowUpDown",
  Monitor: "Monitor",
  Smartphone: "Smartphone",
  Apple: "Apple",
  IdCard: "IdCard",
}));

import { createColumns } from "../../../src/views/PlayerList/columns.tsx";

type TestNode = {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
};

type CellRenderer = (context: { row: { original: unknown } }) => unknown;
type SortFn = (rowA: { original: unknown }, rowB: { original: unknown }) => number;
type ClickHandler = (event: { stopPropagation: () => void }) => void;

function createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): TestNode {
  return {
    type,
    props: props ?? {},
    children: children.flat(),
  };
}

function isTestNode(value: unknown): value is TestNode {
  return typeof value === "object" && value !== null && "type" in value && "props" in value && "children" in value;
}

function findNode(node: unknown, predicate: (candidate: TestNode) => boolean): TestNode | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findNode(item, predicate);
      if (result) return result;
    }
    return null;
  }
  if (!isTestNode(node)) return null;
  if (predicate(node)) return node;
  return findNode(node.children, predicate);
}

function isCellRenderer(value: unknown): value is CellRenderer {
  return typeof value === "function";
}

function isSortFn(value: unknown): value is SortFn {
  return typeof value === "function";
}

function isClickHandler(value: unknown): value is ClickHandler {
  return typeof value === "function";
}

function findColumn(columns: ReturnType<typeof createColumns>, id: string): { sortFn?: unknown; cell?: unknown } {
  const column = columns.find((candidate) => candidate.id === id);
  if (!column) {
    throw new Error(`Missing column: ${id}`);
  }
  return column;
}

function cellOf(column: { cell?: unknown }): CellRenderer {
  if (!isCellRenderer(column.cell)) {
    throw new Error("Missing cell renderer");
  }
  return column.cell;
}

function sortFnOf(column: { sortFn?: unknown }): SortFn {
  if (!isSortFn(column.sortFn)) {
    throw new Error("Missing sort function");
  }
  return column.sortFn;
}

function clickButton(node: unknown, event: { stopPropagation: () => void }) {
  const button = findNode(node, (candidate) => candidate.type === "button");
  const handler = button?.props["onClick"];
  if (!isClickHandler(handler)) {
    throw new Error("Missing button click handler");
  }
  handler(event);
}

function baseOptions() {
  return {
    randomUserColours: ref(false),
    onBlockChatbox: mocks.onBlockChatbox,
    onUnblockChatbox: mocks.onUnblockChatbox,
    sortAlphabetically: mocks.sortAlphabetically,
    userImage: mocks.userImage,
  };
}

describe("views/PlayerList/columns.tsx", () => {
  beforeEach(() => {
    Object.assign(globalThis, { React: { createElement } });
    mocks.openExternalLink.mockReset();
    mocks.userImage.mockReset();
    mocks.getFaviconUrl.mockClear();
    mocks.sortAlphabetically.mockClear();
    mocks.onBlockChatbox.mockReset();
    mocks.onUnblockChatbox.mockReset();
  });

  test("displayName sorting uses injected sortAlphabetically helper", () => {
    const cols = createColumns({
      ...baseOptions(),
      chatboxUserBlacklist: ref(new Map<string, string>()),
    });
    const sortFn = sortFnOf(findColumn(cols, "displayName"));

    const result = sortFn({ original: { displayName: "Alice" } }, { original: { displayName: "Bob" } });

    expect(result).toBe(123);
    expect(mocks.sortAlphabetically).toHaveBeenCalledWith("Alice", "Bob");
  });

  test("photonId cell triggers block and unblock actions", () => {
    const row = { original: { displayName: "Alice", photonId: 7, ref: { id: "usr_1", displayName: "Alice" } } };
    const cols = createColumns({
      ...baseOptions(),
      chatboxUserBlacklist: ref(new Map<string, string>()),
    });
    const blockCell = cellOf(findColumn(cols, "photonId"))({ row });
    clickButton(blockCell, { stopPropagation: vi.fn() });
    expect(mocks.onBlockChatbox).toHaveBeenCalledWith("usr_1", "Alice");

    const colsBlocked = createColumns({
      ...baseOptions(),
      chatboxUserBlacklist: ref(new Map([["usr_1", "Alice"]])),
    });
    const unblockCell = cellOf(findColumn(colsBlocked, "photonId"))({ row });
    clickButton(unblockCell, { stopPropagation: vi.fn() });
    expect(mocks.onUnblockChatbox).toHaveBeenCalledWith("usr_1");
  });

  test("icon sorting prefers higher weighted role flags", () => {
    const cols = createColumns({
      ...baseOptions(),
      chatboxUserBlacklist: ref(new Map<string, string>()),
    });
    const sortFn = sortFnOf(findColumn(cols, "icon"));

    const master = { original: { isMaster: true } };
    const friend = { original: { isFriend: true } };

    expect(sortFn(master, friend)).toBeGreaterThan(0);
  });
});
