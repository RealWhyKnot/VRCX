import { isRealInstance } from "./instance.ts";

type FriendLocationEntry = {
  id: string;
  ref?:
    | {
        location?: string | undefined;
        travelingToLocation?: string | undefined;
      }
    | undefined;
};

type LastLocationSnapshot = {
  friendList: Pick<ReadonlySet<string>, "has">;
  location: string;
};

type LocationTextFlags = {
  isOffline: boolean;
  isPrivate: boolean;
  isTraveling: boolean;
  worldId: string;
  instanceId: string;
};

type LocationTextOptions = {
  hint?: string | null;
  worldName?: string | null | undefined;
  accessTypeLabel: string;
  t: (key: string) => string;
};

function getFriendsLocations(friendsArr: FriendLocationEntry[] | null | undefined, lastLocation?: LastLocationSnapshot | null): string | undefined {
  if (!friendsArr?.length) {
    return "";
  }
  for (const friend of friendsArr) {
    const location = friend.ref?.location;
    if (isRealInstance(location)) {
      return location;
    }
  }
  for (const friend of friendsArr) {
    const travelingToLocation = friend.ref?.travelingToLocation;
    if (isRealInstance(travelingToLocation)) {
      return travelingToLocation;
    }
  }
  if (lastLocation) {
    for (const friend of friendsArr) {
      if (lastLocation.friendList.has(friend.id)) {
        return lastLocation.location;
      }
    }
  }
  return friendsArr[0]?.ref?.location;
}

export { getFriendsLocations };

function getLocationText(flags: LocationTextFlags, { hint, worldName, accessTypeLabel, t }: LocationTextOptions): string {
  if (flags.isOffline) {
    return t("location.offline");
  }
  if (flags.isPrivate) {
    return t("location.private");
  }
  if (flags.isTraveling) {
    return t("location.traveling");
  }
  if (typeof hint === "string" && hint !== "") {
    return flags.instanceId ? `${hint} · ${accessTypeLabel}` : hint;
  }
  if (flags.worldId) {
    const name = worldName ?? "";
    const displayName = name !== "" ? name : flags.worldId;
    return flags.instanceId ? `${displayName} · ${accessTypeLabel}` : displayName;
  }
  return "";
}

export { getLocationText };
