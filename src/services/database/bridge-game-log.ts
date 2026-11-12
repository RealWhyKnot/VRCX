type GameLogBridge = {
  AddGamelogLocation(
    createdAt: string | null,
    location: string | null,
    worldId: string | null,
    worldName: string | null,
    time: number,
    groupName: string | null
  ): Promise<number>;
  UpdateGamelogLocationTime(createdAt: string | null, time: number): Promise<void>;
  AddGamelogJoinLeave(
    createdAt: string | null,
    type: string | null,
    displayName: string | null,
    location: string | null,
    userId: string | null,
    time: number | null
  ): Promise<number>;
  AddGamelogPortalSpawn(
    createdAt: string | null,
    displayName: string | null,
    location: string | null,
    userId: string | null,
    instanceId: string | null,
    worldName: string | null
  ): Promise<number>;
  AddGamelogVideoPlay(
    createdAt: string | null,
    videoLink: string | null,
    videoName: string | null,
    videoId: string | null,
    location: string | null,
    displayName: string | null,
    userId: string | null
  ): Promise<number>;
  UpdateGamelogVideoPlayName(rowId: number, videoName: string | null): Promise<number>;
  AddGamelogResourceLoad(createdAt: string | null, resourceLink: string | null, resourceType: string | null, location: string | null): Promise<number>;
  AddGamelogEvent(createdAt: string | null, data: string | null): Promise<number>;
  AddGamelogExternal(
    createdAt: string | null,
    message: string | null,
    displayName: string | null,
    userId: string | null,
    location: string | null
  ): Promise<number>;
  DeleteGameLogInstanceByLocation(location: string | null): Promise<void>;
  DeleteGameLogInstance(userId: string | null, displayName: string | null, location: string | null, eventIds: string[]): Promise<void>;
  DeleteGameLogVideoPlay(createdAt: string | null, videoLink: string | null, location: string | null): Promise<void>;
  DeleteGameLogEvent(createdAt: string | null, data: string | null): Promise<void>;
  DeleteGameLogExternal(createdAt: string | null, message: string | null): Promise<void>;
  DeleteGameLogResourceLoad(createdAt: string | null, resourceLink: string | null, location: string | null): Promise<void>;
  GetLastVisit(worldId: string, count: number): Promise<string>;
  GetVisitCount(worldId: string): Promise<string>;
  GetTimeSpentInWorld(worldId: string): Promise<string>;
  GetLastGroupVisit(groupId: string): Promise<string>;
  GetGroupJoinCount(groupId: string): Promise<string>;
  GetGroupVisitStats(): Promise<string>;
  GetPreviousInstancesByGroupId(groupId: string): Promise<string>;
  GetPreviousInstancesByWorldId(worldId: string): Promise<string>;
  GetGameLogWorldName(worldId: string): Promise<string>;
  GetGameLogInstancesTime(): Promise<string>;
  GetPlayersFromInstance(location: string): Promise<string>;
  GetPlayerDetailFromInstance(location: string): Promise<string>;
  GetGameLogByLocation(instanceId: string, filters: string[], vipIds: string[], userId: string, searchTableSize: number): Promise<string>;
  GetRecentGameLogLocations(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogJoinLeave(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogPortalSpawn(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogVideoPlay(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogResourceLoad(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogEvents(dateOffset: string, limit: number): Promise<string>;
  GetRecentGameLogExternal(dateOffset: string, limit: number): Promise<string>;
  GetLatestGameLogLocationCreatedAt(): Promise<string>;
  GetLatestGameLogJoinLeaveCreatedAt(): Promise<string>;
  GetLatestGameLogPortalSpawnCreatedAt(): Promise<string>;
  GetLatestGameLogEventCreatedAt(): Promise<string>;
  GetLatestGameLogVideoPlayCreatedAt(): Promise<string>;
  GetLatestGameLogResourceLoadCreatedAt(): Promise<string>;
  LookupGameLog(filters: string[], vipIds: string[], maxEntries: number): Promise<string>;
  SearchGameLog(search: string, filters: string[], vipIds: string[], userId: string, maxEntries: number): Promise<string>;
  GetLastOnlineSessionBefore(fromDate: string): Promise<string>;
  GetOnlineSessions(fromDate: string | null, toDate: string | null): Promise<string>;
  GetOnlineSessionsAfter(afterCreatedAt: string, inclusive: boolean): Promise<string>;
  GetMyTopWorlds(days: number, limit: number, sortBy: string, excludeWorldId: string): Promise<string>;
  GetSessionsLocationSegments(limit: number): Promise<string>;
  GetSessionsLocationSegmentsBefore(beforeId: number, limit: number): Promise<string>;
  GetSessionsLocationSegmentsSince(sinceDate: string, limit: number): Promise<string>;
  GetSessionsJoinLeaveForLocations(locations: string[], afterDate: string, beforeDate: string, selfId: string): Promise<string>;
  GetSessionsVideoPlaysForLocations(locations: string[], afterDate: string, beforeDate: string): Promise<string>;
  GetLastSeen(userId: string | null, displayName: string | null, count: number): Promise<string>;
  GetJoinCount(userId: string | null, displayName: string | null): Promise<string>;
  GetTimeSpent(userId: string | null, displayName: string | null): Promise<string>;
  GetUserStats(userId: string | null, displayName: string | null): Promise<string>;
  GetAllUserStats(userIds: string[], displayNames: string[]): Promise<string>;
  GetUserIdFromDisplayName(displayName: string): Promise<string>;
  GetPreviousDisplayNamesByUserId(userId: string): Promise<string>;
  GetPreviousInstancesByUserId(userId: string | null, displayName: string | null): Promise<string>;
  GetJoinLeaveDatesByUserId(userId: string): Promise<string>;
  GetRepeatEncounters(selfId: string, minPlaces: number, limit: number): Promise<string>;
  GetFirstMetByUserId(userId: string): Promise<string>;
  GetVoteKickEvents(limit: number): Promise<string>;
  GetRecentInstanceJoinsByUserId(userId: string, since: string): Promise<string>;
  GetInstanceActivityRows(startDate: string, endDate: string): Promise<string>;
};

export type { GameLogBridge };
