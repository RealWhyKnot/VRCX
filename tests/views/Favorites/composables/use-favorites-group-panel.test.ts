import { describe, expect, it, vi, type Mock } from "vitest";
import { ref, type Ref } from "vue";

import type { LocalFavoriteEntry, LocalFavoriteGroups } from "../../../../src/stores/favorite-types";
import { useFavoritesGroupPanel } from "../../../../src/views/Favorites/composables/use-favorites-group-panel";

type PanelOptions = {
  remoteGroups?: Ref<{ key: string; count: number }[]>;
  localGroups?: Ref<string[]>;
  localFavorites?: Ref<LocalFavoriteGroups<LocalFavoriteEntry>>;
  clearSelection?: Mock<() => void>;
  placeholders?: { key: string }[];
  hasHistory?: boolean;
  historyItems?: Ref<unknown[]> | null;
};

function createPanel(options: PanelOptions = {}) {
  const remoteGroups = options.remoteGroups ?? ref<{ key: string; count: number }[]>([]);
  const localGroups = options.localGroups ?? ref<string[]>([]);
  const localFavorites = options.localFavorites ?? ref<LocalFavoriteGroups<LocalFavoriteEntry>>({});
  const clearSelection = options.clearSelection ?? vi.fn<() => void>();
  const placeholders = options.placeholders ?? [];
  const hasHistory = options.hasHistory ?? false;
  const historyItems = options.historyItems ?? null;

  const panel = useFavoritesGroupPanel({
    remoteGroups,
    localGroups,
    localFavorites,
    clearSelection,
    placeholders,
    hasHistory,
    historyItems,
  });

  return {
    panel,
    remoteGroups,
    localGroups,
    localFavorites,
    clearSelection,
    historyItems,
  };
}

describe("useFavoritesGroupPanel", () => {
  it("selects remote placeholder by default when remote groups are unresolved", () => {
    const placeholders = [{ key: "avatar:avatars1" }];
    const { panel, clearSelection } = createPanel({ placeholders });

    panel.ensureSelectedGroup();

    expect(panel.selectedGroup.value).toEqual({
      type: "remote",
      key: "avatar:avatars1",
    });
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it("falls back to another local group when selected local group is removed", () => {
    const { panel, localGroups, clearSelection } = createPanel({
      localGroups: ref(["A", "B"]),
      localFavorites: ref({
        A: [{ id: "a1" }],
        B: [{ id: "b1" }],
      }),
    });

    panel.selectGroup("local", "A", { userInitiated: true });
    clearSelection.mockClear();

    localGroups.value = ["B"];
    panel.ensureSelectedGroup();

    expect(panel.selectedGroup.value).toEqual({ type: "local", key: "B" });
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it("falls back to history group when no remote/local groups are available", () => {
    const historyItems = ref<unknown[]>([{ id: "avtr_1" }]);
    const { panel } = createPanel({
      hasHistory: true,
      historyItems,
    });

    panel.ensureSelectedGroup();

    expect(panel.selectedGroup.value).toEqual({
      type: "history",
      key: "local-history",
    });
  });
});
