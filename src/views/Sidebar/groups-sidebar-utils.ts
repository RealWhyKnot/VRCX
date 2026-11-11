import type { InstanceEntry } from "../../stores/instance-types";
import type { VrcxGroup } from "../../types/vrcx";

export type GroupSidebarEntry = {
  group?: Partial<VrcxGroup>;
  instance?: Partial<InstanceEntry>;
  ageGate?: boolean;
  location?: string;
};

export type GroupCollapseConfig = Record<string, { isCollapsed: boolean }>;

export type GroupHeaderRow = {
  type: "group-header";
  key: string;
  groupId: string;
  label: string;
  count: number;
  isCollapsed: boolean;
  headerPaddingTop: string;
};

export type GroupItemRow = {
  type: "group-item";
  key: string;
  ownerId: string;
  iconUrl: string;
  name: string;
  userCount: number;
  capacity: number;
  location: string;
  isVisible: boolean;
};

export type GroupSidebarRow = GroupHeaderRow | GroupItemRow;

export function getGroupId(group: GroupSidebarEntry[]): string {
  return group[0]?.group?.groupId ?? "";
}

export function buildGroupHeaderRow(group: GroupSidebarEntry[], index: number, cfg: GroupCollapseConfig): GroupHeaderRow {
  const groupId = getGroupId(group);
  return {
    type: "group-header",
    key: `group-header:${groupId}`,
    groupId,
    label: group[0]?.group?.name ?? "",
    count: group.length,
    isCollapsed: Boolean(cfg[groupId]?.isCollapsed),
    headerPaddingTop: index === 0 ? "0px" : "10px",
  };
}

export function buildGroupItemRow(ref: GroupSidebarEntry, index: number, groupId: string, isAgeGatedVisible: boolean): GroupItemRow {
  return {
    type: "group-item",
    key: `group-item:${groupId}:${ref.instance?.id ?? index}`,
    ownerId: ref.instance?.ownerId ?? "",
    iconUrl: ref.group?.iconUrl ?? "",
    name: ref.group?.name ?? "",
    userCount: ref.instance?.userCount ?? 0,
    capacity: ref.instance?.capacity ?? 0,
    location: ref.instance?.location ?? "",
    isVisible: isAgeGatedVisible || !(ref.ageGate === true || ref.location?.includes("~ageGate") === true),
  };
}

export function estimateGroupRowSize(row: { type: string } | null | undefined): number {
  if (!row) return 44;
  if (row.type === "group-header") {
    return 30;
  }
  return 52;
}
