import { describe, expect, it } from "vitest";

import dayjs from "dayjs";

import type { InstanceActivityEntry } from "../../../../src/views/Charts/activity-types";
import { findMatchingDetailData, formatWorldName, generateYAxisLabel, isDetailDataFiltered } from "../../../../src/views/Charts/composables/use-chart-helpers";

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

describe("isDetailDataFiltered", () => {
  it("returns false when both filters are enabled", () => {
    const detailData = [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })];
    expect(isDetailDataFiltered(detailData, true, true)).toBe(false);
  });

  it("returns false when detailData is null/undefined", () => {
    expect(isDetailDataFiltered(null, false, false)).toBe(false);
    expect(isDetailDataFiltered(undefined, true, false)).toBe(false);
  });

  it("filters solo instance when isSoloInstanceVisible is false and only 1 entry", () => {
    const detailData = [makeEntry({ isFriend: false })];
    expect(isDetailDataFiltered(detailData, false, true)).toBe(true);
  });

  it("does not filter solo when isSoloInstanceVisible is true", () => {
    const detailData = [makeEntry({ isFriend: false })];
    expect(isDetailDataFiltered(detailData, true, true)).toBe(false);
  });

  it("filters no-friend instance when isNoFriendInstanceVisible is false", () => {
    const detailData = [makeEntry({ isFriend: false }), makeEntry({ isFriend: false })];
    expect(isDetailDataFiltered(detailData, true, false)).toBe(true);
  });

  it("does not filter when at least one friend exists", () => {
    const detailData = [makeEntry({ isFriend: true }), makeEntry({ isFriend: false })];
    expect(isDetailDataFiltered(detailData, true, false)).toBe(false);
  });
});

describe("findMatchingDetailData", () => {
  const currentUser = { id: "user1" };

  it("returns null when activityItem is null", () => {
    expect(findMatchingDetailData(null, [], currentUser)).toBeNull();
  });

  it("returns null when currentUser is null", () => {
    expect(findMatchingDetailData(makeEntry({ location: "loc1" }), [], null)).toBeNull();
  });

  it("finds matching detail data by location and joinTime", () => {
    const joinTime = dayjs("2025-01-01T00:00:00.000Z");
    const activityItem = makeEntry({ location: "wrld_abc", joinTime });
    const detailData = [
      [
        makeEntry({ location: "wrld_abc", user_id: "user1", joinTime }),
        makeEntry({ location: "wrld_abc", user_id: "user2", joinTime: dayjs("2025-01-02T00:00:00.000Z") }),
      ],
      [makeEntry({ location: "wrld_xyz", user_id: "user1", joinTime: dayjs("2024-01-01T00:00:00.000Z") })],
    ];

    const result = findMatchingDetailData(activityItem, detailData, currentUser);
    expect(result).toBe(detailData[0]);
  });

  it("returns undefined when no match is found", () => {
    const activityItem = makeEntry({ location: "wrld_abc", joinTime: dayjs("2025-01-01T00:00:00.000Z") });
    const detailData = [[makeEntry({ location: "wrld_xyz", user_id: "user1", joinTime: dayjs("2024-01-01T00:00:00.000Z") })]];

    const result = findMatchingDetailData(activityItem, detailData, currentUser);
    expect(result).toBeUndefined();
  });
});

describe("generateYAxisLabel", () => {
  it("returns filtered label format for filtered data", () => {
    expect(generateYAxisLabel("TestWorld", true)).toBe("{filtered|TestWorld}");
  });

  it("returns normal label format for non-filtered data", () => {
    expect(generateYAxisLabel("TestWorld", false)).toBe("{normal|TestWorld}");
  });

  it("truncates long world names", () => {
    const longName = "A".repeat(30);
    const result = generateYAxisLabel(longName, false);
    expect(result).toBe(`{normal|${"A".repeat(20)}...}`);
  });

  it("respects custom maxLength", () => {
    const result = generateYAxisLabel("Hello World!", false, 5);
    expect(result).toBe("{normal|Hello...}");
  });
});

describe("formatWorldName", () => {
  it("returns name as-is when within maxLength", () => {
    expect(formatWorldName("Short")).toBe("Short");
  });

  it("truncates and adds ellipsis when name exceeds maxLength", () => {
    const longName = "A".repeat(25);
    expect(formatWorldName(longName)).toBe(`${"A".repeat(20)}...`);
  });

  it("respects custom maxLength", () => {
    expect(formatWorldName("Hello World", 5)).toBe("Hello...");
  });

  it("does not truncate at exact maxLength boundary", () => {
    const exactName = "A".repeat(20);
    expect(formatWorldName(exactName)).toBe(exactName);
  });
});
