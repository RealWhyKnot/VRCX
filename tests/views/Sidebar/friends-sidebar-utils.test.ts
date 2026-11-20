import { describe, expect, test, vi } from "vitest";

import { buildFriendRow, buildInstanceHeaderRow, buildToggleRow, estimateRowSize } from "../../../src/views/Sidebar/friends-sidebar-utils";

describe("buildToggleRow", () => {
  test("creates a toggle-header row with defaults", () => {
    const row = buildToggleRow({ key: "online", label: "Online" });
    expect(row).toEqual({
      type: "toggle-header",
      key: "online",
      label: "Online",
      count: null,
      isExpanded: true,
      headerPadding: null,
      paddingBottom: null,
      onClick: null,
    });
  });

  test("accepts all optional parameters", () => {
    const onClick = vi.fn<() => void>();
    const row = buildToggleRow({
      key: "vip",
      label: "VIP",
      count: 5,
      isExpanded: false,
      headerPadding: 10,
      paddingBottom: 8,
      onClick,
    });
    expect(row.count).toBe(5);
    expect(row.isExpanded).toBe(false);
    expect(row.headerPadding).toBe(10);
    expect(row.paddingBottom).toBe(8);
    expect(row.onClick).toBe(onClick);
  });

  test("always sets type to toggle-header", () => {
    const row = buildToggleRow({ key: "x", label: "X" });
    expect(row.type).toBe("toggle-header");
  });
});

describe("buildFriendRow", () => {
  const friend = { id: "usr_123", displayName: "TestUser" };

  test("creates a friend-item row with defaults", () => {
    const row = buildFriendRow(friend, "friend:usr_123");
    expect(row).toEqual({
      type: "friend-item",
      key: "friend:usr_123",
      friend,
      isGroupByInstance: undefined,
      paddingBottom: undefined,
      itemStyle: undefined,
    });
  });

  test("passes options through", () => {
    const style = { opacity: 0.5 };
    const row = buildFriendRow(friend, "k", {
      isGroupByInstance: true,
      paddingBottom: 4,
      itemStyle: style,
    });
    expect(row.isGroupByInstance).toBe(true);
    expect(row.paddingBottom).toBe(4);
    expect(row.itemStyle).toBe(style);
  });

  test("always sets type to friend-item", () => {
    const row = buildFriendRow(friend, "k");
    expect(row.type).toBe("friend-item");
  });
});

describe("buildInstanceHeaderRow", () => {
  test("creates an instance-header row", () => {
    const row = buildInstanceHeaderRow("wrld_123:456~private", 3, "inst:wrld_123");
    expect(row).toEqual({
      type: "instance-header",
      key: "inst:wrld_123",
      location: "wrld_123:456~private",
      count: 3,
      paddingBottom: 0,
    });
  });

  test("always has paddingBottom of 0", () => {
    const row = buildInstanceHeaderRow("loc", 1, "k");
    expect(row.paddingBottom).toBe(0);
  });
});

describe("estimateRowSize", () => {
  test("returns 48 for null/undefined", () => {
    expect(estimateRowSize(null)).toBe(48);
    expect(estimateRowSize(undefined)).toBe(48);
  });

  test("uses the default 16px top and 8px bottom padding for a plain toggle-header", () => {
    expect(estimateRowSize({ type: "toggle-header" })).toBe(40);
    expect(estimateRowSize({ type: "toggle-header", paddingBottom: 8 })).toBe(48);
  });

  test("reads top and bottom from a custom headerPadding", () => {
    expect(estimateRowSize({ type: "toggle-header", headerPadding: "0 0 8px" })).toBe(24);
    expect(estimateRowSize({ type: "toggle-header", headerPadding: "8px 0 8px 8px" })).toBe(32);
    expect(estimateRowSize({ type: "toggle-header", headerPadding: "1rem" })).toBe(48);
    expect(estimateRowSize({ type: "toggle-header", headerPadding: 4 })).toBe(16);
  });

  test("returns 28 + paddingBottom for instance-header", () => {
    expect(estimateRowSize({ type: "instance-header" })).toBe(28);
    expect(estimateRowSize({ type: "instance-header", paddingBottom: 4 })).toBe(32);
  });

  test("returns 48 + paddingBottom for any other type (friend-item)", () => {
    expect(estimateRowSize({ type: "friend-item" })).toBe(48);
    expect(estimateRowSize({ type: "friend-item", paddingBottom: 6 })).toBe(54);
  });
});
