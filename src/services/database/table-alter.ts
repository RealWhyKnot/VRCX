import { sqliteService } from "../sqlite.ts";

const tableAlter = {
  async updateTableForGroupNames() {
    await sqliteService.run(DatabaseApi.UpdateTableForGroupNames());
  },

  async addFriendLogFriendNumber() {
    await sqliteService.run(DatabaseApi.AddFriendLogFriendNumberColumn());
  },

  async updateTableForAvatarHistory() {
    await sqliteService.run(DatabaseApi.AddAvatarHistoryTimeColumn());
  },

  async addPerformanceIndexes() {
    await sqliteService.run(DatabaseApi.AddFriendLogHistoryUserIdIndexes());
  },

  async addFeedBioLinks() {
    await sqliteService.run(DatabaseApi.AddFeedBioLinkColumns());
  },
};

export { tableAlter };
