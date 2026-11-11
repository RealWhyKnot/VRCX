type FeedBridge = {
  AddFeedGps(
    createdAt: string,
    userId: string,
    displayName: string,
    location: string | null,
    worldName: string | null,
    previousLocation: string | null,
    time: number | null,
    groupName: string | null
  ): Promise<number>;
  AddFeedStatus(
    createdAt: string,
    userId: string,
    displayName: string,
    status: string | null,
    statusDescription: string | null,
    previousStatus: string | null,
    previousStatusDescription: string | null
  ): Promise<number>;
  AddFeedBio(
    createdAt: string,
    userId: string,
    displayName: string,
    bio: string | null,
    previousBio: string | null,
    bioLinks: string,
    previousBioLinks: string
  ): Promise<number>;
  AddFeedAvatar(
    createdAt: string,
    userId: string,
    displayName: string,
    ownerId: string | null,
    avatarName: string | null,
    currentAvatarImageLink: string | null,
    currentAvatarThumbnailImageLink: string | null,
    previousCurrentAvatarImageLink: string | null,
    previousCurrentAvatarThumbnailImageLink: string | null
  ): Promise<number>;
  AddFeedOnlineOffline(
    createdAt: string,
    userId: string,
    displayName: string,
    type: string,
    location: string | null,
    worldName: string | null,
    time: number | null,
    groupName: string | null
  ): Promise<number>;
  DeleteAvatarFeedOlderThan(cutoff: string): Promise<void>;
  DeleteAllAvatarFeed(): Promise<void>;
  GetHotWorlds(days: number, limit: number): Promise<string>;
  GetHotWorldTrendBaseline(days: number): Promise<string>;
  GetHotWorldTrendRecent(days: number): Promise<string>;
  GetHotWorldFriendDetail(worldId: string, days: number): Promise<string>;
  SearchFeed(search: string, filters: string[], vipList: string[], limit: number, dateFrom: string, dateTo: string): Promise<string>;
  LookupFeed(filters: string[], vipList: string[], limit: number): Promise<string>;
  GetFeedByInstanceId(instanceId: string, filters: string[], vipList: string[], limit: number): Promise<string>;
};

export type { FeedBridge };
