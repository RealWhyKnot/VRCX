import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import { useCommand } from "@/components/ui/command";

const mocks = vi.hoisted(() => ({
  setQuery: vi.fn((_query: string) => undefined),
  filterStateRaw: {
    search: "",
    filtered: {
      items: new Map<string, number>(),
      count: 0,
      groups: new Set<string>(),
    },
  },
  allItemsEntries: new Map<string, object>([
    ["a", {}],
    ["b", {}],
  ]),
  allGroupsEntries: new Map<string, object>([["g1", {}]]),
}));

vi.mock("@/components/ui/command", async () => {
  const { reactive, ref } = await import("vue");
  const filterState = reactive(mocks.filterStateRaw);
  const allItems = ref(new Map(mocks.allItemsEntries));
  const allGroups = ref(new Map(mocks.allGroupsEntries));
  return {
    useCommand: () => ({
      filterState,
      allItems,
      allGroups,
    }),
  };
});

vi.mock("../../src/stores/quick-search", () => ({
  useQuickSearchStore: () => ({
    setQuery: mocks.setQuery,
  }),
}));

import QuickSearchSync from "../../src/components/QuickSearchSync.vue";

const { filterState } = useCommand();

describe("QuickSearchSync.vue", () => {
  it("syncs query and keeps hint groups/items visible when query length < 2", async () => {
    mount(QuickSearchSync);

    filterState.search = "a";
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.setQuery).toHaveBeenCalledWith("a");
    expect(filterState.filtered.count).toBe(2);
    expect(filterState.filtered.items.get("a")).toBe(1);
    expect(filterState.filtered.groups.has("g1")).toBe(true);
  });

  it("overrides Command filter for longer queries so Worker results are not hidden", async () => {
    mount(QuickSearchSync);

    filterState.search = "rene";
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.setQuery).toHaveBeenCalledWith("rene");
    expect(filterState.filtered.count).toBe(2);
    expect(filterState.filtered.items.get("a")).toBe(1);
    expect(filterState.filtered.items.get("b")).toBe(1);
    expect(filterState.filtered.groups.has("g1")).toBe(true);
  });
});
