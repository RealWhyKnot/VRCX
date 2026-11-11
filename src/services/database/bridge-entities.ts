type EntitiesBridge = {
  GetUserMemo(userId: string): Promise<string>;
  GetAllUserMemos(): Promise<string>;
  SetUserMemo(userId: string, editedAt: string, memo: string | null): Promise<void>;
  DeleteUserMemo(userId: string): Promise<void>;
  GetWorldMemo(worldId: string): Promise<string>;
  SetWorldMemo(worldId: string, editedAt: string, memo: string | null): Promise<void>;
  DeleteWorldMemo(worldId: string): Promise<void>;
  GetAvatarMemo(avatarId: string): Promise<string>;
  SetAvatarMemo(avatarId: string, editedAt: string, memo: string | null): Promise<void>;
  DeleteAvatarMemo(avatarId: string): Promise<void>;
  AddUserNote(userId: string, displayName: string | null, note: string | null, createdAt: string): Promise<void>;
  GetAllUserNotes(): Promise<string>;
  DeleteUserNote(userId: string): Promise<void>;

  AddAvatarToCache(
    id: string,
    addedAt: string,
    authorId: string | null,
    authorName: string | null,
    createdAt: string | null,
    description: string | null,
    imageLink: string | null,
    name: string | null,
    releaseStatus: string | null,
    thumbnailImageLink: string | null,
    updatedAt: string | null,
    version: number | null
  ): Promise<void>;
  AddAvatarToHistory(avatarId: string, createdAt: string): Promise<void>;
  GetAvatarTimeSpent(avatarId: string): Promise<string>;
  GetAllAvatarTimeSpent(): Promise<string>;
  AddAvatarTimeSpent(avatarId: string, timeSpent: number): Promise<void>;
  GetAvatarHistory(currentUserId: string, limit: number): Promise<string>;
  GetCachedAvatarById(id: string): Promise<string>;
  ClearAvatarHistory(): Promise<void>;
  AddAvatarToFavorites(avatarId: string, groupName: string, createdAt: string): Promise<void>;
  RenameAvatarFavoriteGroup(newGroupName: string, groupName: string): Promise<void>;
  DeleteAvatarFavoriteGroup(groupName: string): Promise<void>;
  RemoveAvatarFromFavorites(avatarId: string, groupName: string): Promise<void>;
  GetAvatarFavorites(): Promise<string>;
  RemoveAvatarFromCache(avatarId: string): Promise<void>;
  GetAvatarCache(): Promise<string>;

  AddWorldToCache(
    id: string,
    addedAt: string,
    authorId: string | null,
    authorName: string | null,
    createdAt: string | null,
    description: string | null,
    imageLink: string | null,
    name: string | null,
    releaseStatus: string | null,
    thumbnailImageLink: string | null,
    updatedAt: string | null,
    version: number | null
  ): Promise<void>;
  AddWorldToFavorites(worldId: string, groupName: string, createdAt: string): Promise<void>;
  RenameWorldFavoriteGroup(newGroupName: string, groupName: string): Promise<void>;
  DeleteWorldFavoriteGroup(groupName: string): Promise<void>;
  RemoveWorldFromFavorites(worldId: string, groupName: string): Promise<void>;
  GetWorldFavorites(): Promise<string>;
  RemoveWorldFromCache(worldId: string): Promise<void>;
  GetWorldCache(): Promise<string>;
  GetCachedWorldById(id: string): Promise<string>;

  AddFriendToLocalFavorites(userId: string, groupName: string, createdAt: string): Promise<void>;
  RemoveFriendFromLocalFavorites(userId: string, groupName: string): Promise<void>;
  RenameFriendFavoriteGroup(newGroupName: string, groupName: string): Promise<void>;
  DeleteFriendFavoriteGroup(groupName: string): Promise<void>;
  GetFriendFavorites(): Promise<string>;

  AddPrintToFavorites(printId: string, createdAt: string): Promise<void>;
  RemovePrintFromFavorites(printId: string): Promise<void>;
  GetPrintFavorites(): Promise<string>;

  GetFriendLogHistory(): Promise<string>;
  AddFriendLogHistory(
    createdAt: string,
    type: string,
    userId: string,
    displayName: string | null,
    previousDisplayName: string | null,
    trustLevel: string | null,
    previousTrustLevel: string | null,
    friendNumber: number | null
  ): Promise<void>;
  AddFriendLogHistoryArray(
    createdAt: (string | null)[],
    type: (string | null)[],
    userId: (string | null)[],
    displayName: (string | null)[],
    previousDisplayName: (string | null)[],
    trustLevel: (string | null)[],
    previousTrustLevel: (string | null)[],
    friendNumber: (string | null)[]
  ): Promise<void>;
  GetFriendLogHistoryForUserId(userId: string, types: string[]): Promise<string>;
  DeleteFriendLogHistoryById(rowId: number): Promise<void>;
  DeleteFriendLogHistoryByKey(createdAt: string, type: string, userId: string): Promise<void>;
  GetFriendLogCurrent(): Promise<string>;
  SetFriendLogCurrent(userId: string, displayName: string | null, trustLevel: string | null, friendNumber: number | null): Promise<void>;
  SetFriendLogCurrentArray(userId: string[], displayName: string[], trustLevel: string[], friendNumber: string[]): Promise<void>;
  DeleteFriendLogCurrent(userId: string): Promise<void>;

  GetModeration(userId: string): Promise<string>;
  SetModeration(userId: string, updatedAt: string | null, displayName: string | null, block: boolean, mute: boolean): Promise<void>;
  DeleteModeration(userId: string): Promise<void>;

  GetUserProfile(userId: string): Promise<string>;
  GetAllUserProfiles(): Promise<string>;
  SetUserProfile(userId: string, bio: string | null, bioLinks: string, updatedAt: string): Promise<void>;
  DeleteUserProfile(userId: string): Promise<void>;

  GetAvatarTags(avatarId: string): Promise<string>;
  GetAllAvatarTags(): Promise<string>;
  GetAllDistinctTags(): Promise<string>;
  AddAvatarTag(avatarId: string, tag: string, color: string | null): Promise<void>;
  UpdateAvatarTagColor(avatarId: string, tag: string, color: string | null): Promise<void>;
  RemoveAvatarTag(avatarId: string, tag: string): Promise<void>;
  RemoveAllAvatarTags(avatarId: string): Promise<void>;
};

export type { EntitiesBridge };
