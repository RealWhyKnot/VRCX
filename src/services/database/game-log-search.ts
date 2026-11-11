import { toGameLogRow } from "./game-log-union.ts";
import { dbVars } from "./index.ts";

import { sqliteService } from "../sqlite.ts";

async function getGameLogByLocation(instanceId: string, filters: string[], vipList: string[] = []) {
  const rows = await sqliteService.rows(DatabaseApi.GetGameLogByLocation(instanceId, filters, vipList, dbVars.userId, dbVars.searchTableSize));
  return rows.map(toGameLogRow);
}

async function lookupGameLogDatabase(filters: string[], vipList: string[], maxEntries = dbVars.maxTableSize) {
  const rows = await sqliteService.rows(DatabaseApi.LookupGameLog(filters, vipList, maxEntries));
  return rows.map(toGameLogRow);
}

async function searchGameLogDatabase(search: string, filters: string[], vipList: string[], maxEntries = dbVars.searchTableSize) {
  if (search.startsWith("wrld_") || search.startsWith("grp_")) {
    return getGameLogByLocation(search, filters, vipList);
  }
  const rows = await sqliteService.rows(DatabaseApi.SearchGameLog(search, filters, vipList, dbVars.userId, maxEntries));
  return rows.map(toGameLogRow);
}

export { getGameLogByLocation, lookupGameLogDatabase, searchGameLogDatabase };
