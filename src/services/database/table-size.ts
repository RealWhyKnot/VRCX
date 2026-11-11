import { dbVars } from "../database";

import { sqliteService } from "../sqlite.ts";

const tableSize = {
  async getMaxFriendLogNumber() {
    let friendNumber = 0;
    await sqliteService.execute((dbRow) => {
      friendNumber = dbRow[0];
    }, `SELECT MAX(friend_number) FROM ${dbVars.userPrefix}_friend_log_current`);
    return friendNumber;
  },

  async getGpsTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_gps`);
    return size;
  },

  async getStatusTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_status`);
    return size;
  },

  async getBioTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_bio`);
    return size;
  },

  async getAvatarTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_avatar`);
    return size;
  },

  async getOnlineOfflineTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_online_offline`);
    return size;
  },

  async getFriendLogHistoryTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_friend_log_history`);
    return size;
  },

  async getNotificationTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM ${dbVars.userPrefix}_notifications`);
    return size;
  },

  async getLocationTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_location`);
    return size;
  },

  async getJoinLeaveTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_join_leave`);
    return size;
  },

  async getPortalSpawnTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_portal_spawn`);
    return size;
  },

  async getVideoPlayTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_video_play`);
    return size;
  },

  async getResourceLoadTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_resource_load`);
    return size;
  },

  async getEventTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_event`);
    return size;
  },

  async getExternalTableSize() {
    let size = 0;
    await sqliteService.execute((row) => {
      size = row[0];
    }, `SELECT COUNT(*) FROM gamelog_external`);
    return size;
  },
};

export { tableSize };
