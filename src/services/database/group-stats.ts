import { cellNumber, cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";
import type { GroupNotificationStats, GroupVisitStats } from "../../shared/utils/group-overview.ts";

async function getGroupVisitStats(): Promise<Map<string, GroupVisitStats>> {
  const rows = await sqliteService.rows(DatabaseApi.GetGroupVisitStats());
  const stats = new Map<string, GroupVisitStats>();
  for (const row of rows) {
    const groupId = cellText(row[0]);
    if (groupId) {
      stats.set(groupId, { visitCount: cellNumber(row[1]) ?? 0, lastVisitAt: cellText(row[2]) ?? "", timeSpent: cellNumber(row[3]) ?? 0 });
    }
  }
  return stats;
}

async function getGroupNotificationStats(): Promise<Map<string, GroupNotificationStats>> {
  const rows = await sqliteService.rows(DatabaseApi.GetGroupNotificationStats());
  const stats = new Map<string, GroupNotificationStats>();
  for (const row of rows) {
    const groupId = cellText(row[0]);
    if (groupId) {
      stats.set(groupId, { notificationCount: cellNumber(row[1]) ?? 0, lastNotificationAt: cellText(row[2]) ?? "" });
    }
  }
  return stats;
}

const groupStats = {
  getGroupVisitStats,
  getGroupNotificationStats,
};

export { groupStats };
