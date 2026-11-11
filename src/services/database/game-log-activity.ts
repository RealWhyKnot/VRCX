import { cellNumber, cellText } from "./cells.ts";
import { dbVars } from "./index.ts";

import { sqliteService } from "../sqlite.ts";

type InstanceActivityRow = {
  id: number | null;
  created_at: string | null;
  type: string | null;
  display_name: string | null;
  location: string;
  user_id: string | null;
  time: number | null;
};

const ONE_WEEK_MS = 604800000;

async function getInstanceActivity(startDate: string, endDate: string) {
  const rows = await sqliteService.rows(DatabaseApi.GetInstanceActivityRows(startDate, endDate));
  const currentUserData: InstanceActivityRow[] = [];
  const detailData = new Map<string, InstanceActivityRow[]>();
  for (const row of rows) {
    const location = cellText(row[4]);
    if (!location || location === "traveling") {
      continue;
    }
    const rowData: InstanceActivityRow = {
      id: cellNumber(row[0]),
      created_at: cellText(row[1]),
      type: cellText(row[2]),
      display_name: cellText(row[3]),
      location,
      user_id: cellText(row[5]),
      time: cellNumber(row[6]),
    };
    if (rowData.user_id === dbVars.userId) {
      currentUserData.push(rowData);
    }
    const instanceData = detailData.get(location);
    if (instanceData === undefined) {
      detailData.set(location, [rowData]);
    } else {
      instanceData.push(rowData);
    }
  }
  return { currentUserData, detailData };
}

async function getDateOfInstanceActivity() {
  const rows = await sqliteService.rows(DatabaseApi.GetJoinLeaveDatesByUserId(dbVars.userId));
  return rows.map((row) => cellText(row[0]));
}

async function getInstanceJoinHistory() {
  const oneWeekAgo = new Date(Date.now() - ONE_WEEK_MS).toJSON();
  const rows = await sqliteService.rows(DatabaseApi.GetRecentInstanceJoinsByUserId(dbVars.userId, oneWeekAgo));
  const instances = new Map<string, number>();
  for (const row of rows) {
    const location = cellText(row[1]);
    if (location !== null && !instances.has(location)) {
      instances.set(location, new Date(cellText(row[0]) ?? 0).getTime());
    }
  }
  return instances;
}

export { getDateOfInstanceActivity, getInstanceActivity, getInstanceJoinHistory };
