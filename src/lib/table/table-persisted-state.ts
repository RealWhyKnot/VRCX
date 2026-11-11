import type { ColumnSizingState, ColumnVisibilityState, SortingState } from "@tanstack/vue-table";

export type PersistedState = {
  sorting?: unknown;
  columnSizing?: unknown;
  columnOrder?: unknown;
  columnVisibility?: unknown;
  pageSize?: unknown;
  columnOrderLocked?: unknown;
  updatedAt?: unknown;
};

export function isPersistedState(value: unknown): value is PersistedState {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSortingEntry(value: unknown): value is SortingState[number] {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && "desc" in value && typeof value.desc === "boolean";
}

export function isNumberRecord(value: unknown): value is ColumnSizingState {
  return isPersistedState(value) && Object.values(value).every((item) => typeof item === "number");
}

export function isBooleanRecord(value: unknown): value is ColumnVisibilityState {
  return isPersistedState(value) && Object.values(value).every((item) => typeof item === "boolean");
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function readPersistedState(str: string | null): PersistedState | null {
  const parsed = safeJsonParse(str);
  return isPersistedState(parsed) ? parsed : null;
}
