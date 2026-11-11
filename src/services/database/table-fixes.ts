import { cellNumber, cellText } from "./cells.ts";
import { gameLog } from "./game-log.ts";

import { sqliteService } from "../sqlite.ts";
import type { DatabaseRow } from "../sqlite.ts";

type TravelingLeave = {
  rowId: number;
  created_at: string | null;
  displayName: string | null;
};

type BrokenDisplayName = {
  id: number;
  displayName: string;
  createdAt: string | null;
  type: string | null;
};

function toTravelingLeave(row: DatabaseRow): TravelingLeave | null {
  const rowId = cellNumber(row[0]);
  if (rowId === null) {
    return null;
  }
  return { rowId, created_at: cellText(row[1]), displayName: cellText(row[3]) };
}

function toBrokenDisplayName(row: DatabaseRow): BrokenDisplayName | null {
  const id = cellNumber(row[0]);
  const displayName = cellText(row[1]);
  if (id === null || displayName === null) {
    return null;
  }
  return { id, displayName, createdAt: cellText(row[2]), type: cellText(row[3]) };
}

const tableFixes = {
  async cleanLegendFromFriendLog() {
    await sqliteService.run(DatabaseApi.CleanLegendFromFriendLog());
  },

  async fixGameLogTraveling() {
    const travelingRows = await sqliteService.rows(DatabaseApi.GetTravelingLeaveRows());
    const travelingList = travelingRows.flatMap((row) => toTravelingLeave(row) ?? []).reverse();
    for (const travelingEntry of travelingList) {
      const joinRows = await sqliteService.rows(DatabaseApi.GetLastOnPlayerJoinRows(travelingEntry.displayName, travelingEntry.created_at));
      const [joinRow] = joinRows;
      if (joinRow !== undefined) {
        await sqliteService.run(DatabaseApi.SetJoinLeaveLocation(travelingEntry.rowId, cellText(joinRow[4])));
      }
    }
  },

  async fixNegativeGPS() {
    await sqliteService.run(DatabaseApi.FixNegativeGpsTimes());
  },

  async getBrokenLeaveEntries(): Promise<number[]> {
    const instances: Map<unknown, unknown> = await gameLog.getGameLogInstancesTime();
    const rows = await sqliteService.rows(DatabaseApi.GetOnPlayerLeftRowsWithTime());
    const badEntries: number[] = [];
    for (const row of rows) {
      const time = cellNumber(row[1]);
      const id = cellNumber(row[2]);
      const ref = instances.get(row[0]);
      if (time !== null && id !== null && typeof ref === "number" && time > ref) {
        badEntries.push(id);
      }
    }
    return badEntries;
  },

  async fixBrokenLeaveEntries() {
    const badEntries = await this.getBrokenLeaveEntries();
    await sqliteService.run(DatabaseApi.ResetLeaveTimes(badEntries.map((id) => String(id))));
  },

  async fixBrokenGroupInvites() {
    await sqliteService.run(DatabaseApi.DeleteGroupInviteNotifications());
  },

  async fixBrokenNotifications() {
    await sqliteService.run(DatabaseApi.DeleteBrokenNotifications());
  },

  async fixBrokenGroupChange() {
    await sqliteService.run(DatabaseApi.DeleteOldGroupChangeNotifications());
  },

  async fixCancelFriendRequestTypo() {
    await sqliteService.run(DatabaseApi.FixCancelFriendRequestTypo());
  },

  async getBrokenGameLogDisplayNames(): Promise<BrokenDisplayName[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetBrokenGameLogDisplayNames());
    return rows.flatMap((row) => toBrokenDisplayName(row) ?? []);
  },

  async fixBrokenGameLogDisplayNames() {
    const badEntries = await this.getBrokenGameLogDisplayNames();
    for (const entry of badEntries) {
      const newDisplayName = entry.displayName.split(" (")[0] ?? entry.displayName;
      const existingRows = await sqliteService.rows(DatabaseApi.HasGameLogEntry(entry.createdAt, entry.type, newDisplayName));
      if (existingRows.length > 0) {
        await sqliteService.run(DatabaseApi.DeleteGameLogEntry(entry.id));
        continue;
      }
      await sqliteService.run(DatabaseApi.RenameGameLogEntry(entry.id, newDisplayName));
    }
  },
};

export { tableFixes };
