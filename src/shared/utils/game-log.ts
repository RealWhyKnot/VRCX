type GameLogRow = {
  type?: unknown;
  location?: unknown;
  worldName?: unknown;
  displayName?: unknown;
  data?: unknown;
  message?: unknown;
  videoName?: unknown;
  videoUrl?: unknown;
  resourceUrl?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  dt?: unknown;
  rowId?: unknown;
  uid?: unknown;
};

function gameLogSearchFilter(row: GameLogRow, searchQuery: string) {
  const value = searchQuery.trim().toUpperCase();
  if (!value) {
    return true;
  }
  if ((value.startsWith("WRLD_") || value.startsWith("GRP_")) && String(row.location).toUpperCase().includes(value)) {
    return true;
  }
  switch (row.type) {
    case "Location":
      if (String(row.worldName).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "OnPlayerJoined":
      if (String(row.displayName).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "OnPlayerLeft":
      if (String(row.displayName).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "PortalSpawn":
      if (String(row.displayName).toUpperCase().includes(value)) {
        return true;
      }
      if (String(row.worldName).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "Event":
      if (String(row.data).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "External":
      if (String(row.message).toUpperCase().includes(value)) {
        return true;
      }
      if (String(row.displayName).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "VideoPlay":
      if (String(row.displayName).toUpperCase().includes(value)) {
        return true;
      }
      if (String(row.videoName).toUpperCase().includes(value)) {
        return true;
      }
      if (String(row.videoUrl).toUpperCase().includes(value)) {
        return true;
      }
      return false;
    case "StringLoad":
    case "ImageLoad":
      if (String(row.resourceUrl).toUpperCase().includes(value)) {
        return true;
      }
      return false;
  }
  return true;
}

function getGameLogCreatedAtTs(row: GameLogRow | undefined) {
  const createdAtRaw = row?.created_at ?? row?.createdAt ?? row?.dt;
  if (typeof createdAtRaw === "number") {
    const ts = createdAtRaw > 1_000_000_000_000 ? createdAtRaw : createdAtRaw * 1000;
    return Number.isFinite(ts) ? ts : 0;
  }

  const createdAt = typeof createdAtRaw === "string" ? createdAtRaw : "";

  const ts = Date.parse(createdAt);
  return Number.isFinite(ts) ? ts : 0;
}

function compareGameLogRows(a: GameLogRow | undefined, b: GameLogRow | undefined) {
  const aTs = getGameLogCreatedAtTs(a);
  const bTs = getGameLogCreatedAtTs(b);
  if (aTs !== bTs) {
    return bTs - aTs;
  }

  const aRowId = typeof a?.rowId === "number" ? a.rowId : 0;
  const bRowId = typeof b?.rowId === "number" ? b.rowId : 0;
  if (aRowId !== bRowId) {
    return bRowId - aRowId;
  }

  const aUid = typeof a?.uid === "string" ? a.uid : "";
  const bUid = typeof b?.uid === "string" ? b.uid : "";
  return aUid < bUid ? 1 : aUid > bUid ? -1 : 0;
}

export { gameLogSearchFilter, getGameLogCreatedAtTs, compareGameLogRows };

export function createLocationEntry(dt: string, location: string, worldId: string, worldName: string) {
  return {
    created_at: dt,
    type: "Location",
    location,
    worldId,
    worldName,
    groupName: "",
    time: 0,
  };
}

export function createJoinLeaveEntry(type: "OnPlayerJoined" | "OnPlayerLeft", dt: string, displayName: string, location: string, userId: string, time = 0) {
  return {
    created_at: dt,
    type,
    displayName,
    location,
    userId,
    time,
  };
}

export function createPortalSpawnEntry(dt: string, location: string) {
  return {
    created_at: dt,
    type: "PortalSpawn",
    location,
    displayName: "",
    userId: "",
    instanceId: "",
    worldName: "",
  };
}

export function createResourceLoadEntry(rawType: string, dt: string, resourceUrl: string, location: string) {
  return {
    created_at: dt,
    type: rawType === "resource-load-string" ? "StringLoad" : "ImageLoad",
    resourceUrl,
    location,
  };
}

export function parseInventoryFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/1/user/") && parsed.pathname.includes("/inventory/inv_")) {
      const pathArray = parsed.pathname.split("/");
      const userId = pathArray[4];
      const inventoryId = pathArray[6];
      if (userId && inventoryId?.length === 40) {
        return { userId, inventoryId };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function parsePrintFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/1/prints/")) {
      const pathArray = parsed.pathname.split("/");
      const printId = pathArray[4];
      if (printId?.length === 41) {
        return printId;
      }
    }
  } catch {
    return null;
  }
  return null;
}
