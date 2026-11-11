import { isNavEntryActionable } from "./nav-action-utils";
import type { NavDefinition, NavLayoutEntry, NavMenuChild, NavMenuItem, NavTranslate } from "./nav-menu-types";

const DEFAULT_FOLDER_ICON = "ri-folder-line";

export function collectLayoutKeys(layout: NavLayoutEntry[]): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(layout)) {
    return keys;
  }

  layout.forEach((entry) => {
    if (entry.type === "item" && entry.key) {
      keys.add(entry.key);
      return;
    }

    if (entry.type === "folder" && Array.isArray(entry.items)) {
      entry.items.forEach((key) => {
        if (key) {
          keys.add(key);
        }
      });
    }
  });

  return keys;
}

function isNavDefinition(definition: NavDefinition | undefined): definition is NavDefinition {
  return definition !== undefined;
}

export function buildMenuItems(layout: NavLayoutEntry[], navDefinitionMap: Map<string, NavDefinition>, t: NavTranslate): NavMenuItem[] {
  const items: NavMenuItem[] = [];

  layout.forEach((entry) => {
    if (entry.type === "item") {
      const definition = navDefinitionMap.get(entry.key);
      if (!definition) {
        return;
      }

      items.push({
        ...definition,
        index: definition.key,
        title: definition.tooltip || definition.labelKey,
        titleIsCustom: Boolean(definition.isDashboard),
      });
      return;
    }

    const folderDefinitions = entry.items.map((key) => navDefinitionMap.get(key)).filter(isNavDefinition);
    if (folderDefinitions.length === 0) {
      return;
    }

    const folderName = entry.name?.trim() ?? "";
    const folderIcon = entry.icon ?? "";
    const children: NavMenuChild[] = folderDefinitions.map((definition) => ({
      label: definition.labelKey,
      routeName: definition.routeName,
      routeParams: definition.routeParams,
      index: definition.key,
      icon: definition.icon,
      action: definition.action,
      path: definition.path,
      titleIsCustom: Boolean(definition.isDashboard),
    }));
    items.push({
      index: entry.id ?? "",
      icon: folderIcon === "" ? DEFAULT_FOLDER_ICON : folderIcon,
      title: folderName === "" ? t("nav_menu.custom_nav.folder_name_placeholder") : folderName,
      titleIsCustom: true,
      children,
    });
  });

  return items;
}

export function findFirstNavEntry(layout: NavLayoutEntry[], navDefinitionMap: Map<string, NavDefinition>): NavDefinition | null {
  for (const entry of layout) {
    if (entry.type === "item") {
      const definition = navDefinitionMap.get(entry.key);
      if (definition && isNavEntryActionable(definition)) {
        return definition;
      }
    }

    if (entry.type === "folder" && entry.items.length) {
      const definition = entry.items.map((key) => navDefinitionMap.get(key)).find((def) => isNavEntryActionable(def));
      if (definition) {
        return definition;
      }
    }
  }

  return null;
}

export function findFirstNavKey(layout: NavLayoutEntry[], navDefinitionMap: Map<string, NavDefinition>): string | null {
  const entry = findFirstNavEntry(layout, navDefinitionMap);
  const key = entry?.key ?? "";
  return key === "" ? null : key;
}
