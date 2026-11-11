import { cellNumber, cellText } from "./cells.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type FriendLogCurrentEntry = {
  userId: string | null;
  displayName: string | null;
  trustLevel: string | null;
  friendNumber: number | null;
};

type FriendLogCurrentWriteEntry = {
  userId: string;
  displayName: string | null;
  trustLevel: string | null;
  friendNumber?: number | null;
};

type FriendLogCurrentArrayRow = {
  userId?: unknown;
  displayName?: unknown;
  trustLevel?: unknown;
  friendNumber: number;
};

function toFriendLogCurrentEntry(row: DatabaseRow): FriendLogCurrentEntry {
  return {
    userId: cellText(row[0]),
    displayName: cellText(row[1]),
    trustLevel: cellText(row[2]),
    friendNumber: cellNumber(row[3]),
  };
}

const friendLogCurrent = {
  async getFriendLogCurrent(): Promise<FriendLogCurrentEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendLogCurrent());
    return rows.map(toFriendLogCurrentEntry).reverse();
  },

  setFriendLogCurrent(entry: FriendLogCurrentWriteEntry): void {
    void sqliteService
      .run(DatabaseApi.SetFriendLogCurrent(entry.userId, entry.displayName, entry.trustLevel, entry.friendNumber ?? null))
      .catch(logDatabaseError);
  },

  setFriendLogCurrentArray(inputData: FriendLogCurrentArrayRow[]): void {
    if (inputData.length === 0) {
      return;
    }
    void sqliteService
      .run(
        DatabaseApi.SetFriendLogCurrentArray(
          inputData.map((line) => cellText(line.userId) ?? ""),
          inputData.map((line) => cellText(line.displayName) ?? ""),
          inputData.map((line) => cellText(line.trustLevel) ?? ""),
          inputData.map((line) => (Number.isFinite(line.friendNumber) ? String(line.friendNumber) : "0"))
        )
      )
      .catch(logDatabaseError);
  },

  deleteFriendLogCurrent(userId: string): void {
    void sqliteService.run(DatabaseApi.DeleteFriendLogCurrent(userId)).catch(logDatabaseError);
  },
};

export { friendLogCurrent };
