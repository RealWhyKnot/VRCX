import { shallowRef } from "vue";
import { expect, test, vi } from "vitest";
import type { FriendContext } from "../../src/stores/friend-types";

const mocks = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return {
    favoriteStore: reactive({
      cachedFavorites: new Map([["fav_1", { type: "friend", favoriteId: "usr_1", $groupKey: "group_0" }]]),
      localFriendFavorites: { Close: ["usr_2"] },
    }),
  };
});

vi.mock("../../src/stores/favorite", () => ({ useFavoriteStore: () => mocks.favoriteStore }));
vi.mock("../../src/services/app-config", () => ({ AppDebug: { debugRecompute: false } }));

import { createFriendDerived } from "../../src/stores/friend-derived";

function friend(id: string, state: FriendContext["state"]): FriendContext {
  return { id, name: id, state, isVIP: false, ref: undefined, pendingOffline: false, $nickName: "" };
}

function setup() {
  const list = [friend("usr_1", "online"), friend("usr_2", "online"), friend("usr_3", "online"), friend("usr_4", "active"), friend("usr_5", "offline")];
  const sortedFriends = shallowRef(list);
  const derived = createFriendDerived({
    friends: new Map(list.map((entry) => [entry.id, entry])),
    sortedFriends,
    appearanceSettingsStore: { sidebarSortMethods: [] },
    generalSettingsStore: { localFavoriteFriendsGroups: [] },
    locationStore: { lastLocation: { date: null, location: "", name: "", playerList: new Map(), friendList: new Map() } },
  });
  return { derived, sortedFriends };
}

test("serves friend lists from cache on repeated reads", () => {
  const { derived } = setup();

  for (let read = 0; read < 5; read += 1) {
    expect(derived.allFavoriteFriendIds.value).toEqual(new Set(["usr_1", "usr_2"]));
    expect(derived.allFavoriteOnlineFriends.value.map((entry) => entry.id)).toEqual(["usr_1", "usr_2"]);
    expect(derived.onlineFriends.value).toHaveLength(3);
    expect(derived.activeFriends.value).toHaveLength(1);
    expect(derived.offlineFriends.value).toHaveLength(1);
  }

  expect(derived.getDerivedDebugCounters()).toMatchObject({
    allFavoriteFriendIds: 1,
    allFavoriteOnlineFriends: 1,
    onlineFriends: 1,
    activeFriends: 1,
    offlineFriends: 1,
  });
});

test("recomputes friend lists once when the sorted friends change", () => {
  const { derived, sortedFriends } = setup();
  expect(derived.onlineFriends.value).toHaveLength(3);

  sortedFriends.value = [friend("usr_1", "online"), friend("usr_4", "active")];

  expect(derived.onlineFriends.value).toHaveLength(1);
  expect(derived.onlineFriends.value).toHaveLength(1);
  expect(derived.getDerivedDebugCounters().onlineFriends).toBe(2);
});
