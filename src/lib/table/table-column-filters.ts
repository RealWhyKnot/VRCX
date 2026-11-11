import type { ColumnOrderState, ColumnSizingState, ColumnVisibilityState, SortingState } from "@tanstack/vue-table";
import { isPersistedState, isRecord, isSortingEntry, isString } from "./table-persisted-state";
import type { ColumnIdentity } from "./use-vrcx-vue-table";

export function hasMetaFlag(column: ColumnIdentity, flag: string): boolean {
  return isRecord(column.meta) && Boolean(column.meta[flag]);
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
