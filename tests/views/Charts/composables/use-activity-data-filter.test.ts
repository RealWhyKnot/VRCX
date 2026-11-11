import { describe, expect, it } from "vitest";
import { ref } from "vue";

import dayjs from "dayjs";

import type { InstanceActivityEntry } from "../../../../src/views/Charts/activity-types";
import { useActivityDataFilter } from "../../../../src/views/Charts/composables/use-activity-data-filter";

function makeEntry(overrides: Partial<InstanceActivityEntry> = {}): InstanceActivityEntry {
  return {
    id: null,
    created_at: null,
    type: null,
    display_name: null,
    location: "wrld_test:1",
    user_id: null,
    time: null,
    joinTime: dayjs(0),
    leaveTime: dayjs(0),
    isFriend: null,
    isFavorite: null,
    ...overrides,
  };
}

function setup({
  detailData = [],
  isDetailVisible = true,
  isSoloInstanceVisible = true,
  isNoFriendInstanceVisible = true,
}: {
  detailData?: InstanceActivityEntry[][];
  isDetailVisible?: boolean;
  isSoloInstanceVisible?: boolean;
  isNoFriendInstanceVisible?: boolean;
} = {}) {
  return useActivityDataFilter(ref(detailData), ref(isDetailVisible), ref(isSoloInstanceVisible), ref(isNoFriendInstanceVisible));
}

describe("useActivityDataFilter", () => {
  it("returns empty array when isDetailVisible is false", () => {
    const { filteredActivityDetailData } = setup({
      detailData: [[makeEntry({ isFriend: true })]],
      isDetailVisible: false,
    });
    expect(filteredActivityDetailData.value).toEqual([]);
  });

  it("returns all data when all filters are enabled", () => {
    const data = [[makeEntry({ isFriend: true })], [makeEntry({ isFriend: false })], [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })]];
    const { filteredActivityDetailData } = setup({ detailData: data });
    expect(filteredActivityDetailData.value).toHaveLength(3);
  });

  it("filters solo instances when isSoloInstanceVisible is false", () => {
    const data = [[makeEntry({ isFriend: true })], [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })]];
    const { filteredActivityDetailData } = setup({
      detailData: data,
      isSoloInstanceVisible: false,
    });
    expect(filteredActivityDetailData.value).toHaveLength(1);
    expect(filteredActivityDetailData.value[0]).toHaveLength(2);
  });

  it("filters no-friend instances when isNoFriendInstanceVisible is false", () => {
    const data = [
      [makeEntry({ isFriend: false }), makeEntry({ isFriend: false })],
      [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })],
    ];
    const { filteredActivityDetailData } = setup({
      detailData: data,
      isNoFriendInstanceVisible: false,
    });
    expect(filteredActivityDetailData.value).toHaveLength(1);
  });

  it("keeps solo instances even when isNoFriendInstanceVisible is false", () => {
    const data = [[makeEntry({ isFriend: false })]];
    const { filteredActivityDetailData } = setup({
      detailData: data,
      isNoFriendInstanceVisible: false,
    });
    expect(filteredActivityDetailData.value).toHaveLength(1);
  });

  it("combines solo and no-friend filters", () => {
    const data = [
      [makeEntry({ isFriend: false })],
      [makeEntry({ isFriend: false }), makeEntry({ isFriend: false })],
      [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })],
    ];
    const { filteredActivityDetailData } = setup({
      detailData: data,
      isSoloInstanceVisible: false,
      isNoFriendInstanceVisible: false,
    });
    expect(filteredActivityDetailData.value).toHaveLength(1);
  });

  it("returns empty array for empty input data", () => {
    const { filteredActivityDetailData } = setup({ detailData: [] });
    expect(filteredActivityDetailData.value).toEqual([]);
  });
});
