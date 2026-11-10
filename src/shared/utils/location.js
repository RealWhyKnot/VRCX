import { isRealInstance } from "./instance.js";

export { parseLocation, displayLocation, resolveRegion, translateAccessType } from "./locationParser.js";

function getFriendsLocations(friendsArr, lastLocation) {
  if (!friendsArr?.length) {
    return "";
  }
  for (const friend of friendsArr) {
    if (isRealInstance(friend.ref?.location)) {
      return friend.ref.location;
    }
  }
  for (const friend of friendsArr) {
    if (isRealInstance(friend.ref?.travelingToLocation)) {
      return friend.ref.travelingToLocation;
    }
  }
  if (lastLocation) {
    for (const friend of friendsArr) {
      if (lastLocation.friendList.has(friend.id)) {
        return lastLocation.location;
      }
    }
  }
  return friendsArr[0].ref?.location;
}

export { getFriendsLocations };

function getLocationText(L, { hint, worldName, accessTypeLabel, t }) {
  if (L.isOffline) {
    return t("location.offline");
  }
  if (L.isPrivate) {
    return t("location.private");
  }
  if (L.isTraveling) {
    return t("location.traveling");
  }
  if (typeof hint === "string" && hint !== "") {
    return L.instanceId ? `${hint} · ${accessTypeLabel}` : hint;
  }
  if (L.worldId) {
    const name = worldName || L.worldId;
    return L.instanceId ? `${name} · ${accessTypeLabel}` : name;
  }
  return "";
}

export { getLocationText };
