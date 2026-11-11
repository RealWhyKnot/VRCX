import { computed } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

type GridLayoutOptions = {
  matchMaxColumnWidth?: boolean;
};

type GridStyles = Record<string, string>;

export type LocalVirtualItem<T> = {
  key: string;
  favorite: T;
};

export type LocalVirtualRow<T> = {
  type: string;
  key: string;
  items: LocalVirtualItem<T>[];
};

export function useFavoritesLocalVirtualRows<T extends { id: string }>({
  items,
  groupName,
  getGridStyles,
  getScrollElement,
}: {
  items: { readonly value: T[] };
  groupName: { readonly value: string | null | undefined };
  getGridStyles: (count: number, options: GridLayoutOptions) => GridStyles;
  getScrollElement: () => HTMLElement | null;
}) {
  const getFavoritesGridMetrics = (count = 1, options: GridLayoutOptions = {}) => {
    const styles = getGridStyles(count, options);
    const columns = Math.max(1, Number(styles["--favorites-grid-columns"]) || 1);
    const gap = Number((styles["--favorites-card-gap"] ?? "").replace("px", "")) || 0;

    return {
      columns,
      gap,
      styles,
    };
  };

  const chunkLocalFavorites = (favorites: T[]): LocalVirtualRow<T>[] => {
    if (!favorites.length) {
      return [];
    }
    const { columns } = getFavoritesGridMetrics(favorites.length, { matchMaxColumnWidth: true });
    const safeColumns = Math.max(1, columns);
    const rows: LocalVirtualRow<T>[] = [];

    for (let index = 0; index < favorites.length; index += safeColumns) {
      rows.push({
        type: "cards",
        key: `local:${groupName.value}:${index}`,
        items: favorites.slice(index, index + safeColumns).map((favorite) => ({
          key: favorite.id,
          favorite,
        })),
      });
    }

    return rows;
  };

  const localVirtualRows = computed(() => chunkLocalFavorites(items.value));

  const estimateLocalRowSize = (row: LocalVirtualRow<T> | undefined) => {
    if (!row) {
      return 120;
    }
    const itemCount = row.items.length;
    const { columns, gap } = getFavoritesGridMetrics(itemCount, { matchMaxColumnWidth: true });
    const safeColumns = Math.max(1, columns);
    const rows = Math.max(1, Math.ceil(itemCount / safeColumns));
    const baseCardHeight = 220;
    const rowGap = Math.max(0, gap);

    return rows * baseCardHeight + (rows - 1) * rowGap + 8;
  };

  const localVirtualizer = useVirtualizer(
    computed(() => ({
      count: localVirtualRows.value.length,
      getScrollElement,
      estimateSize: (index: number) => estimateLocalRowSize(localVirtualRows.value[index]),
      overscan: 8,
    }))
  );

  const localVirtualItems = computed(() =>
    localVirtualizer.value.getVirtualItems().map((virtualItem) => ({
      virtualItem,
      row: localVirtualRows.value[virtualItem.index],
    }))
  );

  const localVirtualContainerStyle = computed(() => ({
    ...getFavoritesGridMetrics(items.value.length, { matchMaxColumnWidth: true }).styles,
    "--favorites-virtual-height": `${localVirtualizer.value.getTotalSize()}px`,
  }));

  const getLocalRowItems = (row: LocalVirtualRow<T> | undefined) => row?.items ?? [];

  function measureLocalRow(node: unknown) {
    if (node instanceof Element) {
      localVirtualizer.value.measureElement(node);
    }
  }

  return {
    localVirtualizer,
    localVirtualItems,
    localVirtualContainerStyle,
    getLocalRowItems,
    measureLocalRow,
  };
}
