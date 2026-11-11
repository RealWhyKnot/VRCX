import { cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

const friendFavorites = {
  addFriendToLocalFavorites(userId: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.AddFriendToLocalFavorites(userId, groupName, new Date().toJSON())).catch(logDatabaseError);
  },

  removeFriendFromLocalFavorites(userId: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RemoveFriendFromLocalFavorites(userId, groupName)).catch(logDatabaseError);
  },

  renameFriendFavoriteGroup(newGroupName: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RenameFriendFavoriteGroup(newGroupName, groupName)).catch(logDatabaseError);
  },

  deleteFriendFavoriteGroup(groupName: string): void {
    void sqliteService.run(DatabaseApi.DeleteFriendFavoriteGroup(groupName)).catch(logDatabaseError);
  },

  async getFriendFavorites(): Promise<{ created_at: string | null; userId: string | null; groupName: string | null }[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendFavorites());
    return rows.map((row) => ({
      created_at: cellText(row[1]),
      userId: cellText(row[2]),
      groupName: cellText(row[3]),
    }));
  },
};

export { friendFavorites };
