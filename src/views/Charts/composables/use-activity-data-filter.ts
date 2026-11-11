import { computed } from "vue";
import type { Ref } from "vue";

import type { InstanceActivityEntry } from "../activity-types";

export function useActivityDataFilter(
  activityDetailData: Ref<InstanceActivityEntry[][]>,
  isDetailVisible: Ref<boolean>,
  isSoloInstanceVisible: Ref<boolean>,
  isNoFriendInstanceVisible: Ref<boolean>
) {
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
    filteredActivityDetailData,
  };
}
