export function buildToggleRow({ key, label, count = null, expanded = true, headerPadding = null, paddingBottom = null, onClick = null }) {
  return {
    type: "toggle-header",
    key,
    label,
    count,
    expanded,
    headerPadding,
    paddingBottom,
    onClick,
  };
}

export function buildFriendRow(friend, key, options = {}) {
  return {
    type: "friend-item",
    key,
    friend,
    isGroupByInstance: options.isGroupByInstance,
    paddingBottom: options.paddingBottom,
    itemStyle: options.itemStyle,
  };
}

export function buildInstanceHeaderRow(location, count, key) {
  return {
    type: "instance-header",
    key,
    location,
    count,
    paddingBottom: 4,
  };
}

export function estimateRowSize(row) {
  if (!row) {
    return 44;
  }
  if (row.type === "toggle-header") {
    return 28 + (row.paddingBottom || 0);
  }
  if (row.type === "vip-subheader") {
    return 24 + (row.paddingBottom || 0);
  }
  if (row.type === "instance-header") {
    return 26 + (row.paddingBottom || 0);
  }
  return 52 + (row.paddingBottom || 0);
}
