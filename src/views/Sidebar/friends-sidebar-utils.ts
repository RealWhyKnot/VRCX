import type { CSSProperties } from "vue";

export type ToggleRow = {
  type: "toggle-header";
  key: string;
  label: string;
  count: number | null;
  isExpanded: boolean;
  headerPadding: string | number | null;
  paddingBottom: number | null;
  onClick: (() => void) | null;
};

export type FriendRow<T> = {
  type: "friend-item";
  key: string;
  friend: T;
  isGroupByInstance: boolean | undefined;
  paddingBottom: number | undefined;
  itemStyle: CSSProperties | undefined;
};

export type InstanceHeaderRow = {
  type: "instance-header";
  key: string;
  location: string | undefined;
  count: number;
  paddingBottom: number;
};

export type MeRow = {
  type: "me-item";
  key: string;
  paddingBottom?: undefined;
};

export type SizedRow = {
  type: string;
  paddingBottom?: number | null | undefined;
};

type ToggleRowOptions = {
  key: string;
  label: string;
  count?: number | null;
  isExpanded?: boolean;
  headerPadding?: string | number | null;
  paddingBottom?: number | null;
  onClick?: (() => void) | null;
};

type FriendRowOptions = {
  isGroupByInstance?: boolean | undefined;
  paddingBottom?: number | undefined;
  itemStyle?: CSSProperties | undefined;
};

export function buildToggleRow({
  key,
  label,
  count = null,
  isExpanded = true,
  headerPadding = null,
  paddingBottom = null,
  onClick = null,
}: ToggleRowOptions): ToggleRow {
  return {
    type: "toggle-header",
    key,
    label,
    count,
    isExpanded,
    headerPadding,
    paddingBottom,
    onClick,
  };
}

export function buildFriendRow<T>(friend: T, key: string, options: FriendRowOptions = {}): FriendRow<T> {
  return {
    type: "friend-item",
    key,
    friend,
    isGroupByInstance: options.isGroupByInstance,
    paddingBottom: options.paddingBottom,
    itemStyle: options.itemStyle,
  };
}

export function buildInstanceHeaderRow(location: string | undefined, count: number, key: string): InstanceHeaderRow {
  return {
    type: "instance-header",
    key,
    location,
    count,
    paddingBottom: 4,
  };
}

export function estimateRowSize(row: SizedRow | null | undefined): number {
  if (!row) {
    return 44;
  }
  if (row.type === "toggle-header") {
    return 28 + (row.paddingBottom ?? 0);
  }
  if (row.type === "vip-subheader") {
    return 24 + (row.paddingBottom ?? 0);
  }
  if (row.type === "instance-header") {
    return 26 + (row.paddingBottom ?? 0);
  }
  return 52 + (row.paddingBottom ?? 0);
}
