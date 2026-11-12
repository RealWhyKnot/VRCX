import { describe, expect, test } from "vitest";

import {
  buildGatherings,
  buildOnlineOverlap,
  buildVoteKicks,
  filterGatherings,
  filterOnlineOverlap,
  filterRepeatEncounters,
  filterVoteKicks,
  isPeopleView,
  patternWindowStart,
  type FriendStay,
  type PresenceEvent,
} from "../../../src/shared/utils/people-patterns";

const HOUR = 60 * 60 * 1000;
const BASE = Date.UTC(2026, 9, 1, 12);

function stay(location: string, userId: string, fromHour: number, toHour: number, overrides: Partial<FriendStay> = {}): FriendStay {
  return {
    location,
    worldName: "World",
    groupName: "",
    userId,
    displayName: userId.toUpperCase(),
    startedAt: BASE + fromHour * HOUR,
    endedAt: BASE + toHour * HOUR,
    ...overrides,
  };
}

function online(userId: string, hour: number, isOnline: boolean, displayName = userId): PresenceEvent {
  return { userId, displayName, at: BASE + hour * HOUR, isOnline };
}

describe("buildGatherings", () => {
  test("keeps only friends whose stays overlap and measures the shared time", () => {
    const rows = buildGatherings([stay("wrld_a:1", "ann", 0, 3), stay("wrld_a:1", "bob", 2, 5), stay("wrld_a:1", "cy", 8, 9)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.people.map((person) => person.id)).toEqual(["ann", "bob"]);
    expect(rows[0]?.timeTogether).toBe(HOUR);
    expect(rows[0]?.startedAt).toBe(new Date(BASE + 2 * HOUR).toISOString());
    expect(rows[0]?.names).toBe("ANN, BOB");
  });

  test("drops instances where friends were there at different times", () => {
    expect(buildGatherings([stay("wrld_a:1", "ann", 0, 1), stay("wrld_a:1", "bob", 2, 3)])).toEqual([]);
  });

  test("does not count one friend's repeat visits as a gathering", () => {
    expect(buildGatherings([stay("wrld_a:1", "ann", 0, 2), stay("wrld_a:1", "ann", 1, 3)])).toEqual([]);
  });

  test("counts time with two or more friends once and sorts newest first", () => {
    const rows = buildGatherings([
      stay("wrld_old:1", "ann", 0, 2),
      stay("wrld_old:1", "bob", 0, 2),
      stay("wrld_old:1", "cy", 1, 2),
      stay("wrld_new:1", "ann", 10, 11),
      stay("wrld_new:1", "bob", 10, 12),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["wrld_new:1", "wrld_old:1"]);
    expect(rows[1]?.timeTogether).toBe(2 * HOUR);
    expect(rows[1]?.peopleCount).toBe(3);
  });

  test("ignores stays with no length", () => {
    expect(buildGatherings([stay("wrld_a:1", "ann", 1, 1), stay("wrld_a:1", "bob", 0, 2)])).toEqual([]);
  });
});

describe("buildOnlineOverlap", () => {
  test("pairs online and offline events and intersects them with my sessions", () => {
    const rows = buildOnlineOverlap(
      [online("ann", 0, true), online("ann", 4, false), online("bob", 10, true), online("bob", 11, false)],
      [{ startedAt: BASE + 2 * HOUR, endedAt: BASE + 6 * HOUR }],
      BASE + 20 * HOUR
    );
    expect(rows).toEqual([{ id: "ann", displayName: "ann", timeTogether: 2 * HOUR, theirTime: 4 * HOUR, theirShare: 50, myShare: 50 }]);
  });

  test("ignores an offline event with no online before it", () => {
    expect(buildOnlineOverlap([online("ann", 3, false)], [{ startedAt: BASE, endedAt: BASE + 5 * HOUR }], BASE + 6 * HOUR)).toEqual([]);
  });

  test("treats a friend still online as online until now, capped at twelve hours", () => {
    const mine = [{ startedAt: BASE, endedAt: BASE + 40 * HOUR }];
    expect(buildOnlineOverlap([online("ann", 1, true)], mine, BASE + 3 * HOUR)[0]?.timeTogether).toBe(2 * HOUR);
    expect(buildOnlineOverlap([online("ann", 1, true)], mine, BASE + 30 * HOUR)[0]?.timeTogether).toBe(12 * HOUR);
  });

  test("merges my back-to-back instances and never counts overlapping sessions twice", () => {
    const rows = buildOnlineOverlap(
      [online("ann", 0, true), online("ann", 2, false), online("ann", 1, true, "Ann"), online("ann", 3, false, "Ann")],
      [
        { startedAt: BASE, endedAt: BASE + HOUR },
        { startedAt: BASE + HOUR, endedAt: BASE + 3 * HOUR },
        { startedAt: BASE + 2 * HOUR, endedAt: BASE + 3 * HOUR },
      ],
      BASE + 9 * HOUR
    );
    expect(rows[0]?.timeTogether).toBeLessThanOrEqual(3 * HOUR);
    expect(rows[0]?.myShare).toBeLessThanOrEqual(100);
    expect(rows[0]?.displayName).toBe("Ann");
  });

  test("ranks friends by time online together", () => {
    const rows = buildOnlineOverlap(
      [online("ann", 0, true), online("ann", 1, false), online("bob", 0, true), online("bob", 5, false)],
      [{ startedAt: BASE, endedAt: BASE + 5 * HOUR }],
      BASE + 9 * HOUR
    );
    expect(rows.map((row) => row.id)).toEqual(["bob", "ann"]);
  });
});

describe("buildVoteKicks", () => {
  const started = (name: string, at: string) => ({ at, text: `A vote kick has been initiated against ${name}, do you agree?`, worldName: "Pub" });
  const passed = (name: string, at: string) => ({ at, text: `Vote to kick ${name} succeeded`, worldName: "Pub" });

  test("joins a vote with its result when the result comes within five minutes", () => {
    const rows = buildVoteKicks([passed("Rude", "2026-11-01T10:04:59.000Z"), started("Rude", "2026-11-01T10:00:00.000Z")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe("passed");
    expect(rows[0]?.at).toBe("2026-11-01T10:00:00.000Z");
  });

  test("keeps a late or unmatched result as its own row", () => {
    const rows = buildVoteKicks([
      started("Rude", "2026-11-01T10:00:00.000Z"),
      passed("Rude", "2026-11-01T10:05:01.000Z"),
      passed("Other", "2026-11-01T10:06:00.000Z"),
    ]);
    expect(rows.map((row) => `${row.displayName}:${row.outcome}`)).toEqual(["Other:passed", "Rude:passed", "Rude:started"]);
  });

  test("matches the latest open vote and keeps names with commas whole", () => {
    const rows = buildVoteKicks([
      started("A, B", "2026-11-01T10:00:00.000Z"),
      started("A, B", "2026-11-01T10:02:00.000Z"),
      passed("A, B", "2026-11-01T10:03:00.000Z"),
    ]);
    expect(rows.map((row) => row.outcome)).toEqual(["passed", "started"]);
    expect(rows[0]?.displayName).toBe("A, B");
  });

  test("lists being kicked myself, skips other text and gives every row its own id", () => {
    const rows = buildVoteKicks([
      { at: "2026-11-02T10:00:00.000Z", text: "You have been kicked from the instance", worldName: "" },
      { at: "2026-11-02T10:00:00.000Z", text: "Something else happened", worldName: "" },
      started("x".repeat(5000), "2026-11-02T10:00:00.000Z"),
    ]);
    expect(rows.map((row) => row.outcome).sort()).toEqual(["self", "started"]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
    expect(filterVoteKicks(rows, "XXX")).toHaveLength(1);
    expect(filterVoteKicks(rows, "pub")).toHaveLength(1);
    expect(filterVoteKicks(rows, "")).toHaveLength(2);
  });
});

describe("filters and helpers", () => {
  test("search matches names, worlds and groups without caring about case", () => {
    const gatherings = buildGatherings([stay("wrld_a:1", "ann", 0, 2, { worldName: "Black Cat", groupName: "Night Owls" }), stay("wrld_a:1", "bob", 0, 2)]);
    expect(filterGatherings(gatherings, "black")).toHaveLength(1);
    expect(filterGatherings(gatherings, "  OWLS ")).toHaveLength(1);
    expect(filterGatherings(gatherings, "bob")).toHaveLength(1);
    expect(filterGatherings(gatherings, "zzz")).toHaveLength(0);
    const encounter = { id: "usr_1", displayName: "Stranger", placeCount: 4, lastSeenAt: "", timeTogether: 0 };
    expect(filterRepeatEncounters([encounter], "stran")).toEqual([encounter]);
    expect(filterRepeatEncounters([encounter], "x".repeat(5000))).toEqual([]);
    const overlap = { id: "usr_2", displayName: "Friend", timeTogether: 1, theirTime: 2, theirShare: 50, myShare: 10 };
    expect(filterOnlineOverlap([overlap], "")).toEqual([overlap]);
  });

  test("knows the view names and the start of the window", () => {
    expect(isPeopleView("gatherings")).toBe(true);
    expect(isPeopleView("seen")).toBe(true);
    expect(isPeopleView("other")).toBe(false);
    expect(patternWindowStart(Date.UTC(2026, 10, 11))).toBe("2026-08-13T00:00:00.000Z");
  });
});
