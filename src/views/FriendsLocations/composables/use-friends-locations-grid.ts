import { computed, type Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { FriendContext } from "../../../stores/friend-types";
import type { CardItem, CardsRow, FriendEntry, GridLayoutOptions, VirtualRow } from "./friends-locations-types";
import type { FriendsLocationsLists } from "./use-friends-locations-lists";

type FriendsLocationsGridOptions = {
  cardScale: Ref<number>;
  cardSpacing: Ref<number>;
  gridWidth: Ref<number>;
  scrollbarRef: Ref<HTMLElement | undefined>;
  lists: FriendsLocationsLists;
};

export function useFriendsLocationsGrid({ cardScale, cardSpacing, gridWidth, scrollbarRef, lists }: FriendsLocationsGridOptions) {
  const {
    collapsedGroups,
    filteredFriends,
    isSameInstanceView,
    shouldMergeSameInstance,
    displayInstanceInfo,
    sameInstanceGroupsForVirtual,
    mergedSameInstanceGroups,
    mergedOnlineEntries,
    isFavoriteDivideByGroup,
    vipFriendsDivideByGroup,
  } = lists;

  const getFriendIdentity = (friend: FriendContext) => friend.id;

  const getEntryIdentity = (entry: FriendEntry) => entry.id;

  const computeGridLayout = (count = 1, options: GridLayoutOptions = {}) => {
    const baseWidth = 220;
    const baseGap = 14;
    const scale = cardScale.value;
    const spacing = cardSpacing.value;
    const minWidth = baseWidth * scale;
    const gap = Math.max(6, (baseGap + (scale - 1) * 10) * spacing);
    const containerWidth = Math.max(gridWidth.value, 0);
    const itemCount = Math.max(count, 0);
    const safeCount = itemCount > 0 ? itemCount : 1;
    const maxColumns = Math.max(1, Math.floor((containerWidth + gap) / (minWidth + gap)) || 1);
    const { preferredColumns, shouldForceStretch = false, shouldDisableAutoStretch = false, shouldMatchMaxColumnWidth = false } = options;
    const requestedColumns = preferredColumns ? Math.max(1, Math.min(Math.round(preferredColumns), maxColumns)) : maxColumns;
    const columns = Math.max(1, Math.min(safeCount, requestedColumns));
    const shouldStretch = !shouldDisableAutoStretch && (shouldForceStretch || itemCount >= maxColumns);

    let cardWidth = minWidth;
    const maxColumnWidth = maxColumns > 0 ? (containerWidth - gap * (maxColumns - 1)) / maxColumns : minWidth;

    if (shouldStretch && columns > 0) {
      const columnsWidth = containerWidth - gap * (columns - 1);
      const rawWidth = columnsWidth > 0 ? columnsWidth / columns : minWidth;

      if (Number.isFinite(rawWidth) && rawWidth > 0) {
        cardWidth = Math.max(minWidth, rawWidth);
      }
    } else if (shouldMatchMaxColumnWidth && Number.isFinite(maxColumnWidth) && maxColumnWidth > 0) {
      cardWidth = Math.max(minWidth, maxColumnWidth);
    }

    return {
      minWidth,
      gap,
      columns,
      cardWidth,
    };
  };

  const gridStyle = computed(() => {
    return (count = 1, options: GridLayoutOptions = {}) => {
      const { minWidth, gap, cardWidth, columns } = computeGridLayout(count, options);
      return {
        "--friend-card-min-width": `${Math.round(minWidth)}px`,
        "--friend-card-gap": `${Math.round(gap)}px`,
        "--friend-card-target-width": `${Math.round(cardWidth)}px`,
        "--friend-grid-columns": `${columns}`,
        "--friend-card-spacing": cardSpacing.value.toFixed(2),
      };
    };
  });

  const chunkCardItems = (items: CardItem[], keyPrefix = "row"): CardsRow[] => {
    if (!items.length) {
      return [];
    }
    const { columns } = computeGridLayout(items.length, { shouldMatchMaxColumnWidth: true });
    const safeColumns = Math.max(1, columns);

    const rows: CardsRow[] = [];

    for (let index = 0; index < items.length; index += safeColumns) {
      rows.push({
        type: "cards",
        key: `${keyPrefix}:${index}`,
        items: items.slice(index, index + safeColumns),
      });
    }

    return rows;
  };

  const virtualRows = computed(() => {
    const rows: VirtualRow[] = [];

    if (isSameInstanceView.value) {
      for (const group of sameInstanceGroupsForVirtual.value) {
        rows.push({
          type: "header",
          key: `h:${group.instanceId}`,
          instanceId: group.instanceId,
          count: group.friends.length,
        });

        if (group.friends.length) {
          const items = group.friends.map((friend): CardItem => ({
            key: `f:${getFriendIdentity(friend)}`,
            friend,
            displayInstanceInfo: displayInstanceInfo.value,
          }));
          rows.push(...chunkCardItems(items, `g:${group.instanceId}`));
        }
      }

      return rows;
    }

    if (shouldMergeSameInstance.value) {
      for (const group of mergedSameInstanceGroups.value) {
        rows.push({
          type: "header",
          key: `h:${group.instanceId}`,
          instanceId: group.instanceId,
          count: group.friends.length,
        });

        if (group.friends.length) {
          const items = group.friends.map((friend): CardItem => ({
            key: `f:${getFriendIdentity(friend)}`,
            friend,
            displayInstanceInfo: displayInstanceInfo.value,
          }));
          rows.push(...chunkCardItems(items, `mg:${group.instanceId}`));
        }
      }

      if (mergedSameInstanceGroups.value.length && mergedOnlineEntries.value.length) {
        rows.push({ type: "divider", key: "divider:merged" });
      }

      const online = mergedOnlineEntries.value;
      if (online.length) {
        const items = online.map((entry): CardItem => ({
          key: `e:${getEntryIdentity(entry)}`,
          friend: entry.friend,
          displayInstanceInfo: displayInstanceInfo.value,
        }));
        rows.push(...chunkCardItems(items, "o:merged"));
      }

      return rows;
    }

    if (isFavoriteDivideByGroup.value) {
      for (const group of vipFriendsDivideByGroup.value) {
        const isCollapsed = collapsedGroups.has(group.key);
        rows.push({
          type: "group-header",
          key: `gh:${group.key}`,
          label: group.groupName,
          count: group.friends.length,
          groupKey: group.key,
          collapsed: isCollapsed,
        });
        if (!isCollapsed) {
          const items = group.friends.map((friend): CardItem => ({
            key: `fg:${group.key}:${getFriendIdentity(friend)}`,
            friend,
            displayInstanceInfo: displayInstanceInfo.value,
          }));
          rows.push(...chunkCardItems(items, `vg:${group.key}`));
        }
      }
      return rows;
    }

    const entries = filteredFriends.value;
    if (entries.length) {
      const items = entries.map((entry): CardItem => ({
        key: `e:${getEntryIdentity(entry)}`,
        friend: entry.friend,
        displayInstanceInfo: displayInstanceInfo.value,
      }));
      rows.push(...chunkCardItems(items, "r:all"));
    }
    return rows;
  });

  const virtualListStyle = computed(() => {
    const styleFn = gridStyle.value;
    const total = filteredFriends.value.length;

    return {
      ...styleFn(total, { shouldMatchMaxColumnWidth: true }),
    };
  });

  const estimateRowSize = (row: VirtualRow | undefined) => {
    if (!row) {
      return 48;
    }
    if (row.type === "header") {
      return 32;
    }
    if (row.type === "group-header") {
      return 40;
    }
    if (row.type === "divider") {
      return 36;
    }

    const itemCount = row.items.length;
    const { columns, gap } = computeGridLayout(itemCount, { shouldMatchMaxColumnWidth: true });
    const safeColumns = Math.max(1, columns);
    const rows = Math.max(1, Math.ceil(itemCount / safeColumns));
    const scale = cardScale.value;
    const spacing = cardSpacing.value;
    const baseCardHeight = 150;
    const cardHeight = baseCardHeight * scale * spacing;
    const rowGap = Math.max(0, gap - 4);

    return rows * cardHeight + (rows - 1) * rowGap + 8;
  };

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: virtualRows.value.length,
      getScrollElement: () => scrollbarRef.value ?? null,
      estimateSize: (index: number) => estimateRowSize(virtualRows.value[index]),
      overscan: 5,
    }))
  );

  const measureRow = (node: unknown) => {
    if (node instanceof Element) {
      virtualizer.value.measureElement(node);
    }
  };

  const virtualItems = computed(() =>
    virtualizer.value.getVirtualItems().map((virtualItem) => ({
      virtualItem,
      row: virtualRows.value[virtualItem.index],
    }))
  );

  const virtualContainerStyle = computed(() => ({
    ...virtualListStyle.value,
    height: `${virtualizer.value.getTotalSize()}px`,
  }));

  const getRowItems = (row: VirtualRow) => (row.type === "cards" ? row.items : []);
  const getRowInstanceId = (row: VirtualRow) => (row.type === "header" ? row.instanceId : "");
  const getRowCount = (row: VirtualRow) => (row.type === "header" ? row.count : 0);

  return {
    virtualizer,
    virtualRows,
    virtualItems,
    virtualContainerStyle,
    measureRow,
    getRowItems,
    getRowInstanceId,
    getRowCount,
  };
}
