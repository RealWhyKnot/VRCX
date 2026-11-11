import type { Ref } from "vue";

import { instanceRequest } from "../api/instance";
import { userRequest } from "../api/user";
import { compareByDisplayName, compareByLocationAt } from "../shared/utils/compare";
import { parseLocation } from "../shared/utils/location-parser";
import type { ParsedLocation, VrcxUser } from "../types/vrcx";

import type { useAppearanceSettingsStore } from "./settings/appearance";
import type { useInstanceStore } from "./instance";
import type { useLocationStore } from "./location";
import type { FriendContext } from "./friend-types";
import type { CurrentUserState, UserDialogState } from "./user-state";

export type UserDialogLocationDeps = {
  userDialog: Ref<UserDialogState>;
  currentUser: Ref<CurrentUserState>;
  cachedUsers: Map<string, VrcxUser>;
  friends: Map<string, FriendContext>;
  appearanceSettingsStore: ReturnType<typeof useAppearanceSettingsStore>;
  instanceStore: ReturnType<typeof useInstanceStore>;
  locationStore: ReturnType<typeof useLocationStore>;
};

export function applyUserDialogLocation(deps: UserDialogLocationDeps, shouldUpdateInstanceOccupants = false) {
  const { userDialog, currentUser, cachedUsers, friends, appearanceSettingsStore, instanceStore, locationStore } = deps;
  const D = userDialog.value;
  if (!D.visible) {
    return;
  }
  const L: ParsedLocation & { user: Partial<VrcxUser> } = Object.assign(parseLocation(D.ref.$location?.tag), { user: {} });
  if (shouldUpdateInstanceOccupants && L.isRealInstance) {
    void instanceRequest
      .getInstance({
        worldId: L.worldId,
        instanceId: L.instanceId,
      })
      .catch((error: unknown) => {
        console.error("Error loading instance for dialog location:", error);
      });
  }
  D.$location = L;
  const cachedOwnerId = instanceStore.cachedInstances.get(L.tag)?.ownerId;
  if (!L.userId && cachedOwnerId && !cachedOwnerId.startsWith("grp_")) {
    L.userId = cachedOwnerId;
  }
  if (L.userId) {
    const ownerRef = cachedUsers.get(L.userId);
    if (typeof ownerRef === "undefined") {
      userRequest
        .getUser({
          userId: L.userId,
        })
        .then((args) => {
          if (args.ref.id === L.userId) {
            Object.assign(L.user, args.ref);
            D.$location = L;
            applyUserDialogLocation(deps);
          }
        })
        .catch((error: unknown) => {
          console.error("Error loading user for dialog location:", error);
        });
    } else {
      L.user = ownerRef;
    }
  }
  const users: VrcxUser[] = [];
  let friendCount = 0;
  const playersInInstance = locationStore.lastLocation.playerList;
  const cachedCurrentUser = cachedUsers.get(currentUser.value.id);
  const currentLocation = cachedCurrentUser?.$location.tag;
  if (!L.isOffline && currentLocation === L.tag) {
    const selfRef = cachedUsers.get(currentUser.value.id);
    if (typeof selfRef !== "undefined") {
      users.push(selfRef);
    }
  }

  if (locationStore.lastLocation.location === L.tag && playersInInstance.size > 0) {
    const friendsInInstance = locationStore.lastLocation.friendList;
    for (const friend of friendsInInstance.values()) {
      const isAddable = !users.some((user) => friend.userId === user.id);
      if (isAddable) {
        const friendRef = cachedUsers.get(friend.userId);
        if (typeof friendRef !== "undefined") {
          users.push(friendRef);
        }
      }
    }
    friendCount = users.length - 1;
  }
  if (!L.isOffline) {
    for (const friend of friends.values()) {
      if (typeof friend.ref === "undefined") {
        continue;
      }
      if (friend.ref.location === locationStore.lastLocation.location) {
        continue;
      }
      if (friend.ref.$location.tag === L.tag) {
        if (friend.state !== "online" && friend.ref.location === "private") {
          continue;
        }

        const isAddable = !users.some((user) => friend.name === user.displayName);
        if (isAddable) {
          users.push(friend.ref);
        }
      }
    }
    friendCount = users.length;
  }
  if (appearanceSettingsStore.instanceUsersSortAlphabetical) {
    users.sort(compareByDisplayName);
  } else {
    users.sort(compareByLocationAt);
  }
  D.users = users;
  if ((L.worldId && currentLocation === L.tag && playersInInstance.size > 0) || !L.isRealInstance) {
    D.instance = {
      id: L.instanceId,
      tag: L.tag,
      $location: L,
      friendCount: 0,
      users: [],
      shortName: "",
      ref: {},
    };
  }
  const instanceRef = instanceStore.cachedInstances.get(L.tag) ?? {};
  Object.assign(D.instance.ref, instanceRef);
  D.instance.friendCount = friendCount;
}
