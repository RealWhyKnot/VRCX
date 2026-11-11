import { instanceRequest } from "../api/instance";
import { parseLocation } from "../shared/utils/location-parser";

function refreshInstancePlayerCount(instance: string) {
  const L = parseLocation(instance);
  if (L.isRealInstance) {
    void instanceRequest
      .getInstance({
        worldId: L.worldId,
        instanceId: L.instanceId,
      })
      .catch((err: unknown) => {
        console.error(err);
      });
  }
}

export { refreshInstancePlayerCount };
