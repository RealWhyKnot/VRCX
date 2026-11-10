import { computed } from "vue";

import dayjs from "dayjs";

export function useActivityDataProcessor(activityData, activityDetailData, isDetailVisible, isSoloInstanceVisible, isNoFriendInstanceVisible, selectedDate) {
  const totalOnlineTime = computed(() => {
    return activityData.value?.reduce((acc, item, idx) => {
      if (idx === 0) {
        const midnight = dayjs.tz(selectedDate.value).startOf("day");
        if (midnight.isAfter(item.joinTime)) {
          return item.leaveTime - dayjs.tz(midnight).valueOf();
        }
      }
      return acc + item.time;
    }, 0);
  });

  const filteredActivityDetailData = computed(() => {
    if (!isDetailVisible.value) {
      return [];
    }
    let result = [...activityDetailData.value];
    if (!isSoloInstanceVisible.value) {
      result = result.filter((arr) => arr.length > 1);
    }
    if (!isNoFriendInstanceVisible.value) {
      result = result.filter((arr) => {
        if (arr.length === 1) {
          return true;
        }
        return arr.some((item) => item.isFriend);
      });
    }
    return result;
  });

  return {
    totalOnlineTime,
    filteredActivityDetailData,
  };
}
