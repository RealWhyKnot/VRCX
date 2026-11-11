import { parseLocation } from "./location-parser";

type InviteInstanceLike = { closedAt?: unknown };

type InviteDeps = {
  currentUserId?: string | null | undefined;
  lastLocationStr?: string | null | undefined;
  cachedInstances?: { get(key: string): InviteInstanceLike | undefined } | undefined;
};

type InviteSelfDeps = {
  currentUserId?: string | null | undefined;
  cachedInstances?: { get(key: string): InviteInstanceLike | undefined } | undefined;
  friends?: { has(key: string): boolean } | undefined;
};

function checkCanInvite(location: string | null | undefined, deps: InviteDeps): boolean {
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

function checkCanInviteSelf(location: string | null | undefined, deps: InviteSelfDeps): boolean {
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
  if (L.accessType === "friends" && !deps.friends?.has(L.userId ?? "")) {
    return false;
  }
  return true;
}

export { checkCanInvite, checkCanInviteSelf };
