import type { NavDefinition, NavLayoutEntry, NavLayoutFolderEntry, NavMenuChild, NavTranslate } from "./nav-menu-types";

const DEFAULT_FOLDER_ICON = "ri-folder-line";

export type NavDefinitionLike = Pick<NavDefinition, "key" | "routeName" | "action">;

function isStringKey(value: unknown): value is string {
  return typeof value === "string";
}

export function normalizeHiddenKeys(hiddenKeys: unknown, definitionMap: Map<string, NavDefinitionLike>): string[] {
  if (!Array.isArray(hiddenKeys)) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  hiddenKeys.forEach((key: unknown) => {
    if (!isStringKey(key) || key === "" || seen.has(key) || !definitionMap.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push(key);
  });
  return normalized;
}

export function sanitizeLayout(
  layout: NavLayoutEntry[] | null | undefined,
  hiddenKeys: unknown,
  definitionMap: Map<string, NavDefinitionLike>,
  allDefinitions: NavDefinitionLike[],
  t: NavTranslate,
  generateFolderId: () => string
): NavLayoutEntry[] {
  const usedKeys = new Set<string>();
  const normalizedHiddenKeys = normalizeHiddenKeys(hiddenKeys, definitionMap);
  const hiddenSet = new Set(normalizedHiddenKeys);
  const normalized: NavLayoutEntry[] = [];
  const chartsKeys = ["charts-instance", "charts-mutual", "charts-hot-worlds"];

  const appendItemEntry = (key: string, target: NavLayoutEntry[] = normalized) => {
    if (!key || usedKeys.has(key) || !definitionMap.has(key)) {
      return;
    }
    target.push({ type: "item", key });
    usedKeys.add(key);
  };

  const appendChartsFolder = (target: NavLayoutEntry[] = normalized) => {
    if (chartsKeys.some((key) => usedKeys.has(key))) {
      return;
    }
    if (!chartsKeys.every((key) => definitionMap.has(key))) {
      return;
    }
    chartsKeys.forEach((key) => usedKeys.add(key));
    target.push({
      type: "folder",
      id: "default-folder-charts",
      nameKey: "nav_tooltip.charts",
      name: t("nav_tooltip.charts"),
      icon: "ri-pie-chart-line",
      items: [...chartsKeys],
    });
  };

  (layout ?? []).forEach((entry) => {
    if (entry.type === "item") {
      if (entry.key === "charts") {
        appendChartsFolder();
        return;
      }
      appendItemEntry(entry.key);
      return;
    }

    const folderItems: string[] = [];
    entry.items.forEach((key) => {
      if (!key || usedKeys.has(key) || !definitionMap.has(key)) {
        return;
      }
      folderItems.push(key);
      usedKeys.add(key);
    });

    if (folderItems.length >= 1) {
      const rawNameKey = entry.nameKey ?? "";
      const folderNameKey = rawNameKey === "" ? null : rawNameKey;
      const folderName = folderNameKey ? t(folderNameKey) : (entry.name ?? "");
      const rawId = entry.id ?? "";
      const rawIcon = entry.icon ?? "";
      normalized.push({
        type: "folder",
        id: rawId === "" ? generateFolderId() : rawId,
        name: folderName,
        nameKey: folderNameKey,
        icon: rawIcon === "" ? DEFAULT_FOLDER_ICON : rawIcon,
        items: folderItems,
      });
    }
  });

  allDefinitions.forEach((item) => {
    if (!usedKeys.has(item.key) && !hiddenSet.has(item.key)) {
      if (chartsKeys.includes(item.key)) {
        const chartsFolder = normalized.find((entry): entry is NavLayoutFolderEntry => entry.type === "folder" && entry.id === "default-folder-charts");
        if (chartsFolder) {
          chartsFolder.items.push(item.key);
          usedKeys.add(item.key);
          return;
        }
      }
      appendItemEntry(item.key);
    }
  });

  if (!chartsKeys.some((key) => usedKeys.has(key)) && !chartsKeys.some((key) => hiddenSet.has(key))) {
    appendChartsFolder();
  }

  const directAccessIdx = normalized.findIndex((entry) => entry.type === "item" && entry.key === "direct-access");
  if (directAccessIdx !== -1 && directAccessIdx !== normalized.length - 1) {
    const [directAccessEntry] = normalized.splice(directAccessIdx, 1);
    if (directAccessEntry) {
      normalized.push(directAccessEntry);
    }
  }

  return normalized;
}

export function getFirstNavRoute(layout: NavLayoutEntry[], definitionMap: Map<string, NavDefinitionLike>): string | null {
  for (const entry of layout) {
    if (entry.type === "item") {
      const definition = definitionMap.get(entry.key);
      if (definition?.routeName) {
        return definition.routeName;
      }
    }
    if (entry.type === "folder" && entry.items.length) {
      const definition = entry.items.map((key) => definitionMap.get(key)).find((def) => def?.routeName);
      if (definition?.routeName) {
        return definition.routeName;
      }
    }
  }
  return null;
}

export function isEntryNotified(entry: Partial<NavMenuChild> | null | undefined, notifiedMenus: string[]): boolean {
  if (!entry) {
    return false;
  }
  const targets: string[] = [];
  if (entry.index) {
    targets.push(entry.index);
  }
  if (entry.routeName) {
    targets.push(entry.routeName);
  }
  if (entry.path) {
    const lastSegment = entry.path.split("/").pop();
    if (lastSegment) {
      targets.push(lastSegment);
    }
  }
  return targets.some((key) => notifiedMenus.includes(key));
}
