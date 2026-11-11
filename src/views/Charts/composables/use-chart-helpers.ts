import type { InstanceActivityEntry } from "../activity-types";

export function isDetailDataFiltered(
  detailData: InstanceActivityEntry[] | null | undefined,
  isSoloInstanceVisible: boolean,
  isNoFriendInstanceVisible: boolean
): boolean {
  if (!detailData) return false;

  if (!isSoloInstanceVisible && detailData.length <= 1) {
    return true;
  }

  if (!isNoFriendInstanceVisible && detailData.length > 1 && !detailData.some((item) => item.isFriend)) {
    return true;
  }

  return false;
}

export function findMatchingDetailData(
  activityItem: InstanceActivityEntry | null,
  activityDetailData: InstanceActivityEntry[][],
  currentUser: { id: string } | null
): InstanceActivityEntry[] | null | undefined {
  if (!activityItem || !currentUser) return null;

  return activityDetailData.find((arr) => {
    const isSameLocation = arr[0]?.location === activityItem.location;
    const isSameJoinTime = arr.find((item) => item.user_id === currentUser.id)?.joinTime.isSame(activityItem.joinTime);
    return isSameLocation && isSameJoinTime;
  });
}

export function generateYAxisLabel(worldName: string, isFiltered: boolean, maxLength = 20): string {
  const truncatedName = worldName.length > maxLength ? `${worldName.slice(0, maxLength)}...` : worldName;
  return isFiltered ? `{filtered|${truncatedName}}` : `{normal|${truncatedName}}`;
}

export function formatWorldName(worldName: string, maxLength = 20): string {
  return worldName.length > maxLength ? `${worldName.slice(0, maxLength)}...` : worldName;
}

export function useChartHelpers() {
  return {
    isDetailDataFiltered,
    findMatchingDetailData,
    generateYAxisLabel,
    formatWorldName,
  };
}
