import { runUpdateCurrentUserLocationFlow } from "../coordinators/location-coordinator";
import { isRealInstance } from "../shared/utils/instance";
import { type CurrentUserPresence } from "./user-state";

export function applyPresenceLocation(user: { presence?: CurrentUserPresence | undefined; $locationTag?: string; $travelingToLocation?: string }) {
  const presence = user.presence;
  if (!presence) {
    return;
  }
  if (isRealInstance(presence.world)) {
    user.$locationTag = `${presence.world}:${presence.instance ?? ""}`;
  } else {
    user.$locationTag = presence.world ?? "";
  }
  if (isRealInstance(presence.travelingToWorld)) {
    user.$travelingToLocation = `${presence.travelingToWorld}:${presence.travelingToInstance ?? ""}`;
  } else {
    user.$travelingToLocation = presence.travelingToWorld ?? "";
  }
  runUpdateCurrentUserLocationFlow();
}
