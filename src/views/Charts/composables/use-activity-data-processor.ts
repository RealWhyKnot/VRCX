import { computed } from "vue";
import type { Ref } from "vue";

import dayjs from "dayjs";

import type { InstanceActivityEntry } from "../activity-types";

export function useActivityDataProcessor(
  activityData: Ref<InstanceActivityEntry[]>,
  activityDetailData: Ref<InstanceActivityEntry[][]>,
  isDetailVisible: Ref<boolean>,
  isSoloInstanceVisible: Ref<boolean>,
  isNoFriendInstanceVisible: Ref<boolean>,
  selectedDate: Ref<Date>
) {
  const totalOnlineTime = computed(() => {
    return activityData.value.reduce((acc, item, idx) => {
      if (idx === 0) {
        const midnight = dayjs.tz(selectedDate.value).startOf("day");
        if (midnight.isAfter(item.joinTime)) {
          return item.leaveTime.valueOf() - dayjs.tz(midnight).valueOf();
        }
      }
      return acc + (item.time ?? 0);
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
