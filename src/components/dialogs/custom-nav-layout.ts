import type { NavLayoutEntry } from "../nav-menu/nav-menu-types";
import type { NavLayoutState, NavVisibleNode } from "./custom-nav-types";

export const isFolderEntry = <T extends NavLayoutEntry | NavLayoutState>(entry: T): entry is Extract<T, { type: "folder" }> => entry.type === "folder";
export const toOptionalId = (value: string | null | undefined): string | null => (value === undefined || value === "" ? null : value);

export const cloneLayout = (source: NavLayoutEntry[]): NavLayoutState[] => {
  if (!Array.isArray(source)) return [];
  return source.map((entry): NavLayoutState => {
    if (isFolderEntry(entry)) {
      return {
        type: "folder",
        id: entry.id ?? "",
        name: entry.name ?? "",
        nameKey: toOptionalId(entry.nameKey),
        icon: entry.icon ?? "",
        items: Array.isArray(entry.items) ? [...entry.items] : [],
      };
    }
    return { type: "item", key: entry.key };
  });
};

export const buildVisibleNodes = (layout: NavLayoutState[], expandedKeys: string[]): NavVisibleNode[] => {
  const list: NavVisibleNode[] = [];
  for (const entry of layout) {
    if (isFolderEntry(entry)) {
      const folderId = entry.id;
      list.push({ type: "folder", id: folderId });
      if (!expandedKeys.includes(entry.id)) {
        continue;
      }
      for (const key of entry.items) {
        list.push({ type: "item", id: key, key, parentId: folderId });
      }
    } else {
      list.push({ type: "item", id: entry.key, key: entry.key });
    }
  }
  return list;
};
