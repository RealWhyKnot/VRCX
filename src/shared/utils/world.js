import { parseLocation } from "./location-parser";
import queryRequest from "../../api/query-request";
import { rpcWorlds } from "../constants/world";

async function getWorldName(location) {
  let worldName = "";

  const L = parseLocation(location);
  if (L.isRealInstance && L.worldId) {
    try {
      const args = await queryRequest.fetch("world.dialog", {
        worldId: L.worldId,
      });
      worldName = args.ref.name;
    } catch (e) {
      console.error("getWorldName failed location", location, e);
    }
  }

  return worldName;
}

function isRpcWorld(location) {
  const L = parseLocation(location);
  if (rpcWorlds.includes(L.worldId)) {
    return true;
  }
  return false;
}

export { getWorldName, isRpcWorld };
