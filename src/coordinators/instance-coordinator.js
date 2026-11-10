import { instanceRequest } from "../api";
import { parseLocation } from "../shared/utils/location-parser";

function refreshInstancePlayerCount(instance) {
  const L = parseLocation(instance);
  if (L.isRealInstance) {
    instanceRequest.getInstance({
      worldId: L.worldId,
      instanceId: L.instanceId,
    });
  }
}

export { refreshInstancePlayerCount };
