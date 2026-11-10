import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../src/plugins/i18n", () => ({
  i18n: {
    global: {
      t: (key) => key,
    },
  },
}));

vi.mock("../../../src/stores", () => ({
  useGalleryStore: () => ({
    showFullscreenImageDialog: vi.fn(),
  }),
}));

vi.mock("../../../src/coordinators/user-coordinator", () => ({
  showUserDialog: vi.fn(),
}));

vi.mock("../../../src/shared/utils", async () => ({
  replaceBioSymbols: (await import("../../../src/shared/utils/base/string")).replaceBioSymbols,
  formatDateFilter: (value) => value,
  statusClass: (value) => value,
  timeToText: (value) => value,
}));

vi.mock("../../../src/components/AvatarInfo.vue", () => ({
  default: "AvatarInfo",
}));

vi.mock("../../../src/components/Location.vue", () => ({
  default: "Location",
}));

vi.mock("../../../src/components/ui/badge", () => ({
  Badge: "Badge",
}));

vi.mock("../../../src/components/ui/button", () => ({
  Button: "Button",
}));

vi.mock("../../../src/components/ui/tooltip", () => ({
  Tooltip: "Tooltip",
  TooltipContent: "TooltipContent",
  TooltipTrigger: "TooltipTrigger",
}));

vi.mock("lucide-vue-next", () => ({
  ArrowDown: "ArrowDown",
  ArrowRight: "ArrowRight",
  ArrowUpDown: "ArrowUpDown",
  ChevronDown: "ChevronDown",
  ChevronRight: "ChevronRight",
}));

import { columns } from "../../../src/views/Feed/columns.jsx";

function createElement(type, props, ...children) {
  return {
    type,
    props: props ?? {},
    children: children.flat(),
  };
}

function findNode(node, predicate) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findNode(item, predicate);
      if (result) return result;
    }
    return null;
  }
  if (predicate(node)) return node;
  if (!node.children) return null;
  return findNode(node.children, predicate);
}

describe("views/Feed/columns.jsx", () => {
  beforeEach(() => {
    globalThis.React = { createElement };
  });

  test("renders current bio text in detail cell", () => {
    const detailCol = columns.find((c) => c.id === "detail");
    const row = {
      original: {
        type: "Bio",
        previousBio: "hello\nold",
        bio: "hello\nnew",
      },
    };

    const vnode = detailCol.cell({ row });

    expect(vnode.type).toBe("span");
    expect(vnode.children).toContain("hello\nnew");
    expect(vnode.props.innerHTML).toBeUndefined();
  });

  test("keeps multiline bio diff in expanded row", () => {
    const expanderCol = columns.find((c) => c.id === "expander");
    const expanded = expanderCol.meta.expandedRow({
      row: {
        original: {
          type: "Bio",
          previousBio: "line1\nline2",
          bio: "line1\nline3",
        },
      },
    });
    const preNode = findNode(expanded, (n) => n.type === "pre");

    expect(preNode).toBeTruthy();
    expect(preNode.props.innerHTML).toContain("x-text-added");
    expect(preNode.props.innerHTML).toContain("x-text-removed");
    expect(preNode.props.innerHTML).toContain("<br>");
  });
});
