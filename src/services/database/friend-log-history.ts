import { cellNumber, cellText } from "./cells.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type FriendLogHistoryEntry = {
  rowId: number | null;
  created_at: string | null;
  type: string | null;
  userId: string | null;
  displayName: string | null;
  friendNumber: number | null;
  previousDisplayName?: string | null;
  trustLevel?: string | null;
  previousTrustLevel?: string | null;
};

type FriendLogHistoryInput = {
  created_at: string;
  type: string;
  userId: string;
  displayName: string | null;
  previousDisplayName?: string | null;
  trustLevel?: string | null;
  previousTrustLevel?: string | null;
  friendNumber?: number | null;
};

type FriendLogHistoryArrayRow = {
  created_at?: unknown;
  type?: unknown;
  userId?: unknown;
  displayName?: unknown;
  previousDisplayName?: unknown;
  trustLevel?: unknown;
  previousTrustLevel?: unknown;
  friendNumber?: unknown;
};

type FriendLogHistoryDeleteEntry = {
  rowId?: number | null;
  created_at: string;
  type: string;
  userId: string;
};

function toFriendLogHistoryEntry(row: DatabaseRow): FriendLogHistoryEntry {
  const entry: FriendLogHistoryEntry = {
    rowId: cellNumber(row[0]),
    created_at: cellText(row[1]),
    type: cellText(row[2]),
    userId: cellText(row[3]),
    displayName: cellText(row[4]),
    friendNumber: cellNumber(row[8]),
  };
  if (entry.type === "DisplayName") {
    entry.previousDisplayName = cellText(row[5]);
  } else if (entry.type === "TrustLevel") {
    entry.trustLevel = cellText(row[6]);
    entry.previousTrustLevel = cellText(row[7]);
  }
  return entry;
}

const friendLogHistory = {
  async getFriendLogHistory(): Promise<FriendLogHistoryEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendLogHistory());
    return rows.map(toFriendLogHistoryEntry).reverse();
  },

  addFriendLogHistory(entry: FriendLogHistoryInput): void {
    void sqliteService
      .run(
        DatabaseApi.AddFriendLogHistory(
          entry.created_at,
          entry.type,
          entry.userId,
          entry.displayName,
          entry.previousDisplayName ?? null,
          entry.trustLevel ?? null,
          entry.previousTrustLevel ?? null,
          entry.friendNumber ?? null
        )
      )
      .catch(logDatabaseError);
  },

  addFriendLogHistoryArray(inputData: FriendLogHistoryArrayRow[]): void {
    if (inputData.length === 0) {
      return;
    }
    void sqliteService
      .run(
        DatabaseApi.AddFriendLogHistoryArray(
          inputData.map((line) => cellText(line.created_at)),
          inputData.map((line) => cellText(line.type)),
          inputData.map((line) => cellText(line.userId)),
          inputData.map((line) => cellText(line.displayName)),
          inputData.map((line) => cellText(line.previousDisplayName)),
          inputData.map((line) => cellText(line.trustLevel)),
          inputData.map((line) => cellText(line.previousTrustLevel)),
          inputData.map((line) => cellText(line.friendNumber))
        )
      )
      .catch(logDatabaseError);
  },

  async getFriendLogHistoryForUserId(userId: string, types: string[] = []): Promise<FriendLogHistoryEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendLogHistoryForUserId(userId, types));
    return rows.map(toFriendLogHistoryEntry);
  },

  deleteFriendLogHistory(entry: FriendLogHistoryDeleteEntry): void {
    if (entry.rowId != null) {
      void sqliteService.run(DatabaseApi.DeleteFriendLogHistoryById(entry.rowId)).catch(logDatabaseError);
    } else {
      void sqliteService.run(DatabaseApi.DeleteFriendLogHistoryByKey(entry.created_at, entry.type, entry.userId)).catch(logDatabaseError);
    }
  },
};

export { friendLogHistory };
