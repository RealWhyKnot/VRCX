import sqliteService from "../sqlite.js";

const tableAlter = {
  async upgradeDatabaseVersion() {
    await this.initTables();
    await this.cleanLegendFromFriendLog();
    await this.fixGameLogTraveling();
    await this.fixNegativeGPS();
    await this.fixBrokenLeaveEntries();
    await this.fixBrokenGroupInvites();
    await this.fixBrokenNotifications();
    await this.fixBrokenGroupChange();
    await this.fixCancelFriendRequestTypo();
    await this.fixBrokenGameLogDisplayNames();
    await this.updateTableForGroupNames();
    await this.addFriendLogFriendNumber();
    await this.updateTableForAvatarHistory();
    await this.addPerformanceIndexes();
    await this.addFeedBioLinks();
  },

  async updateTableForGroupNames() {
    const tables = [];
    await sqliteService.execute((dbRow) => {
      tables.push(dbRow[0]);
    }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_gps' OR name LIKE '%_feed_online_offline' OR name = 'gamelog_location'`);
    for (const tableName of tables) {
      try {
        await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD group_name TEXT DEFAULT ''`);
      } catch (e) {
        const msg = e.toString();
        if (msg.indexOf("duplicate column name") === -1) {
          console.error(msg);
        }
      }
    }

    try {
      await sqliteService.executeNonQuery(`ALTER TABLE gamelog_location DROP COLUMN groupName`);
    } catch (e) {
      const msg = e.toString();
      if (msg.indexOf("no such column") === -1) {
        console.error(msg);
      }
    }
  },

  async addFriendLogFriendNumber() {
    const tables = [];
    await sqliteService.execute((dbRow) => {
      tables.push(dbRow[0]);
    }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_current' OR name LIKE '%_friend_log_history'`);
    for (const tableName of tables) {
      try {
        await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD friend_number INTEGER DEFAULT 0`);
      } catch (e) {
        const msg = e.toString();
        if (msg.indexOf("duplicate column name") === -1) {
          console.error(msg);
        }
      }
    }
  },

  async updateTableForAvatarHistory() {
    const tables = [];
    await sqliteService.execute((dbRow) => {
      tables.push(dbRow[0]);
    }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_avatar_history'`);
    for (const tableName of tables) {
      try {
        await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD time INTEGER DEFAULT 0`);
      } catch (e) {
        const msg = e.toString();
        if (msg.indexOf("duplicate column name") === -1) {
          console.error(msg);
        }
      }
    }
  },

  async addPerformanceIndexes() {
    const tables = [];
    await sqliteService.execute((dbRow) => {
      tables.push(dbRow[0]);
    }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_friend_log_history'`);
    for (const tableName of tables) {
      try {
        await sqliteService.executeNonQuery(`CREATE INDEX IF NOT EXISTS ${tableName}_user_id_idx ON ${tableName} (user_id)`);
      } catch (e) {
        console.error(e);
      }
    }
  },

  async addFeedBioLinks() {
    const tables = [];
    await sqliteService.execute((dbRow) => {
      tables.push(dbRow[0]);
    }, `SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_feed_bio'`);
    for (const tableName of tables) {
      for (const column of ["bio_links", "previous_bio_links"]) {
        try {
          await sqliteService.executeNonQuery(`ALTER TABLE ${tableName} ADD ${column} TEXT DEFAULT '[]'`);
        } catch (e) {
          const msg = e.toString();
          if (msg.indexOf("duplicate column name") === -1) {
            console.error(msg);
          }
        }
      }
    }
  },
};

export { tableAlter };
