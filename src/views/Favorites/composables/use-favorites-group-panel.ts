import { computed, ref } from "vue";

import type { LocalFavoriteGroups } from "../../../stores/favorite-types";

type ValueRef<T> = {
  readonly value: T;
};

type FavoritesRemoteGroup = {
  key: string;
  count: number;
};

type FavoritesGroupPlaceholder = {
  key: string;
};

type FavoritesGroupSelection = {
  type: string;
  key: string;
};

type FavoritesGroupPanelOptions<TRemoteGroup extends FavoritesRemoteGroup, TLocalFavorite> = {
  remoteGroups: ValueRef<TRemoteGroup[]>;
  localGroups: ValueRef<string[]>;
  localFavorites: ValueRef<LocalFavoriteGroups<TLocalFavorite>>;
  clearSelection: () => void;
  placeholders?: FavoritesGroupPlaceholder[];
  hasHistory?: boolean;
  historyItems?: ValueRef<unknown[]> | null;
};

export function useFavoritesGroupPanel<TRemoteGroup extends FavoritesRemoteGroup, TLocalFavorite>(
  options: FavoritesGroupPanelOptions<TRemoteGroup, TLocalFavorite>
) {
  const { remoteGroups, localGroups, localFavorites, clearSelection, placeholders = [], hasHistory = false, historyItems = null } = options;

  const selectedGroup = ref<FavoritesGroupSelection | null>(null);
  const activeGroupMenu = ref<string | null>(null);
  const hasUserSelectedGroup = ref(false);
  const remoteGroupsResolved = ref(false);

  const isRemoteGroupSelected = computed(() => selectedGroup.value?.type === "remote");
  const isLocalGroupSelected = computed(() => selectedGroup.value?.type === "local");
  const isHistorySelected = computed(() => hasHistory && selectedGroup.value?.type === "history");

  const remoteGroupMenuKey = (key: string) => `remote:${key}`;
  const localGroupMenuKey = (key: string) => `local:${key}`;

  const activeRemoteGroup = computed(() => {
    const selected = selectedGroup.value;
    if (selected?.type !== "remote") {
      return null;
    }
    return remoteGroups.value.find((group) => group.key === selected.key) ?? null;
  });

  const activeLocalGroupName = computed(() => {
    const selected = selectedGroup.value;
    if (selected?.type !== "local") {
      return "";
    }
    return selected.key;
  });

  const activeLocalGroupCount = computed(() => {
    if (!activeLocalGroupName.value) {
      return 0;
    }
    const favorites = localFavorites.value[activeLocalGroupName.value];
    return favorites?.length ?? 0;
  });

  function handleGroupMenuVisible(key: string, isVisible: boolean) {
    if (isVisible) {
      activeGroupMenu.value = key;
      return;
    }
    if (activeGroupMenu.value === key) {
      activeGroupMenu.value = null;
    }
  }

  function selectGroup(type: string, key: string, opts: { userInitiated?: boolean } = {}) {
    if (selectedGroup.value?.type === type && selectedGroup.value.key === key) {
      return;
    }
    selectedGroup.value = { type, key };
    if (opts.userInitiated) {
      hasUserSelectedGroup.value = true;
    }
    clearSelection();
  }

  function isGroupActive(type: string, key: string) {
    return selectedGroup.value?.type === type && selectedGroup.value.key === key;
  }

  function isGroupAvailable(group: FavoritesGroupSelection | null | undefined): boolean {
    if (!group) {
      return false;
    }
    if (group.type === "remote") {
      if (placeholders.length && !remoteGroupsResolved.value) {
        return true;
      }
      return remoteGroups.value.some((item) => item.key === group.key);
    }
    if (group.type === "local") {
      return localGroups.value.includes(group.key);
    }
    if (group.type === "history" && hasHistory && historyItems) {
      return historyItems.value.length > 0;
    }
    return false;
  }

  function selectDefaultGroup() {
    if (!hasUserSelectedGroup.value && placeholders.length) {
      const remote = remoteGroups.value.find((group) => group.count > 0) ?? remoteGroups.value[0] ?? placeholders[0];
      if (remote) {
        selectGroup("remote", remote.key);
        return;
      }
    } else if (remoteGroups.value.length) {
      const remote = remoteGroups.value.find((group) => group.count > 0) ?? remoteGroups.value[0];
      if (remote) {
        selectGroup("remote", remote.key);
        return;
      }
    }
    const firstLocalGroup = localGroups.value[0];
    if (firstLocalGroup !== undefined) {
      selectGroup("local", firstLocalGroup);
      return;
    }
    if (hasHistory && historyItems?.value.length) {
      selectGroup("history", "local-history");
      return;
    }
    selectedGroup.value = null;
    clearSelection();
  }

  function ensureSelectedGroup() {
    if (selectedGroup.value && isGroupAvailable(selectedGroup.value)) {
      return;
    }
    selectDefaultGroup();
  }

  return {
    selectedGroup,
    activeGroupMenu,
    hasUserSelectedGroup,
    remoteGroupsResolved,
    isRemoteGroupSelected,
    isLocalGroupSelected,
    isHistorySelected,
    remoteGroupMenuKey,
    localGroupMenuKey,
    activeRemoteGroup,
    activeLocalGroupName,
    activeLocalGroupCount,
    handleGroupMenuVisible,
    selectGroup,
    isGroupActive,
    isGroupAvailable,
    selectDefaultGroup,
    ensureSelectedGroup,
  };
}
