import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { FriendContext, FriendListEntry } from "../../src/stores/friend-types";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn<(params: { userId: string }) => Promise<{ json: { id: string; displayName: string; platform: string; location: string } }>>(),
  isLoggedIn: true,
}));

vi.mock("../../src/api/user", () => ({
  userRequest: {
    getUser: (params: { userId: string }) => mocks.getUser(params),
  },
}));

vi.mock("../../src/api/friend", () => ({
  friendRequest: {},
}));

vi.mock("../../src/services/app-config", () => ({
  AppDebug: { debugFriendState: false },
}));

vi.mock("../../src/services/watch-state", () => ({
  watchState: {
    get isLoggedIn() {
      return mocks.isLoggedIn;
    },
  },
}));

import { refetchBrokenFriends, refreshRemainingFriends } from "../../src/stores/friend-refresh";

function entry(id: string, platform = "standalonewindows", location = "traveling"): FriendListEntry {
  return {
    developerType: "none",
    displayName: id,
    friendKey: "",
    id,
    isFriend: true,
    last_activity: null,
    last_login: null,
    last_mobile: null,
    last_platform: "standalonewindows",
    location,
    platform,
    status: "active",
    statusDescription: "",
    tags: [],
  };
}

function friendsMap(): ReadonlyMap<string, FriendContext> {
  return new Map();
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refetchBrokenFriends", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.isLoggedIn = true;
  });

  test("never runs more than five fetches at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    mocks.getUser.mockImplementation(({ userId }) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((resolve) => {
        releases.push(() => {
          inFlight -= 1;
          resolve({ json: { id: userId, displayName: `fresh-${userId}`, platform: "standalonewindows", location: "wrld_x:1" } });
        });
      });
    });

    const friends = Array.from({ length: 12 }, (_, i) => entry(`usr_${String(i)}`));
    const pending = refetchBrokenFriends(friends, friendsMap());

    for (let round = 0; round < 40 && releases.length < 12; round++) {
      await flush();
      releases.splice(0).forEach((release) => {
        release();
      });
    }
    const result = await pending;

    expect(peak).toBe(5);
    expect(mocks.getUser).toHaveBeenCalledTimes(12);
    expect(result.map((f) => f.displayName)).toEqual(Array.from({ length: 12 }, (_, i) => `fresh-usr_${String(i)}`));
  });

  test("keeps the original entry when one fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getUser.mockImplementation(({ userId }) => {
      if (userId === "usr_1") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({ json: { id: userId, displayName: `fresh-${userId}`, platform: "standalonewindows", location: "wrld_x:1" } });
    });

    const result = await refetchBrokenFriends([entry("usr_0"), entry("usr_1"), entry("usr_2")], friendsMap());

    expect(result.map((f) => f.displayName)).toEqual(["fresh-usr_0", "usr_1", "fresh-usr_2"]);
  });
});

describe("refreshRemainingFriends", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.isLoggedIn = true;
  });

  test("fetches only the friends missing from the list", async () => {
    mocks.getUser.mockImplementation(({ userId }) =>
      Promise.resolve({ json: { id: userId, displayName: userId, platform: "standalonewindows", location: "offline" } })
    );

    const result = await refreshRemainingFriends([entry("usr_a")], ["usr_a", "usr_b", "usr_c"]);

    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(result.map((f) => f.id).sort()).toEqual(["usr_a", "usr_b", "usr_c"]);
  });

  test("stops fetching once the user is logged out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.isLoggedIn = false;

    const result = await refreshRemainingFriends([], ["usr_a", "usr_b"]);

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
