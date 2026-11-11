import { activityV2 } from "./activity-v2.ts";
import { avatarFavorites } from "./avatar-favorites.ts";
import { avatarTags } from "./avatar-tags.ts";
import { feed } from "./feed.ts";
import { friendFavorites } from "./friend-favorites.ts";
import { friendLogCurrent } from "./friend-log-current.ts";
import { friendLogHistory } from "./friend-log-history.ts";
import { gameLog } from "./game-log.ts";
import { memos } from "./memos.ts";
import { moderation } from "./moderation.ts";
import { mutualGraph } from "./mutual-graph.ts";
import { notifications } from "./notifications.ts";
import { tableAlter } from "./table-alter.ts";
import { tableFixes } from "./table-fixes.ts";
import { tableSize } from "./table-size.ts";
import { userProfile } from "./user-profile.ts";
import { worldFavorites } from "./world-favorites.ts";
import { printFavorites } from "./print-favorites.ts";

import { sqliteService } from "../sqlite.ts";

type DatabaseVars = {
  userId: string;
  maxTableSize: number;
  searchTableSize: number;
};

const hot: { data: { dbVars?: DatabaseVars } } | undefined = import.meta.hot;

const dbVars: DatabaseVars = hot?.data.dbVars ?? {
  userId: "",
  maxTableSize: 500,
  searchTableSize: 5000,
};

if (hot) {
  hot.data.dbVars = dbVars;
}

function logDatabaseError(error: unknown): void {
  console.error(error);
}

const database = {
  ...feed,
  ...activityV2,
  ...gameLog,
  ...notifications,
  ...moderation,
  ...friendLogHistory,
  ...friendLogCurrent,
  ...memos,
  ...avatarFavorites,
  ...avatarTags,
  ...friendFavorites,
  ...worldFavorites,
  ...printFavorites,
  ...tableAlter,
  ...tableFixes,
  ...tableSize,
  ...mutualGraph,
  ...userProfile,

  setMaxTableSize(limit: number) {
    dbVars.maxTableSize = limit;
  },

  setSearchTableSize(limit: number) {
    dbVars.searchTableSize = limit;
  },

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

  async initUserTables(userId: string) {
    await sqliteService.run(DatabaseApi.SetUser(userId));
    dbVars.userId = userId;
    await sqliteService.run(DatabaseApi.CreateUserTables());
  },

  async initTables() {
    await sqliteService.run(DatabaseApi.CreateGlobalTables());
  },

  begin() {
    void sqliteService.run(DatabaseApi.BeginTransaction()).catch(logDatabaseError);
  },

  commit() {
    void sqliteService.run(DatabaseApi.CommitTransaction()).catch(logDatabaseError);
  },

  async vacuum() {
    await sqliteService.run(DatabaseApi.VacuumDatabase());
  },

  async optimize() {
    await sqliteService.run(DatabaseApi.OptimizeDatabase());
  },
};

window.database = database;
export { database, dbVars };
