import type { Ref } from "vue";

import { APP_CJK_FONT_PACKS, APP_FONT_DEFAULT_KEY, APP_FONT_FAMILIES } from "../../shared/constants/fonts";
import { configRepository } from "../../services/config";
import { THEME_CONFIG } from "../../shared/constants/themes";

export const MAX_TABLE_PAGE_SIZE = 1000;
export const DEFAULT_TABLE_PAGE_SIZES: readonly number[] = [10, 15, 20, 25, 50, 100];
export const DEFAULT_SIDEBAR_SORT_METHODS: readonly string[] = ["Sort Private to Bottom", "Sort by Time in Instance", "Sort by Last Active"];

export const TRUST_COLOR_DEFAULTS: Readonly<TrustColors> = Object.freeze({
  untrusted: "#CCCCCC",
  basic: "#1778FF",
  known: "#2BCF5C",
  trusted: "#FF7B42",
  veteran: "#B18FFF",
  vip: "#FF2626",
  troll: "#782F2F",
});

export type TrustColors = Record<string, string>;

export type TableDensity = "standard" | "compact" | "comfortable";

export type TableLimitsDialogState = {
  visible: boolean;
  maxTableSize: number | string;
  searchLimit: number | string;
};

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  return Math.min(max, Math.max(min, n));
}

export function clampLimit(value: unknown, min: number, max: number): number | null {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) {
    return null;
  }
  if (n < min || n > max) {
    return null;
  }
  return n;
}

export function isDarkThemeMode(mode: string): boolean {
  return Object.entries(THEME_CONFIG).some(([key, config]) => key === mode && config.isDark === true);
}

export function resolveLastDarkTheme(value: unknown, fallback = "dark"): string {
  const normalized = isString(value) ? value.trim() : "";
  return isDarkThemeMode(normalized) ? normalized : fallback;
}

export function normalizeAppFontFamily(value: unknown): string {
  if (value === "custom") {
    return "custom";
  }
  return isString(value) && APP_FONT_FAMILIES.includes(value) ? value : APP_FONT_DEFAULT_KEY;
}

export function normalizeAppCjkFontPack(value: unknown, fallback: string): string {
  return isString(value) && APP_CJK_FONT_PACKS.includes(value) ? value : fallback;
}

export function normalizeTableDensity(value: unknown): TableDensity {
  if (value === "compact" || value === "comfortable" || value === "standard") {
    return value;
  }
  return "standard";
}

export function normalizeTablePageSizes(input: unknown): number[] {
  const source: readonly unknown[] = Array.isArray(input) ? input : DEFAULT_TABLE_PAGE_SIZES;
  const values = source.map((v) => Math.trunc(Number(v))).filter((v) => v > 0 && v <= MAX_TABLE_PAGE_SIZE);
  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a - b);
  return uniqueSorted.length > 0 ? uniqueSorted : [...DEFAULT_TABLE_PAGE_SIZES];
}

export function parseJsonValue(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

export function parseStringArray(text: string): string[] {
  const parsed = parseJsonValue(text);
  const source: readonly unknown[] = Array.isArray(parsed) ? parsed : [];
  return source.filter(isString);
}

export function applyTableDensity(density: TableDensity): void {
  const classList = document.documentElement.classList;
  classList.remove("is-compact-table", "is-comfortable-table");
  if (density === "compact") {
    classList.add("is-compact-table");
  }
  if (density === "comfortable") {
    classList.add("is-comfortable-table");
  }
}

export function applyAccessibleStatusClass(isAccessible: boolean): void {
  const classList = document.documentElement.classList;
  classList.remove("accessible-status-indicators");
  if (isAccessible) {
    classList.add("accessible-status-indicators");
  }
}

export function saveSetting(task: Promise<void>): void {
  task.catch((error: unknown) => console.error(error));
}

export function createBooleanToggle(state: Ref<boolean>, key: string): () => void {
  return () => {
    state.value = !state.value;
    saveSetting(configRepository.setBool(key, state.value));
  };
}
