import { parseLocation } from "./location";

function checkCanInvite(location, deps) {
  if (!location) {
    return false;
  }
  const L = parseLocation(location);
  const instance = deps.cachedInstances?.get(location);
  if (instance?.closedAt) {
    return false;
  }
  if (L.accessType === "public" || L.accessType === "group" || L.userId === deps.currentUserId) {
    return true;
  }
  if (L.accessType === "invite" || L.accessType === "friends") {
    return false;
  }
  if (deps.lastLocationStr === location) {
    return true;
  }
  return false;
}

function checkCanInviteSelf(location, deps) {
  if (!location) {
    return false;
  }
  const L = parseLocation(location);
  const instance = deps.cachedInstances?.get(location);
  if (instance?.closedAt) {
    return false;
  }
  if (L.userId === deps.currentUserId) {
    return true;
  }
  if (L.accessType === "friends" && !deps.friends?.has(L.userId)) {
    return false;
  }
  return true;
}

export { checkCanInvite, checkCanInviteSelf };
