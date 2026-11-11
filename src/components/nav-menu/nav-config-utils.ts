import dayjs from "dayjs";

import type { ConfigRepository } from "../../services/config";
import { isToolNavKey } from "../../shared/constants/tools";
import { collectLayoutKeys } from "./nav-layout-helpers";
import type { NavDefinition, NavLayoutEntry } from "./nav-menu-types";

export const NAV_CONFIG_KEY = "VRCX_customNavMenuLayoutList";

export type StoredNavConfig = {
  layout: NavLayoutEntry[];
  hiddenKeys: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isNavLayoutEntry(value: unknown): value is NavLayoutEntry {
  if (!isRecord(value)) {
    return false;
  }
  if (value["type"] === "item") {
    return typeof value["key"] === "string";
  }
  if (value["type"] === "folder") {
    return (
      (value["id"] === undefined || typeof value["id"] === "string") &&
      isNullableString(value["name"]) &&
      isNullableString(value["nameKey"]) &&
      isNullableString(value["icon"]) &&
      isStringArray(value["items"])
    );
  }
  return false;
}

function parseStoredJson(storedValue: string): unknown {
  try {
    return JSON.parse(storedValue);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}

export function generateNavFolderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `nav-folder-${crypto.randomUUID()}`;
  }

  return `nav-folder-${dayjs().toISOString()}-${Math.random().toString().slice(2, 4)}`;
}

export function createNavDefinitionMap(definitions: NavDefinition[] = []): Map<string, NavDefinition> {
  const map = new Map<string, NavDefinition>();
  definitions.forEach((definition) => {
    if (definition.key) {
      map.set(definition.key, definition);
    }
  });
  return map;
}

export function buildNavDefinitionsForLayout(
  baseDefinitions: NavDefinition[] = [],
  dashboardDefinitions: NavDefinition[] = [],
  layout: NavLayoutEntry[] = [],
  hiddenKeys: string[] = []
): NavDefinition[] {
  const keysInLayout = collectLayoutKeys(layout);
  const hiddenSet = new Set(hiddenKeys);
  const visibleBaseDefinitions = baseDefinitions.filter((definition) => !isToolNavKey(definition.key) || keysInLayout.has(definition.key));
  const visibleDashboardDefinitions = dashboardDefinitions.filter((definition) => keysInLayout.has(definition.key) || hiddenSet.has(definition.key));

  return [...visibleBaseDefinitions, ...visibleDashboardDefinitions];
}

export async function loadStoredNavConfig(
  repository: ConfigRepository,
  fallbackLayout: NavLayoutEntry[],
  {
    configKey = NAV_CONFIG_KEY,
    filterHiddenKey = () => true,
  }: {
    configKey?: string;
    filterHiddenKey?: (key: string) => boolean;
  }
): Promise<StoredNavConfig> {
  let layout = fallbackLayout;
  let hiddenKeys: string[] = [];

  const storedValue = await repository.getString(configKey);
  if (!storedValue) {
    return { layout, hiddenKeys };
  }

  const parsed = parseStoredJson(storedValue);
  if (Array.isArray(parsed)) {
    layout = parsed.filter(isNavLayoutEntry);
  } else if (isRecord(parsed) && Array.isArray(parsed["layout"])) {
    layout = parsed["layout"].filter(isNavLayoutEntry);
    const storedHiddenKeys = parsed["hiddenKeys"];
    hiddenKeys = Array.isArray(storedHiddenKeys) ? storedHiddenKeys.filter(isString).filter(filterHiddenKey) : [];
  }

  return { layout, hiddenKeys };
}
