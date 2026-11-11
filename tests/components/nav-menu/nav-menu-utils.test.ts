import { describe, expect, test } from "vitest";

import { getFirstNavRoute, isEntryNotified, normalizeHiddenKeys, sanitizeLayout } from "../../../src/components/nav-menu/nav-menu-utils";
import type { NavDefinitionLike } from "../../../src/components/nav-menu/nav-menu-utils";
import type { NavLayoutEntry } from "../../../src/components/nav-menu/nav-menu-types";

const testDefinitions: NavDefinitionLike[] = [
  { key: "feed", routeName: "feed" },
  { key: "search", routeName: "search" },
  { key: "tools", routeName: "tools" },
  { key: "charts-instance", routeName: "charts-instance" },
  { key: "charts-mutual", routeName: "charts-mutual" },
  { key: "charts-hot-worlds", routeName: "charts-hot-worlds" },
  { key: "notification", routeName: "notification" },
  { key: "direct-access", action: "direct-access" },
];
const testDefinitionMap = new Map(testDefinitions.map((definition) => [definition.key, definition]));
const mockT = (key: string) => `translated:${key}`;
const mockGenerateFolderId = () => "generated-folder-id";

describe("normalizeHiddenKeys", () => {
  test("returns empty array for non-array input", () => {
    expect(normalizeHiddenKeys(null, testDefinitionMap)).toEqual([]);
    expect(normalizeHiddenKeys(undefined, testDefinitionMap)).toEqual([]);
    expect(normalizeHiddenKeys("string", testDefinitionMap)).toEqual([]);
    expect(normalizeHiddenKeys(42, testDefinitionMap)).toEqual([]);
  });

  test("returns empty array for empty array", () => {
    expect(normalizeHiddenKeys([], testDefinitionMap)).toEqual([]);
  });

  test("filters out invalid keys", () => {
    expect(normalizeHiddenKeys(["feed", "nonexistent", "search"], testDefinitionMap)).toEqual(["feed", "search"]);
  });

  test("deduplicates keys", () => {
    expect(normalizeHiddenKeys(["feed", "feed", "search"], testDefinitionMap)).toEqual(["feed", "search"]);
  });

  test("filters out falsy values", () => {
    expect(normalizeHiddenKeys([null, "", undefined, "feed"], testDefinitionMap)).toEqual(["feed"]);
  });

  test("preserves order of valid keys", () => {
    expect(normalizeHiddenKeys(["tools", "feed", "search"], testDefinitionMap)).toEqual(["tools", "feed", "search"]);
  });
});

describe("getFirstNavRoute", () => {
  test("returns null for empty layout", () => {
    expect(getFirstNavRoute([], testDefinitionMap)).toBeNull();
  });

  test("returns first item routeName", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "feed" }];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBe("feed");
  });

  test("skips items without routeName", () => {
    const layout: NavLayoutEntry[] = [
      { type: "item", key: "direct-access" },
      { type: "item", key: "search" },
    ];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBe("search");
  });

  test("returns route from folder items", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        items: ["feed", "search"],
      },
    ];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBe("feed");
  });

  test("returns null when no routable items exist", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "direct-access" }];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBeNull();
  });

  test("returns null for unknown keys", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "unknown" }];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBeNull();
  });

  test("checks folder items for routable entry", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        items: ["direct-access", "tools"],
      },
    ];
    expect(getFirstNavRoute(layout, testDefinitionMap)).toBe("tools");
  });
});

describe("isEntryNotified", () => {
  test("returns false for null/undefined entry", () => {
    expect(isEntryNotified(null, ["feed"])).toBe(false);
    expect(isEntryNotified(undefined, ["feed"])).toBe(false);
  });

  test("matches by index", () => {
    const entry = { index: "feed" };
    expect(isEntryNotified(entry, ["feed", "search"])).toBe(true);
  });

  test("matches by routeName", () => {
    const entry = { routeName: "search" };
    expect(isEntryNotified(entry, ["search"])).toBe(true);
  });

  test("matches by path last segment", () => {
    const entry = { path: "/app/settings" };
    expect(isEntryNotified(entry, ["settings"])).toBe(true);
  });

  test("returns false when no match", () => {
    const entry = { index: "feed", routeName: "feed" };
    expect(isEntryNotified(entry, ["search", "tools"])).toBe(false);
  });

  test("matches any of multiple targets", () => {
    const entry = {
      index: "feed",
      routeName: "home",
      path: "/app/dashboard",
    };
    expect(isEntryNotified(entry, ["dashboard"])).toBe(true);
  });

  test("returns false for empty notifiedMenus", () => {
    const entry = { index: "feed" };
    expect(isEntryNotified(entry, [])).toBe(false);
  });
});

describe("sanitizeLayout", () => {
  const runSanitize = (layout: NavLayoutEntry[] | null | undefined, hiddenKeys: unknown = []) =>
    sanitizeLayout(layout, hiddenKeys, testDefinitionMap, testDefinitions, mockT, mockGenerateFolderId);

  test("returns default items for null/undefined layout", () => {
    const result = runSanitize(null);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((e) => e.type === "item" && e.key === "feed")).toBe(true);
  });

  test("preserves valid item entries", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "feed" }];
    const result = runSanitize(layout);
    expect(result[0]).toEqual({ type: "item", key: "feed" });
  });

  test("skips invalid item keys", () => {
    const layout: NavLayoutEntry[] = [
      { type: "item", key: "feed" },
      { type: "item", key: "nonexistent" },
    ];
    const result = runSanitize(layout);
    expect(result.find((e) => e.type === "item" && e.key === "nonexistent")).toBeUndefined();
  });

  test("deduplicates item keys", () => {
    const layout: NavLayoutEntry[] = [
      { type: "item", key: "feed" },
      { type: "item", key: "feed" },
    ];
    const result = runSanitize(layout);
    const feedEntries = result.filter((e) => e.type === "item" && e.key === "feed");
    expect(feedEntries.length).toBe(1);
  });

  test("creates folder entries from valid items", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        id: "my-folder",
        name: "My Folder",
        icon: "ri-star-line",
        items: ["feed", "search"],
      },
    ];
    const result = runSanitize(layout);
    const folder = result.find((e) => e.type === "folder" && e.id === "my-folder");
    expect(folder).toMatchObject({ items: ["feed", "search"], name: "My Folder" });
  });

  test("generates folder ID when missing", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        name: "No ID Folder",
        items: ["feed"],
      },
    ];
    const result = runSanitize(layout);
    const folder = result.find((e) => e.type === "folder");
    expect(folder).toMatchObject({ id: "generated-folder-id" });
  });

  test("translates folder name from nameKey", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        id: "f1",
        nameKey: "nav_tooltip.favorites",
        items: ["feed"],
      },
    ];
    const result = runSanitize(layout);
    const folder = result.find((e) => e.type === "folder");
    expect(folder).toMatchObject({ name: "translated:nav_tooltip.favorites" });
  });

  test("appends missing definitions not in layout or hidden", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "feed" }];
    const result = runSanitize(layout);

    expect(result.some((e) => e.type === "item" && e.key === "search")).toBe(true);
    expect(result.some((e) => e.type === "item" && e.key === "tools")).toBe(true);
  });

  test("does not append hidden keys", () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "feed" }];
    const result = runSanitize(layout, ["search", "tools"]);
    expect(result.find((e) => e.type === "item" && e.key === "search")).toBeUndefined();
    expect(result.find((e) => e.type === "item" && e.key === "tools")).toBeUndefined();
  });

  test('converts legacy "charts" item to charts folder', () => {
    const layout: NavLayoutEntry[] = [{ type: "item", key: "charts" }];
    const result = runSanitize(layout);
    const chartsFolder = result.find((e) => e.type === "folder" && e.id === "default-folder-charts");
    expect(chartsFolder).toMatchObject({ items: ["charts-instance", "charts-mutual", "charts-hot-worlds"] });
  });

  test("skips empty folders", () => {
    const layout: NavLayoutEntry[] = [
      {
        type: "folder",
        id: "empty-folder",
        name: "Empty",
        items: [],
      },
    ];
    const result = runSanitize(layout);
    expect(result.find((e) => e.type === "folder" && e.id === "empty-folder")).toBeUndefined();
  });
});
