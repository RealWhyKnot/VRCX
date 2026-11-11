import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  isFunction,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  sortFn_textCaseSensitive,
  tableFeatures,
  useTable,
} from "@tanstack/vue-table";
import type {
  ColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  ExpandedState,
  PaginationState,
  RowData,
  SortingState,
  TableFeatures,
  TableOptions,
  TableState,
  Updater,
} from "@tanstack/vue-table";
import { computed, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";

const baseFeatures = {
  rowSortingFeature,
  rowPaginationFeature,
  rowExpandingFeature,
  columnFilteringFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
    textCaseSensitive: sortFn_textCaseSensitive,
  },
};

type RowModelSlots = Pick<TableFeatures, "expandedRowModel" | "filteredRowModel" | "paginatedRowModel" | "sortedRowModel">;

type VrcxFeatures = typeof baseFeatures & RowModelSlots;

export type VrcxColumn<TData extends RowData> = ColumnDef<VrcxFeatures, TData>;

type ColumnIdentity = {
  id?: string | undefined;
  accessorKey?: unknown;
  meta?: unknown;
};

type SpacerColumn = {
  id: string;
  header: () => null;
  cell: () => null;
  enableSorting: false;
  size: number;
  minSize: number;
  meta: { thClass: string; tdClass: string };
};

type PersistedState = {
  sorting?: unknown;
  columnSizing?: unknown;
  columnOrder?: unknown;
  columnVisibility?: unknown;
  pageSize?: unknown;
  columnOrderLocked?: unknown;
  updatedAt?: unknown;
};

type TableUpdateHandlers = {
  onSortingChange?: (updaterOrValue: Updater<SortingState>) => void;
  onPaginationChange?: (updaterOrValue: Updater<PaginationState>) => void;
  onExpandedChange?: (updaterOrValue: Updater<ExpandedState>) => void;
  onColumnPinningChange?: (updaterOrValue: Updater<ColumnPinningState>) => void;
  onColumnSizingChange?: (updaterOrValue: Updater<ColumnSizingState>) => void;
  onColumnOrderChange?: (updaterOrValue: Updater<ColumnOrderState>) => void;
  onColumnVisibilityChange?: (updaterOrValue: Updater<ColumnVisibilityState>) => void;
};

type VrcxTableOptions<TData extends RowData> = {
  data: MaybeRefOrGetter<TData[]>;
  columns: MaybeRefOrGetter<VrcxColumn<TData>[]>;
  getRowId?: (row: TData, index: number, parent?: unknown) => string;
  getRowCanExpand?: (row: unknown) => boolean;
  enablePagination?: boolean;
  initialPagination?: PaginationState;
  enableSorting?: boolean;
  initialSorting?: SortingState;
  enableFiltering?: boolean;
  enableExpanded?: boolean;
  initialExpanded?: ExpandedState;
  enablePinning?: boolean;
  initialColumnPinning?: ColumnPinningState;
  enableColumnResizing?: boolean;
  columnResizeMode?: "onChange" | "onEnd";
  initialColumnSizing?: ColumnSizingState;
  enableColumnReorder?: boolean;
  initialColumnOrder?: ColumnOrderState;
  enableColumnVisibility?: boolean;
  initialColumnVisibility?: ColumnVisibilityState;
  fillRemainingSpace?: boolean;
  spacerColumnId?: string;
  persistKey?: string;
  persistColumnSizing?: boolean;
  persistSorting?: boolean;
  persistColumnOrder?: boolean;
  persistColumnVisibility?: boolean;
  persistPageSize?: boolean;
  persistDebounceMs?: number;
  tableOptions?: Partial<TableOptions<VrcxFeatures, TData>>;
};

function isPersistedState(value: unknown): value is PersistedState {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSortingEntry(value: unknown): value is SortingState[number] {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && "desc" in value && typeof value.desc === "boolean";
}

function isNumberRecord(value: unknown): value is ColumnSizingState {
  return isPersistedState(value) && Object.values(value).every((item) => typeof item === "number");
}

function isBooleanRecord(value: unknown): value is ColumnVisibilityState {
  return isPersistedState(value) && Object.values(value).every((item) => typeof item === "boolean");
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMetaFlag(column: ColumnIdentity, flag: string): boolean {
  return isRecord(column.meta) && Boolean(column.meta[flag]);
}

export function safeJsonParse(str: string | null | undefined): unknown {
  if (!str) {
    return null;
  }
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function readPersistedState(str: string | null): PersistedState | null {
  const parsed = safeJsonParse(str);
  return isPersistedState(parsed) ? parsed : null;
}

function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait: number): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), wait);
  };
}

function columnIdSet(columns: ColumnIdentity[] | null | undefined): Set<string | number> {
  const ids = new Set<string | number>();
  for (const column of columns ?? []) {
    const id = getColumnId(column);
    if (id !== null) {
      ids.add(id);
    }
  }
  return ids;
}

export function filterSizingByColumns(sizing: unknown, columns: ColumnIdentity[] | null | undefined): ColumnSizingState {
  if (!isPersistedState(sizing)) {
    return {};
  }
  const ids = columnIdSet(columns);
  const out: ColumnSizingState = {};
  for (const [key, value] of Object.entries(sizing)) {
    if (ids.has(key) && typeof value === "number") {
      out[key] = value;
    }
  }
  return out;
}

export function filterSortingByColumns(sorting: unknown, columns: ColumnIdentity[] | null | undefined): SortingState {
  if (!Array.isArray(sorting)) {
    return [];
  }
  const ids = columnIdSet(columns);
  return sorting.filter(isSortingEntry).filter((entry) => ids.has(entry.id));
}

export function filterOrderByColumns(order: unknown, columns: ColumnIdentity[] | null | undefined): ColumnOrderState {
  if (!Array.isArray(order)) {
    return [];
  }
  const ids = columnIdSet(columns);
  return order.filter(isString).filter((id) => ids.has(id));
}

export function filterVisibilityByColumns(visibility: unknown, columns: ColumnIdentity[] | null | undefined): ColumnVisibilityState {
  if (!isPersistedState(visibility)) {
    return {};
  }
  const ids = columnIdSet(columns);
  const out: ColumnVisibilityState = {};
  for (const [key, value] of Object.entries(visibility)) {
    if (ids.has(key) && typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function getColumnId(col: ColumnIdentity | null | undefined): string | number | null {
  const id = col?.id ?? col?.accessorKey;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function isColumnIdentityArray(value: unknown): value is ColumnIdentity[] {
  return Array.isArray(value);
}

export function findStretchColumnId(columns: unknown): string | number | null {
  if (!isColumnIdentityArray(columns)) {
    return null;
  }
  for (const col of columns) {
    if (hasMetaFlag(col, "stretch")) {
      return getColumnId(col);
    }
  }
  return null;
}

function setRef<T>(updaterOrValue: Updater<T>, targetRef: Ref<T>) {
  targetRef.value = isFunction(updaterOrValue) ? updaterOrValue(targetRef.value) : updaterOrValue;
}

function bindUpdater<T>(source: Ref<T>): (updaterOrValue: Updater<T>) => void {
  return (updaterOrValue) => setRef(updaterOrValue, source);
}

export function isSpacerColumn(column: ColumnIdentity | SpacerColumn): column is SpacerColumn {
  return "header" in column && typeof column.header === "function";
}

export function withSpacerColumn<TColumn extends ColumnIdentity>(
  columns: TColumn[] | null | undefined,
  isEnabled: boolean,
  spacerId?: string,
  stretchAfterId: string | number | null = null
): (TColumn | SpacerColumn)[] | null | undefined {
  if (!isEnabled) {
    return columns;
  }
  if (!Array.isArray(columns)) {
    return columns;
  }

  const id = spacerId ?? "__spacer";

  if (columns.some((c) => getColumnId(c) === id)) {
    return columns;
  }

  const spacerColumn: SpacerColumn = {
    id,
    header: () => null,
    cell: () => null,
    enableSorting: false,
    size: 0,
    minSize: 0,
    meta: { thClass: "p-0", tdClass: "p-0" },
  };

  if (stretchAfterId) {
    const idx = columns.findIndex((c) => getColumnId(c) === stretchAfterId);
    if (idx !== -1) {
      return [...columns.slice(0, idx + 1), spacerColumn, ...columns.slice(idx + 1)];
    }
  }

  return [...columns, spacerColumn];
}

export function useVrcxVueTable<TData extends RowData>(options: VrcxTableOptions<TData>) {
  const {
    getRowId,
    getRowCanExpand,

    enablePagination = true,
    initialPagination,
    enableSorting = true,
    initialSorting,
    enableFiltering = true,

    enableExpanded = false,
    initialExpanded,

    enablePinning = false,
    initialColumnPinning,

    enableColumnResizing = true,
    columnResizeMode = "onChange",
    initialColumnSizing,

    enableColumnReorder = true,
    initialColumnOrder,

    enableColumnVisibility = true,
    initialColumnVisibility,

    fillRemainingSpace = true,
    spacerColumnId = "__spacer",

    persistKey,
    persistColumnSizing = true,
    persistSorting = true,
    persistColumnOrder = true,
    persistColumnVisibility = true,
    persistPageSize = true,
    persistDebounceMs = 200,

    tableOptions = {},
  } = options;

  const expanded = ref<ExpandedState>(initialExpanded ?? {});
  const pagination = ref<PaginationState>(initialPagination ?? { pageIndex: 0, pageSize: 50 });
  const columnPinning = ref<ColumnPinningState>(initialColumnPinning ?? { start: [], end: [] });
  const columnSizing = ref<ColumnSizingState>(initialColumnSizing ?? {});
  const columnOrder = ref<ColumnOrderState>(initialColumnOrder ?? []);
  const columnVisibility = ref<ColumnVisibilityState>(initialColumnVisibility ?? {});

  const storageKey = persistKey ? `vrcx:table:${persistKey}` : null;

  function readPersisted(): PersistedState | null {
    if (!storageKey) {
      return null;
    }
    return readPersistedState(localStorage.getItem(storageKey));
  }

  function writePersisted(patch: PersistedState) {
    if (!storageKey) {
      return;
    }
    const cur = readPersistedState(localStorage.getItem(storageKey)) ?? {};
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function removePersisted(keys: (keyof PersistedState)[]) {
    if (!storageKey) {
      return;
    }
    const cur: PersistedState = readPersistedState(localStorage.getItem(storageKey)) ?? {};
    for (const key of keys) {
      Reflect.deleteProperty(cur, key);
    }
    cur.updatedAt = Date.now();
    localStorage.setItem(storageKey, JSON.stringify(cur));
  }

  const persisted = readPersisted();

  let resolvedSorting: SortingState = initialSorting ?? [];
  if (persisted && persistSorting && Array.isArray(persisted.sorting)) {
    resolvedSorting = persisted.sorting.filter(isSortingEntry);
  }
  const sorting = ref<SortingState>(resolvedSorting);

  if (persisted && persistColumnSizing && isNumberRecord(persisted.columnSizing)) {
    columnSizing.value = persisted.columnSizing;
  }

  if (persisted && persistColumnOrder && isStringArray(persisted.columnOrder)) {
    columnOrder.value = persisted.columnOrder;
  }

  if (persisted && persistColumnVisibility && isBooleanRecord(persisted.columnVisibility)) {
    columnVisibility.value = persisted.columnVisibility;
  }

  if (persisted && persistPageSize && typeof persisted.pageSize === "number" && persisted.pageSize > 0) {
    pagination.value = {
      ...pagination.value,
      pageSize: persisted.pageSize,
    };
  }

  const columnOrderLocked = ref(persisted?.columnOrderLocked === true);

  const state: Partial<TableState<VrcxFeatures>> = {};
  const handlers: TableUpdateHandlers = {
    ...(enableSorting ? { onSortingChange: bindUpdater(sorting) } : {}),
    ...(enablePagination ? { onPaginationChange: bindUpdater(pagination) } : {}),
    ...(enableExpanded ? { onExpandedChange: bindUpdater(expanded) } : {}),
    ...(enablePinning ? { onColumnPinningChange: bindUpdater(columnPinning) } : {}),
    ...(enableColumnResizing ? { onColumnSizingChange: bindUpdater(columnSizing) } : {}),
    ...(enableColumnReorder ? { onColumnOrderChange: bindUpdater(columnOrder) } : {}),
    ...(enableColumnVisibility ? { onColumnVisibilityChange: bindUpdater(columnVisibility) } : {}),
  };
  const rowModels: RowModelSlots = {};
  const extra: { getRowCanExpand?: (row: unknown) => boolean; enableColumnResizing?: boolean; columnResizeMode?: "onChange" | "onEnd" } = {};

  function register<T>(isEnabled: boolean, key: keyof TableState<VrcxFeatures>, source: Ref<T>, rowModelPart: RowModelSlots | null, extraPart?: typeof extra) {
    if (!isEnabled) {
      return;
    }

    Object.defineProperty(state, key, {
      enumerable: true,
      get: () => source.value,
    });

    if (rowModelPart) Object.assign(rowModels, rowModelPart);
    if (extraPart) Object.assign(extra, extraPart);
  }

  register(enableSorting, "sorting", sorting, {
    sortedRowModel: createSortedRowModel(),
  });

  register(enablePagination, "pagination", pagination, {
    paginatedRowModel: createPaginatedRowModel(),
  });

  register(enableExpanded, "expanded", expanded, { expandedRowModel: createExpandedRowModel() }, getRowCanExpand ? { getRowCanExpand } : undefined);

  register(enablePinning, "columnPinning", columnPinning, null);

  register(enableColumnResizing, "columnSizing", columnSizing, null, {
    enableColumnResizing: true,
    columnResizeMode,
  });

  register(enableColumnReorder, "columnOrder", columnOrder, null);

  register(enableColumnVisibility, "columnVisibility", columnVisibility, null);

  if (enableFiltering) {
    rowModels.filteredRowModel = createFilteredRowModel();
  }

  const dataSource = computed(() => toValue(options.data));
  const columnsSource = computed(() => toValue(options.columns));

  const features = tableFeatures<VrcxFeatures>({ ...baseFeatures, ...rowModels });

  const table = useTable({
    features,
    data: dataSource,
    get columns() {
      const cols = columnsSource.value;

      const stretchAfterId = findStretchColumnId(cols);

      return withSpacerColumn(cols, fillRemainingSpace, spacerColumnId, stretchAfterId) ?? [];
    },
    ...(getRowId ? { getRowId } : {}),

    ...handlers,
    ...extra,

    state,

    meta: {
      resetAll: storageKey ? resetAll : undefined,
      columnOrderLocked: storageKey ? columnOrderLocked : undefined,
    },

    ...tableOptions,
  });

  watch(
    columnsSource,
    (next) => {
      table.setOptions((prev) => ({
        ...prev,
        columns: withSpacerColumn(next, fillRemainingSpace, spacerColumnId, findStretchColumnId(next)) ?? [],
      }));
    },
    { immediate: true }
  );

  const persistWrite = debounce((payload: PersistedState) => writePersisted(payload), persistDebounceMs);

  if (storageKey && persistColumnSizing) {
    watch(
      columnSizing,
      (value) => {
        const cols = table.getAllLeafColumns();
        persistWrite({
          columnSizing: filterSizingByColumns(value, cols),
        });
      },
      { deep: true }
    );
  }

  if (storageKey && persistSorting) {
    watch(
      sorting,
      (value) => {
        const cols = table.getAllLeafColumns();
        persistWrite({
          sorting: filterSortingByColumns(value, cols),
        });
      },
      { deep: true }
    );
  }

  if (storageKey && persistColumnOrder) {
    watch(
      columnOrder,
      (value) => {
        const cols = table.getAllLeafColumns();
        persistWrite({
          columnOrder: filterOrderByColumns(value, cols),
        });
      },
      { deep: true }
    );
  }

  if (storageKey && persistColumnVisibility) {
    watch(
      columnVisibility,
      (value) => {
        const cols = table.getAllLeafColumns();
        persistWrite({
          columnVisibility: filterVisibilityByColumns(value, cols),
        });
      },
      { deep: true }
    );
  }

  if (storageKey && persistPageSize) {
    watch(
      () => pagination.value.pageSize,
      (value) => {
        if (typeof value === "number" && value > 0) {
          persistWrite({ pageSize: value });
        }
      }
    );
  }

  if (storageKey) {
    watch(columnOrderLocked, (isLocked) => {
      writePersisted({ columnOrderLocked: isLocked });
    });
  }

  function resetAll() {
    columnSizing.value = {};
    columnOrder.value = [];

    const cols = columnsSource.value;
    const defaultHiddenVisibility: ColumnVisibilityState = {};
    for (const col of cols) {
      const id = getColumnId(col);
      if (id !== null && hasMetaFlag(col, "defaultHidden")) {
        defaultHiddenVisibility[id] = false;
      }
    }
    columnVisibility.value = defaultHiddenVisibility;

    removePersisted(["columnSizing", "columnOrder", "columnVisibility"]);
  }

  return {
    table,
    sorting,
    pagination,
    expanded,
    columnPinning,
    columnSizing,
    columnOrder,
    columnVisibility,
    columnOrderLocked,
    resetAll,
  };
}
