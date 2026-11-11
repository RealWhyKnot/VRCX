import type { GroupDialogView, GroupInstanceInput, InstanceRoom, RoomLocation, WorldDialogView } from "./instance-types";
import { compareByDisplayName, compareById, compareByLocationAt } from "../shared/utils/compare";
import { debounce } from "../shared/utils/common";
import { parseLocation } from "../shared/utils/location-parser";
import { isRealInstance } from "../shared/utils/instance";
import { instanceRequest } from "../api/instance";
import { userRequest } from "../api/user";
import { isSlimInstance } from "./instance-type-guards";
import { newEmptyRoom, userCountOf } from "./instance-room-records";
import type { useLocationStore } from "./location";
import type { useWorldStore } from "./world";
import type { useAppearanceSettingsStore } from "./settings/appearance";
import type { useGroupStore } from "./group";
import type { useUserStore } from "./user";
import type { InstanceEntry } from "./instance-types";
import type { VrcxUser } from "../types/vrcx";

export type CreateInstanceDialogApplyDeps = {
  locationStore: ReturnType<typeof useLocationStore>;
  worldStore: ReturnType<typeof useWorldStore>;
  appearanceSettingsStore: ReturnType<typeof useAppearanceSettingsStore>;
  groupStore: ReturnType<typeof useGroupStore>;
  userStore: ReturnType<typeof useUserStore>;
  cachedInstances: Map<string, InstanceEntry>;
  cachedUserOf: (id: string) => VrcxUser | undefined;
  friendRefs: () => (VrcxUser | undefined)[];
};

export function createInstanceDialogApply(deps: CreateInstanceDialogApplyDeps) {
  const { locationStore, worldStore, appearanceSettingsStore, groupStore, userStore, cachedInstances, cachedUserOf, friendRefs } = deps;

  function applyWorldDialogInstances() {
    debounce(applyWorldDialogInstancesDebounced, 100)();
  }

  function applyWorldDialogInstancesDebounced() {
    const D: WorldDialogView = worldStore.worldDialog;
    if (!D.visible) {
      return;
    }
    const instances = new Map<string, InstanceRoom>();
    if (D.ref.slimInstances) {
      for (const instance of D.ref.slimInstances) {
        if (!isSlimInstance(instance)) {
          continue;
        }
        const { instanceId } = instance;
        instances.set(instanceId, {
          id: instanceId,
          tag: `${D.id}:${instanceId}`,
          $location: {},
          friendCount: 0,
          users: [],
          shortName: "",
          ref: {
            userCount: instance.n_users,
            capacity: D.ref.capacity,
          },
        });
      }
    }
    const instanceId = D.$location.instanceId;
    const shortName = D.$location.shortName ?? "";
    if (instanceId && typeof instances.get(instanceId) === "undefined") {
      instances.set(instanceId, newEmptyRoom(instanceId, `${D.id}:${instanceId}`, shortName, {}));
    }
    const cachedCurrentUser = cachedUserOf(userStore.currentUser.id);
    const lastLocation$ = cachedCurrentUser?.$location;
    const playersInInstance = locationStore.lastLocation.playerList;
    if (lastLocation$?.worldId === D.id && playersInInstance.size > 0) {
      const friendsInInstance = locationStore.lastLocation.friendList;
      const instance = newEmptyRoom(lastLocation$.instanceId ?? "", lastLocation$.tag ?? "", "", {});
      instance.friendCount = friendsInInstance.size;
      instances.set(instance.id, instance);
      for (const friend of friendsInInstance.values()) {
        const isMissingUser = !instance.users.some(function (user) {
          return friend.userId === user.id;
        });
        if (isMissingUser) {
          const ref = cachedUserOf(friend.userId);
          if (typeof ref !== "undefined") {
            instance.users.push(ref);
          }
        }
      }
    }
    for (const ref of friendRefs()) {
      if (
        ref?.$location.worldId !== D.id ||
        (ref.$location.instanceId === lastLocation$?.instanceId && playersInInstance.size > 0 && ref.location !== "traveling")
      ) {
        continue;
      }
      if (ref.location === locationStore.lastLocation.location) {
        continue;
      }
      const friendInstanceId = ref.$location.instanceId ?? "";
      let instance = instances.get(friendInstanceId);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(friendInstanceId, `${D.id}:${friendInstanceId}`, "", {});
        instances.set(friendInstanceId, instance);
      }
      instance.users.push(ref);
    }
    const currentRef = cachedUserOf(userStore.currentUser.id);
    if (currentRef?.$location.worldId === D.id) {
      const currentInstanceId = currentRef.$location.instanceId ?? "";
      let instance = instances.get(currentInstanceId);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(currentInstanceId, `${D.id}:${currentInstanceId}`, "", {});
        instances.set(currentInstanceId, instance);
      }
      instance.users.push(currentRef);
    }
    const rooms: InstanceRoom[] = [];
    for (const instance of instances.values()) {
      const L: RoomLocation = { ...parseLocation(`${D.id}:${instance.id}`), user: {} };
      instance.location = L.tag;
      if (!L.shortName) {
        L.shortName = instance.shortName;
      }
      instance.$location = L;
      const cachedOwnerId = cachedInstances.get(L.tag)?.ownerId;
      if (!L.userId && cachedOwnerId && !cachedOwnerId.startsWith("grp_")) {
        L.userId = cachedOwnerId;
      }
      if (L.userId) {
        const ref = cachedUserOf(L.userId);
        if (typeof ref === "undefined") {
          void userRequest
            .getUser({
              userId: L.userId,
            })
            .then((args) => {
              if (args.ref.id === L.userId) {
                Object.assign(L.user, args.ref);
                instance.$location = L;
                applyWorldDialogInstances();
              }
            })
            .catch((error: unknown) => {
              console.error("Error fetching user for instance:", error);
            });
        } else {
          L.user = ref;
        }
      }
      if (instance.friendCount === 0) {
        instance.friendCount = instance.users.length;
      }
      if (appearanceSettingsStore.instanceUsersSortAlphabetical) {
        instance.users.sort(compareByDisplayName);
      } else {
        instance.users.sort(compareByLocationAt);
      }
      rooms.push(instance);
    }

    for (const room of rooms) {
      const ref = cachedInstances.get(room.tag);
      if (typeof ref !== "undefined") {
        Object.assign(room.ref, ref);
      }
    }
    rooms.sort(function (a, b) {
      if (b.location === D.$location.tag || b.location === lastLocation$?.tag) {
        if (a.location === D.$location.tag) {
          return -1;
        }
        return 1;
      }
      if (a.location === D.$location.tag || a.location === lastLocation$?.tag) {
        if (b.location === D.$location.tag) {
          return 1;
        }
        return -1;
      }

      if (a.users.length === 0 && b.users.length === 0 && a.ref.userCount !== b.ref.userCount) {
        if (userCountOf(a) < userCountOf(b)) {
          return 1;
        }
        return -1;
      }

      if (a.users.length !== b.users.length) {
        if (a.users.length < b.users.length) {
          return 1;
        }
        return -1;
      }

      return compareById(a, b);
    });
    D.rooms = rooms;
  }

  function applyGroupDialogInstances(inputInstances?: GroupInstanceInput[]) {
    const D: GroupDialogView = groupStore.groupDialog;
    if (!D.visible) {
      return;
    }
    const instances = new Map<string, InstanceRoom>();
    for (const instance of D.instances) {
      instances.set(instance.tag, {
        ...instance,
        friendCount: 0,
        users: [],
      });
    }
    if (typeof inputInstances !== "undefined") {
      for (const instance of inputInstances) {
        instances.set(instance.location, {
          id: instance.instanceId,
          tag: instance.location,
          $location: {},
          friendCount: 0,
          users: [],
          shortName: instance.shortName ?? "",
          ref: instance,
        });
      }
    }
    const cachedCurrentUser = cachedUserOf(userStore.currentUser.id);
    const lastLocation$ = cachedCurrentUser?.$location;
    const currentLocation = lastLocation$?.tag;
    const playersInInstance = locationStore.lastLocation.playerList;
    if (lastLocation$?.groupId === D.id && playersInInstance.size > 0) {
      const friendsInInstance = locationStore.lastLocation.friendList;
      const instance = newEmptyRoom(lastLocation$.instanceId ?? "", currentLocation ?? "", "", {});
      instance.friendCount = friendsInInstance.size;
      instances.set(currentLocation ?? "", instance);
      for (const friend of friendsInInstance.values()) {
        const isMissingUser = !instance.users.some(function (user) {
          return friend.userId === user.id;
        });
        if (isMissingUser) {
          const ref = cachedUserOf(friend.userId);
          if (typeof ref !== "undefined") {
            instance.users.push(ref);
          }
        }
      }
    }
    for (const ref of friendRefs()) {
      if (
        ref?.$location.groupId !== D.id ||
        (ref.$location.instanceId === lastLocation$?.instanceId && playersInInstance.size > 0 && ref.location !== "traveling")
      ) {
        continue;
      }
      if (ref.location === locationStore.lastLocation.location) {
        continue;
      }
      const tag = ref.$location.tag ?? "";
      let instance = instances.get(tag);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(ref.$location.instanceId ?? "", tag, "", {});
        instances.set(tag, instance);
      }
      instance.users.push(ref);
    }
    const currentRef = cachedUserOf(userStore.currentUser.id);
    if (currentRef?.$location.groupId === D.id) {
      const tag = currentRef.$location.tag ?? "";
      let instance = instances.get(tag);
      if (typeof instance === "undefined") {
        instance = newEmptyRoom(currentRef.$location.instanceId ?? "", tag, "", {});
        instances.set(tag, instance);
      }
      instance.users.push(currentRef);
    }
    const rooms: InstanceRoom[] = [];
    for (const instance of instances.values()) {
      const L = parseLocation(instance.tag);
      instance.location = instance.tag;
      instance.$location = L;
      if (instance.friendCount === 0) {
        instance.friendCount = instance.users.length;
      }
      if (appearanceSettingsStore.instanceUsersSortAlphabetical) {
        instance.users.sort(compareByDisplayName);
      } else {
        instance.users.sort(compareByLocationAt);
      }
      rooms.push(instance);
    }

    for (const room of rooms) {
      const ref = cachedInstances.get(room.tag);
      if (typeof ref !== "undefined") {
        Object.assign(room.ref, ref);
      } else if (isRealInstance(room.tag)) {
        void instanceRequest
          .getInstance({
            worldId: room.$location.worldId ?? "",
            instanceId: room.$location.instanceId ?? "",
          })
          .catch((error: unknown) => {
            console.error("Error fetching instance for room:", error);
          });
      }
    }
    rooms.sort(function (a, b) {
      if (b.location === currentLocation) {
        return 1;
      }
      if (a.location === currentLocation) {
        return -1;
      }

      if (a.users.length === 0 && b.users.length === 0) {
        if (userCountOf(a) < userCountOf(b)) {
          return 1;
        }
        return -1;
      }

      if (a.users.length < b.users.length) {
        return 1;
      }
      return -1;
    });
    D.instances = rooms;
  }

  return {
    applyWorldDialogInstances,
    applyGroupDialogInstances,
  };
}
