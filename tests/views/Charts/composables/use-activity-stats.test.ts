import { describe, expect, it } from "vitest";
import { ref } from "vue";

import dayjs from "dayjs";

import type { InstanceActivityEntry } from "../../../../src/views/Charts/activity-types";
import { useActivityStats } from "../../../../src/views/Charts/composables/use-activity-stats";

function makeEntry(time: number | null): InstanceActivityEntry {
  return {
    id: null,
    created_at: null,
    type: null,
    display_name: null,
    location: "wrld_test:1",
    user_id: null,
    time,
    joinTime: dayjs(0),
    leaveTime: dayjs(0),
    isFriend: null,
    isFavorite: null,
  };
}

describe("useActivityStats", () => {
  it("sums all time values from activityData", () => {
    const data = ref([makeEntry(1000), makeEntry(2000), makeEntry(3000)]);
    const { totalOnlineTime } = useActivityStats(data);
    expect(totalOnlineTime.value).toBe(6000);
  });

  it("returns 0 for empty array", () => {
    const data = ref<InstanceActivityEntry[]>([]);
    const { totalOnlineTime } = useActivityStats(data);
    expect(totalOnlineTime.value).toBe(0);
  });

  it("returns undefined when activityData is null", () => {
    const data = ref<InstanceActivityEntry[] | null>(null);
    const { totalOnlineTime } = useActivityStats(data);
    expect(totalOnlineTime.value).toBeUndefined();
  });

  it("treats a null time as 0", () => {
    const data = ref([makeEntry(42), makeEntry(null)]);
    const { totalOnlineTime } = useActivityStats(data);
    expect(totalOnlineTime.value).toBe(42);
  });

  it("handles single item", () => {
    const data = ref([makeEntry(42)]);
    const { totalOnlineTime } = useActivityStats(data);
    expect(totalOnlineTime.value).toBe(42);
  });

  it("reacts to changes in activityData", () => {
    const data = ref([makeEntry(100)]);
    const { totalOnlineTime } = useActivityStats(data);

    expect(totalOnlineTime.value).toBe(100);

    data.value = [makeEntry(200), makeEntry(300)];
    expect(totalOnlineTime.value).toBe(500);
  });
});
