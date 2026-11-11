import { dbVars } from "../database";

import { cellNumber, cellText } from "./cells.ts";
import { parseBioLinks } from "./user-profile.ts";
import { sqliteService, type DatabaseRow } from "../sqlite.ts";

type FeedGpsEntry = {
  created_at: string;
  userId: string;
  displayName: string;
  location: string | null;
  worldName: string | null;
  previousLocation: string | null;
  time: number | null;
  groupName: string | null;
};

type FeedStatusEntry = {
  created_at: string;
  userId: string;
  displayName: string;
  status: string | null;
  statusDescription: string | null;
  previousStatus: string | null;
  previousStatusDescription: string | null;
};

type FeedBioEntry = {
  created_at: string;
  userId: string;
  displayName: string;
  bio: string | null;
  previousBio: string | null;
  bioLinks?: unknown[] | null;
  previousBioLinks?: unknown[] | null;
};

type FeedAvatarEntry = {
  created_at: string;
  userId: string;
  displayName: string;
  ownerId: string | null;
  avatarName: string | null;
  currentAvatarImageUrl: string | null;
  currentAvatarThumbnailImageUrl: string | null;
  previousCurrentAvatarImageUrl: string | null;
  previousCurrentAvatarThumbnailImageUrl: string | null;
};

type FeedOnlineOfflineEntry = {
  created_at: string;
  userId: string;
  displayName: string;
  type: "Online" | "Offline";
  location: string | null;
  worldName: string | null;
  time: number | null;
  groupName: string | null;
};

type FeedRowBase = {
  rowId: number | null;
  created_at: string | null;
  userId: string | null;
  displayName: string | null;
};

type FeedGpsRow = FeedRowBase & {
  type: "GPS";
  location: string | null;
  worldName: string | null;
  previousLocation: string | null;
  time: number | null;
  groupName: string | null;
};

type FeedStatusRow = FeedRowBase & {
  type: "Status";
  status: string | null;
  statusDescription: string | null;
  previousStatus: string | null;
  previousStatusDescription: string | null;
};

type FeedBioRow = FeedRowBase & {
  type: "Bio";
  bio: string | null;
  previousBio: string | null;
  bioLinks: unknown[];
  previousBioLinks: unknown[];
};

type FeedAvatarRow = FeedRowBase & {
  type: "Avatar";
  ownerId: string | null;
  avatarName: string | null;
  currentAvatarImageUrl: string | null;
  currentAvatarThumbnailImageUrl: string | null;
  previousCurrentAvatarImageUrl: string | null;
  previousCurrentAvatarThumbnailImageUrl: string | null;
};

type FeedOnlineOfflineRow = FeedRowBase & {
  type: "Online" | "Offline";
  location: string | null;
  worldName: string | null;
  time: number | null;
  groupName: string | null;
};

type FeedRow = FeedGpsRow | FeedStatusRow | FeedBioRow | FeedAvatarRow | FeedOnlineOfflineRow;

type HotWorld = {
  worldId: string | null;
  worldName: string | null;
  visitCount: number | null;
  uniqueFriends: number | null;
  lastVisited: string | null;
  trend: "rising" | "cooling" | "stable";
};

type HotWorldFriend = {
  userId: string | null;
  displayName: string | null;
  visitCount: number | null;
  lastVisit: string | null;
};

function mapFeedRow(dbRow: DatabaseRow): FeedRow {
  const base = {
    rowId: cellNumber(dbRow[0]),
    created_at: cellText(dbRow[1]),
    userId: cellText(dbRow[2]),
    displayName: cellText(dbRow[3]),
  };
  const type = cellText(dbRow[4]);
  switch (type) {
    case "GPS":
      return {
        ...base,
        type,
        location: cellText(dbRow[5]),
        worldName: cellText(dbRow[6]),
        previousLocation: cellText(dbRow[7]),
        time: cellNumber(dbRow[8]),
        groupName: cellText(dbRow[9]),
      };
    case "Status":
      return {
        ...base,
        type,
        status: cellText(dbRow[10]),
        statusDescription: cellText(dbRow[11]),
        previousStatus: cellText(dbRow[12]),
        previousStatusDescription: cellText(dbRow[13]),
      };
    case "Bio":
      return {
        ...base,
        type,
        bio: cellText(dbRow[14]),
        previousBio: cellText(dbRow[15]),
        bioLinks: parseBioLinks(cellText(dbRow[22]) ?? ""),
        previousBioLinks: parseBioLinks(cellText(dbRow[23]) ?? ""),
      };
    case "Avatar":
      return {
        ...base,
        type,
        ownerId: cellText(dbRow[16]),
        avatarName: cellText(dbRow[17]),
        currentAvatarImageUrl: cellText(dbRow[18]),
        currentAvatarThumbnailImageUrl: cellText(dbRow[19]),
        previousCurrentAvatarImageUrl: cellText(dbRow[20]),
        previousCurrentAvatarThumbnailImageUrl: cellText(dbRow[21]),
      };
    case "Online":
    case "Offline":
      return {
        ...base,
        type,
        location: cellText(dbRow[5]),
        worldName: cellText(dbRow[6]),
        time: cellNumber(dbRow[8]),
        groupName: cellText(dbRow[9]),
      };
    case null:
    default:
      throw new Error("The feed returned a row with an unknown type");
  }
}

async function persistFeedEntry<T extends object>(insert: Promise<number>, entry: T): Promise<(T & { rowId: number }) | undefined> {
  const rowId = await sqliteService.run(insert);
  return rowId ? { ...entry, rowId } : undefined;
}

async function addGPSToDatabase(entry: FeedGpsEntry) {
  return persistFeedEntry(
    DatabaseApi.AddFeedGps(
      entry.created_at,
      entry.userId,
      entry.displayName,
      entry.location,
      entry.worldName,
      entry.previousLocation,
      entry.time,
      entry.groupName
    ),
    entry
  );
}

async function addStatusToDatabase(entry: FeedStatusEntry) {
  return persistFeedEntry(
    DatabaseApi.AddFeedStatus(
      entry.created_at,
      entry.userId,
      entry.displayName,
      entry.status,
      entry.statusDescription,
      entry.previousStatus,
      entry.previousStatusDescription
    ),
    entry
  );
}

async function addBioToDatabase(entry: FeedBioEntry) {
  return persistFeedEntry(
    DatabaseApi.AddFeedBio(
      entry.created_at,
      entry.userId,
      entry.displayName,
      entry.bio,
      entry.previousBio,
      JSON.stringify(entry.bioLinks ?? []),
      JSON.stringify(entry.previousBioLinks ?? [])
    ),
    entry
  );
}

async function addAvatarToDatabase(entry: FeedAvatarEntry) {
  return persistFeedEntry(
    DatabaseApi.AddFeedAvatar(
      entry.created_at,
      entry.userId,
      entry.displayName,
      entry.ownerId,
      entry.avatarName,
      entry.currentAvatarImageUrl,
      entry.currentAvatarThumbnailImageUrl,
      entry.previousCurrentAvatarImageUrl,
      entry.previousCurrentAvatarThumbnailImageUrl
    ),
    entry
  );
}

async function purgeAvatarFeedData(cutoffDate: string | null) {
  if (cutoffDate) {
    await sqliteService.run(DatabaseApi.DeleteAvatarFeedOlderThan(cutoffDate));
  } else {
    await sqliteService.run(DatabaseApi.DeleteAllAvatarFeed());
  }
}

async function addOnlineOfflineToDatabase(entry: FeedOnlineOfflineEntry) {
  return persistFeedEntry(
    DatabaseApi.AddFeedOnlineOffline(
      entry.created_at,
      entry.userId,
      entry.displayName,
      entry.type,
      entry.location,
      entry.worldName,
      entry.time,
      entry.groupName
    ),
    entry
  );
}

async function searchFeedDatabase(
  search: string,
  filters: string[],
  vipList: string[],
  maxEntries = dbVars.searchTableSize,
  dateFrom = "",
  dateTo = ""
): Promise<FeedRow[]> {
  if (search.startsWith("wrld_") || search.startsWith("grp_")) {
    return getFeedByInstanceId(search, filters, vipList);
  }
  const rows = await sqliteService.rows(DatabaseApi.SearchFeed(search, filters, vipList, maxEntries, dateFrom, dateTo));
  return rows.map(mapFeedRow);
}

async function lookupFeedDatabase(filters: string[], vipList: string[], maxEntries = dbVars.maxTableSize): Promise<FeedRow[]> {
  const rows = await sqliteService.rows(DatabaseApi.LookupFeed(filters, vipList, maxEntries));
  return rows.map(mapFeedRow);
}

async function getFeedByInstanceId(instanceId: string, filters: string[], vipList: string[]): Promise<FeedRow[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetFeedByInstanceId(instanceId, filters, vipList, dbVars.searchTableSize));
  return rows.map(mapFeedRow);
}

async function getHotWorlds(days = 30, limit = 30): Promise<HotWorld[]> {
  const worldRows = await sqliteService.rows(DatabaseApi.GetHotWorlds(days, limit));
  const baselineRows = await sqliteService.rows(DatabaseApi.GetHotWorldTrendBaseline(days));
  const recentRows = await sqliteService.rows(DatabaseApi.GetHotWorldTrendRecent(days));

  const baselineFriends = new Map<string | null, number | null>();
  for (const row of baselineRows) {
    baselineFriends.set(cellText(row[0]), cellNumber(row[1]));
  }
  const recentFriends = new Map<string | null, number | null>();
  for (const row of recentRows) {
    recentFriends.set(cellText(row[0]), cellNumber(row[1]));
  }

  return worldRows.map((row) => {
    const worldId = cellText(row[0]);
    const oldFriends = baselineFriends.get(worldId) ?? 0;
    const newFriends = recentFriends.get(worldId) ?? 0;
    let trend: HotWorld["trend"] = "stable";
    if (newFriends > oldFriends) {
      trend = "rising";
    } else if (newFriends < oldFriends) {
      trend = "cooling";
    }
    return {
      worldId,
      worldName: cellText(row[1]),
      visitCount: cellNumber(row[2]),
      uniqueFriends: cellNumber(row[3]),
      lastVisited: cellText(row[4]),
      trend,
    };
  });
}

async function getHotWorldFriendDetail(worldId: string, days = 30): Promise<HotWorldFriend[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetHotWorldFriendDetail(worldId, days));
  return rows.map((row) => ({
    userId: cellText(row[0]),
    displayName: cellText(row[1]),
    visitCount: cellNumber(row[2]),
    lastVisit: cellText(row[3]),
  }));
}

const feed = {
  addGPSToDatabase,
  addStatusToDatabase,
  addBioToDatabase,
  addAvatarToDatabase,
  purgeAvatarFeedData,
  addOnlineOfflineToDatabase,
  searchFeedDatabase,
  lookupFeedDatabase,
  getFeedByInstanceId,
  getHotWorlds,
  getHotWorldFriendDetail,
};

export { feed };
export type { FeedRow, HotWorld, HotWorldFriend };
