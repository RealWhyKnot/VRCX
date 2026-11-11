import { cellNumber } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";

async function readCount(call: Promise<string>): Promise<number> {
  const rows = await sqliteService.rows(call);
  const [row] = rows;
  return row === undefined ? 0 : (cellNumber(row[0]) ?? 0);
}

const tableSize = {
  async getMaxFriendLogNumber(): Promise<number | null> {
    const rows = await sqliteService.rows(DatabaseApi.GetMaxFriendLogNumber());
    const [row] = rows;
    return row === undefined ? 0 : cellNumber(row[0]);
  },

  async getGpsTableSize() {
    return readCount(DatabaseApi.GetGpsTableSize());
  },

  async getStatusTableSize() {
    return readCount(DatabaseApi.GetStatusTableSize());
  },

  async getBioTableSize() {
    return readCount(DatabaseApi.GetBioTableSize());
  },

  async getAvatarTableSize() {
    return readCount(DatabaseApi.GetAvatarTableSize());
  },

  async getOnlineOfflineTableSize() {
    return readCount(DatabaseApi.GetOnlineOfflineTableSize());
  },

  async getFriendLogHistoryTableSize() {
    return readCount(DatabaseApi.GetFriendLogHistoryTableSize());
  },

  async getNotificationTableSize() {
    return readCount(DatabaseApi.GetNotificationTableSize());
  },

  async getLocationTableSize() {
    return readCount(DatabaseApi.GetLocationTableSize());
  },

  async getJoinLeaveTableSize() {
    return readCount(DatabaseApi.GetJoinLeaveTableSize());
  },

  async getPortalSpawnTableSize() {
    return readCount(DatabaseApi.GetPortalSpawnTableSize());
  },

  async getVideoPlayTableSize() {
    return readCount(DatabaseApi.GetVideoPlayTableSize());
  },

  async getResourceLoadTableSize() {
    return readCount(DatabaseApi.GetResourceLoadTableSize());
  },

  async getEventTableSize() {
    return readCount(DatabaseApi.GetEventTableSize());
  },

  async getExternalTableSize() {
    return readCount(DatabaseApi.GetExternalTableSize());
  },
};

export { tableSize };
