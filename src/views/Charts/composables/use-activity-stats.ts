import { computed } from "vue";
import type { Ref } from "vue";

import type { InstanceActivityEntry } from "../activity-types";

export function useActivityStats(activityData: Ref<InstanceActivityEntry[] | null>) {
  const totalOnlineTime = computed(() => {
    return activityData.value?.reduce((acc, item) => acc + (item.time ?? 0), 0);
  });

  return {
    totalOnlineTime,
  };
}
