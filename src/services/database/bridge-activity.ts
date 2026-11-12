type ActivityBridge = {
  GetFriendPresenceSliceWindow(userId: string, fromDateIso: string, toDateIso: string): Promise<string>;
  GetFriendPresenceSliceEnd(userId: string, toDateIso: string): Promise<string>;
  GetFriendPresenceAfter(userId: string, afterCreatedAt: string): Promise<string>;
  GetCurrentUserLocationSlice(fromDateIso: string, toDateIso: string): Promise<string>;
  GetCurrentUserLocationAfter(afterCreatedAt: string, inclusive: boolean): Promise<string>;
  GetActivitySyncState(userId: string): Promise<string>;
  UpsertActivitySyncState(
    userId: string,
    updatedAt: string,
    isSelf: boolean,
    sourceLastCreatedAt: string,
    pendingSessionStartAt: number | null,
    cachedRangeDays: number
  ): Promise<void>;
  GetActivitySessions(userId: string): Promise<string>;
  ReplaceActivitySessions(userId: string, startAt: string[], endAt: string[], isOpenTail: string[], sourceRevision: string[]): Promise<void>;
  AppendActivitySessions(userId: string, startAt: string[], endAt: string[], isOpenTail: string[], sourceRevision: string[]): Promise<void>;
  AppendActivitySessionsFrom(
    userId: string,
    replaceFromStartAt: number,
    startAt: string[],
    endAt: string[],
    isOpenTail: string[],
    sourceRevision: string[]
  ): Promise<void>;
  GetActivityBucketCache(ownerUserId: string, targetUserId: string, rangeDays: number, viewKind: string, excludeKey: string): Promise<string>;
  UpsertActivityBucketCache(
    ownerUserId: string,
    targetUserId: string,
    rangeDays: number,
    viewKind: string,
    excludeKey: string,
    bucketVersion: number,
    builtFromCursor: string,
    rawBucketsJson: string,
    normalizedBucketsJson: string,
    summaryJson: string,
    builtAt: string
  ): Promise<void>;
  GetNotifications(maxEntries: number): Promise<string>;
  LookupNotifications(search: string, filters: string[], vipList: string[], maxEntries: number): Promise<string>;
  AddNotification(
    id: string,
    createdAt: string,
    type: string,
    senderUserId: string,
    senderUsername: string,
    receiverUserId: string,
    message: string,
    worldId: string,
    worldName: string,
    imageUrl: string,
    inviteMessage: string,
    requestMessage: string,
    responseMessage: string,
    expired: boolean
  ): Promise<void>;
  DeleteNotification(rowId: string): Promise<void>;
  UpdateNotificationExpired(id: string, expired: boolean): Promise<void>;
  GetNotificationsV2(maxEntries: number): Promise<string>;
  GetGroupNotificationStats(): Promise<string>;
  AddNotificationV2(
    id: string,
    createdAt: string | null,
    updatedAt: string | null,
    expiresAt: string | null,
    type: string | null,
    link: string | null,
    linkText: string | null,
    message: string | null,
    title: string | null,
    imageUrl: string | null,
    seen: boolean,
    senderUserId: string | null,
    senderUsername: string | null,
    dataJson: string,
    responsesJson: string,
    detailsJson: string
  ): Promise<void>;
  ExpireNotificationV2(id: string, expiresAt: string): Promise<void>;
  SeenNotificationV2(id: string): Promise<void>;
  DeleteNotificationV2(id: string): Promise<void>;
  GetMutualGraphFriends(): Promise<string>;
  GetMutualGraphLinks(): Promise<string>;
  GetMutualCounts(): Promise<string>;
  GetMutualGraphMeta(): Promise<string>;
  SaveMutualGraph(friendIds: string[], edgeFriendIds: string[], edgeMutualIds: string[]): Promise<void>;
  UpdateMutualsForFriend(friendId: string, mutualIds: string[]): Promise<void>;
  UpsertMutualGraphMeta(friendId: string, lastFetchedAt: string, optedOut: boolean): Promise<void>;
  BulkUpsertMutualGraphMeta(lastFetchedAt: string, optedInIds: string[], optedOutIds: string[]): Promise<void>;
};

export type { ActivityBridge };
