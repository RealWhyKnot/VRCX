import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FeedRow } from "../../../src/services/database/feed";

vi.mock("../../../src/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

vi.mock("../../../src/stores/gallery", () => ({
  useGalleryStore: () => ({
    showFullscreenImageDialog: vi.fn(),
  }),
}));

vi.mock("../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: vi.fn(),
}));

vi.mock("../../../src/shared/utils/base/string", async () => ({
  replaceBioSymbols: (await import("../../../src/shared/utils/base/string")).replaceBioSymbols,
}));
vi.mock("../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: (value: unknown) => value,
}));
vi.mock("../../../src/shared/utils/user", () => ({
  statusClass: (value: unknown) => value,
}));
vi.mock("../../../src/shared/utils/base/format", () => ({
  timeToText: (value: unknown) => value,
}));

vi.mock("../../../src/components/AvatarInfo.vue", () => ({
  default: "AvatarInfo",
}));

vi.mock("../../../src/components/Location.vue", () => ({
  default: "Location",
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
  ArrowDown: "ArrowDown",
  ArrowRight: "ArrowRight",
  ArrowUpDown: "ArrowUpDown",
  ChevronDown: "ChevronDown",
  ChevronRight: "ChevronRight",
}));

import { columns, expandedRow, renderFeedDetail } from "../../../src/views/Feed/columns.tsx";

type TestNode = {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
};

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
  if (!node) return null;
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

function bioRow(overrides: { previousBio: string; bio: string }): FeedRow {
  return {
    rowId: null,
    created_at: null,
    userId: null,
    displayName: null,
    type: "Bio",
    bio: overrides.bio,
    previousBio: overrides.previousBio,
    bioLinks: [],
    previousBioLinks: [],
  };
}

function findColumn(id: string) {
  const column = columns.find((candidate) => candidate.id === id);
  if (!column) {
    throw new Error(`Missing column: ${id}`);
  }
  return column;
}

describe("views/Feed/columns.tsx", () => {
  beforeEach(() => {
    Object.assign(globalThis, { React: { createElement } });
  });

  test("renders current bio text in detail cell", () => {
    const vnode: unknown = renderFeedDetail(bioRow({ previousBio: "hello\nold", bio: "hello\nnew" }));

    if (!isTestNode(vnode)) {
      throw new Error("Detail cell did not render a node");
    }
    expect(vnode.type).toBe("span");
    expect(vnode.children).toContain("hello\nnew");
    expect(vnode.props["innerHTML"]).toBeUndefined();
  });

  test("keeps multiline bio diff in expanded row", () => {
    const expanded: unknown = expandedRow({ row: { original: bioRow({ previousBio: "line1\nline2", bio: "line1\nline3" }) } });
    const preNode = findNode(expanded, (n) => n.type === "pre");

    expect(preNode).toBeTruthy();
    expect(preNode?.props["innerHTML"]).toContain("x-text-added");
    expect(preNode?.props["innerHTML"]).toContain("x-text-removed");
    expect(preNode?.props["innerHTML"]).toContain("<br>");
  });

  test("wires the expanded row renderer into the expander column meta", () => {
    expect(findColumn("expander")).toMatchObject({ meta: { expandedRow } });
  });
});
