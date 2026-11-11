import type { LimitedUserFriend, User } from "vrchat";

import type { Json, TableFilter, VrcxFavorite, VrcxUser } from "../types/vrcx";

export type FriendState = "online" | "active" | "offline";

export type FriendContext = {
  id: string;
  state: FriendState | "";
  isVIP: boolean;
  ref: VrcxUser | undefined;
  name: string;
  pendingOffline: boolean;
  $nickName: string;
};

export type FriendListEntry = Json<LimitedUserFriend> | Json<User>;

export type FriendLogRow = {
  userId: string;
  displayName: string | null;
  trustLevel: string | null;
  friendNumber: number | null;
};

export type FriendLogHistoryRow = {
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

export type FriendLogSnapshotRow = FriendLogRow & {
  friendNumber: number;
};

export type FriendLogTable = {
  data: FriendLogHistoryRow[];
  filters: TableFilter<FriendLogHistoryRow>[];
  pageSizeLinked: boolean;
  loading: boolean;
};

export type FriendStatusSource = {
  friends: readonly string[];
  offlineFriends: readonly string[];
  activeFriends: readonly string[];
  onlineFriends: readonly string[];
};

export type FriendCurrentUser = FriendStatusSource & {
  id: string;
};

export type FriendOrderEntry = {
  id: string;
  displayName: string | null;
  created_at: string | null;
};

export type FriendOrderBackup = {
  matches: number;
  table: readonly string[];
  isValid: boolean;
};

export type FriendOrderUser = {
  id: string;
  friends: readonly string[];
};

export type FriendOrderBackups = Record<string, string[]>;

export type PendingOfflineEntry = {
  startTime: number;
  newState: FriendState | undefined;
  previousLocation: string;
  previousLocationAt: number;
};

export type FriendStoreState = {
  friendNumber: number;
};

export type FriendRequestIds = {
  stats: number;
  mutualCount: number;
  mutualOptedOut: number;
};

export type FriendStoreContext = {
  state: FriendStoreState;
  friends: Map<string, FriendContext>;
  friendLog: Map<string, FriendLogRow>;
  friendLogTable: FriendLogTable;
  requestIds: FriendRequestIds;
  reindexSortedFriend: (input: string | FriendContext) => void;
  runInSortedFriendsBatch: <T>(fn: () => T) => T;
};

export function isVrcxUser(value: unknown): value is VrcxUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

export function isFriendLogHistoryRow(value: unknown): value is FriendLogHistoryRow {
  return typeof value === "object" && value !== null;
}

export function isFriendOrderBackups(value: unknown): value is FriendOrderBackups {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"));
}

export function isCachedFavorite(value: unknown): value is VrcxFavorite {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "favoriteId" in value &&
    typeof value.favoriteId === "string" &&
    "$groupKey" in value &&
    typeof value.$groupKey === "string"
  );
}
