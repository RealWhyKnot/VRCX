import type { NavDefinition, NavLayoutFolderEntry, NavLayoutItemEntry } from "../nav-menu/nav-menu-types";

export type NavLayoutFolder = NavLayoutFolderEntry & {
  id: string;
  name: string;
  icon: string;
};

export type NavLayoutState = NavLayoutItemEntry | NavLayoutFolder;

export type NavVisibleNode = {
  type: "folder" | "item";
  id: string;
  key?: string;
  parentId?: string | null;
};

export type NavDragNode = {
  type: "folder" | "item";
  id: string;
  parentId: string | null;
};

export type NavDragState = {
  active: boolean;
  sourceId: string | null;
  sourceIsFolder: boolean;
  overTargetId: string | null;
  overIsFolder: boolean;
  lastOverNode: NavDragNode | null;
};

export type NavTreeItemNode = {
  id: string;
  type: "item";
  key: string;
  level: number;
  parentId?: string;
};

export type NavTreePlaceholderNode = {
  id: string;
  _placeholder: true;
  level: number;
};

export type NavTreeFolderNode = {
  id: string;
  type: "folder";
  name: string;
  icon: string;
  level: number;
  children: (NavTreeItemNode | NavTreePlaceholderNode)[];
};

export type NavTreeEntry = NavTreeItemNode | NavTreePlaceholderNode | NavTreeFolderNode;

export type NavFlatItem = {
  value: Record<string, unknown>;
};

export const isNavDefinition = (value: unknown): value is NavDefinition =>
  typeof value === "object" &&
  value !== null &&
  "key" in value &&
  typeof value.key === "string" &&
  "tooltip" in value &&
  typeof value.tooltip === "string" &&
  "labelKey" in value &&
  typeof value.labelKey === "string";

export const isNavTreeEntry = (value: unknown): value is NavTreeEntry =>
  typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && "level" in value && typeof value.level === "number";
