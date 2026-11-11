import { parseLocation } from "./location-parser";
import { queryRequest } from "../../api/query-request";
import { rpcWorlds } from "../constants/world";

async function getWorldName(location: string | null | undefined): Promise<string> {
  let worldName = "";

  const L = parseLocation(location);
  if (L.isRealInstance && L.worldId) {
    try {
      const args = await queryRequest.fetch("world.dialog", {
        worldId: L.worldId,
      });
      worldName = args.ref.name;
    } catch (error) {
      console.error("getWorldName failed location", location, error);
    }
  }

  return worldName;
}

function isRpcWorld(location: string | null | undefined): boolean {
  const L = parseLocation(location);
  return rpcWorlds.includes(L.worldId);
}

export { getWorldName, isRpcWorld };
