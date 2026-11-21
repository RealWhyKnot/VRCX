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

type FriendLogHistoryOptions = {
  beforeDate?: string | null;
  offset?: number;
  types: string[];
  search: string;
  hideUnfriends: boolean;
  ascending: boolean;
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

const pendingHistoryWrites = new Set<Promise<unknown>>();

function trackHistoryWrite(write: Promise<unknown>): void {
  pendingHistoryWrites.add(write);
  void write
    .finally(() => {
      pendingHistoryWrites.delete(write);
    })
    .catch(logDatabaseError);
}

const friendLogHistory = {
  async getFriendLogHistory(): Promise<FriendLogHistoryEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendLogHistory());
    return rows.map(toFriendLogHistoryEntry).reverse();
  },

  async getFriendLogHistoryPage(limit: number, beforeId: number | null = null, options?: FriendLogHistoryOptions): Promise<FriendLogHistoryEntry[]> {
    if (options?.offset !== undefined && options.offset > 0) {
      const rows = await sqliteService.rows(
        DatabaseApi.GetFilteredFriendLogHistoryPageAtOffset(limit, options.offset, options.types, options.search, options.hideUnfriends, options.ascending)
      );
      return rows.map(toFriendLogHistoryEntry);
    }
    const call = options
      ? DatabaseApi.GetFilteredFriendLogHistoryPage(
          limit,
          beforeId,
          options.beforeDate ?? null,
          options.types,
          options.search,
          options.hideUnfriends,
          options.ascending
        )
      : DatabaseApi.GetFriendLogHistoryPage(limit, beforeId);
    return (await sqliteService.rows(call)).map(toFriendLogHistoryEntry);
  },

  async getFriendLogHistoryCount(options: FriendLogHistoryOptions): Promise<number> {
    const rows = await sqliteService.rows(DatabaseApi.GetFilteredFriendLogHistoryCount(options.types, options.search, options.hideUnfriends));
    return cellNumber(rows[0]?.[0]) ?? 0;
  },

  addFriendLogHistory(entry: FriendLogHistoryInput): void {
    trackHistoryWrite(
      sqliteService.run(
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
    );
  },

  addFriendLogHistoryArray(inputData: FriendLogHistoryArrayRow[]): void {
    if (inputData.length === 0) {
      return;
    }
    trackHistoryWrite(
      sqliteService.run(
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
    );
  },

  async waitForFriendLogHistoryWrites(): Promise<void> {
    await Promise.all(pendingHistoryWrites);
  },

  async getFriendLogHistoryForUserId(userId: string, types: string[] = []): Promise<FriendLogHistoryEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetFriendLogHistoryForUserId(userId, types));
    return rows.map(toFriendLogHistoryEntry);
  },

  async deleteFriendLogHistory(entry: FriendLogHistoryDeleteEntry): Promise<void> {
    const call =
      entry.rowId != null
        ? DatabaseApi.DeleteFriendLogHistoryById(entry.rowId)
        : DatabaseApi.DeleteFriendLogHistoryByKey(entry.created_at, entry.type, entry.userId);
    await sqliteService.run(call).catch(logDatabaseError);
  },
};

export { friendLogHistory };
export type { FriendLogHistoryOptions };
