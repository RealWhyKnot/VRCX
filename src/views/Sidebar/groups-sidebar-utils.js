export function getGroupId(group) {
  return group[0]?.group?.groupId || "";
}

export function buildGroupHeaderRow(group, index, cfg) {
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

export function buildGroupItemRow(ref, index, groupId, isAgeGatedVisible) {
  return {
    type: "group-item",
    key: `group-item:${groupId}:${ref?.instance?.id ?? index}`,
    ownerId: ref?.instance?.ownerId ?? "",
    iconUrl: ref?.group?.iconUrl ?? "",
    name: ref?.group?.name ?? "",
    userCount: ref?.instance?.userCount ?? 0,
    capacity: ref?.instance?.capacity ?? 0,
    location: ref?.instance?.location ?? "",
    isVisible: Boolean(isAgeGatedVisible || !(ref?.ageGate || ref?.location?.includes("~ageGate"))),
  };
}

export function estimateGroupRowSize(row) {
  if (!row) return 44;
  if (row.type === "group-header") {
    return 30;
  }
  return 52;
}
