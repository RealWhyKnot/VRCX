import { describe, expect, test } from "vitest";

import { buildGroupOverview, filterGroupOverview, type GroupNotificationStats, type GroupVisitStats } from "../../../src/shared/utils/group-overview";

const visits = new Map<string, GroupVisitStats>([["grp_a", { visitCount: 4, lastVisitAt: "2026-10-01T00:00:00.000Z", timeSpent: 9000 }]]);
const notifications = new Map<string, GroupNotificationStats>([["grp_b", { notificationCount: 12, lastNotificationAt: "2026-11-01T00:00:00.000Z" }]]);

describe("buildGroupOverview", () => {
  test("joins each group with its visit and notification history", () => {
    const rows = buildGroupOverview(
      [
        { id: "grp_a", name: "Alpha", iconUrl: "https://example.test/a.png", memberCount: 50, ownerId: "usr_other" },
        { id: "grp_b", name: "Beta", memberCount: 7, ownerId: "usr_me" },
      ],
      visits,
      notifications,
      "usr_me"
    );
    expect(rows).toEqual([
      {
        id: "grp_a",
        name: "Alpha",
        iconUrl: "https://example.test/a.png",
        memberCount: 50,
        canLeave: true,
        notificationCount: 0,
        lastNotificationAt: "",
        visitCount: 4,
        lastVisitAt: "2026-10-01T00:00:00.000Z",
        timeSpent: 9000,
      },
      {
        id: "grp_b",
        name: "Beta",
        iconUrl: "",
        memberCount: 7,
        canLeave: false,
        notificationCount: 12,
        lastNotificationAt: "2026-11-01T00:00:00.000Z",
        visitCount: 0,
        lastVisitAt: "",
        timeSpent: 0,
      },
    ]);
  });

  test("skips entries without an id and falls back to the id for a missing name", () => {
    const rows = buildGroupOverview([{ name: "Ghost" }, { id: "" }, { id: "grp_c", iconUrl: null }], new Map(), new Map(), "usr_me");
    expect(rows.map((row) => [row.id, row.name, row.iconUrl, row.memberCount])).toEqual([["grp_c", "grp_c", "", 0]]);
  });
});

describe("filterGroupOverview", () => {
  const rows = buildGroupOverview(
    [
      { id: "grp_a", name: "Night Owls" },
      { id: "grp_b", name: "Day Walkers" },
    ],
    new Map(),
    new Map(),
    "usr_me"
  );

  test("returns every row for a blank search", () => {
    expect(filterGroupOverview(rows, "   ")).toBe(rows);
  });

  test("matches names without caring about case or padding", () => {
    expect(filterGroupOverview(rows, "  OWL ").map((row) => row.id)).toEqual(["grp_a"]);
  });

  test("returns nothing when no name matches", () => {
    expect(filterGroupOverview(rows, "x".repeat(5000))).toEqual([]);
  });
});
