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
  headerPadding?: string | number | null | undefined;
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
    paddingBottom: 0,
  };
}

const HEADER_TEXT_HEIGHT = 16;
const DEFAULT_HEADER_PADDING = "1rem 0 0.5rem";

function toPixels(token: string): number {
  const value = Number(token.replace(/(px|rem)$/, ""));
  if (!Number.isFinite(value)) {
    return 0;
  }
  return token.endsWith("rem") ? value * 16 : value;
}

function verticalPadding(padding: string | number | null | undefined): number {
  if (typeof padding === "number") {
    return 0;
  }
  const tokens = (padding ?? DEFAULT_HEADER_PADDING).trim().split(/\s+/);
  const top = tokens[0] ?? "0";
  const bottom = tokens[2] ?? top;
  return toPixels(top) + toPixels(bottom);
}

export function estimateRowSize(row: SizedRow | null | undefined): number {
  if (!row) {
    return 48;
  }
  const extra = row.paddingBottom ?? 0;
  if (row.type === "toggle-header") {
    return HEADER_TEXT_HEIGHT + verticalPadding(row.headerPadding) + extra;
  }
  if (row.type === "instance-header") {
    return 28 + extra;
  }
  return 48 + extra;
}
