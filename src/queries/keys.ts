type PagingParams = {
  n?: number | string | null;
  offset?: number | string | null;
};

export const queryKeys = Object.freeze({
  user: (userId: string) => ["user", userId],
  profile: (userId: string) => ["profile", userId],
  avatar: (avatarId: string) => ["avatar", avatarId],
  world: (worldId: string) => ["world", worldId],
  group: (groupId: string, hasRoles: boolean | null = false) => ["group", groupId, Boolean(hasRoles)],
  groupMember: ({ groupId, userId }: { groupId: string; userId: string }) => ["group", groupId, "member", userId],
  groupMembers: ({
    groupId,
    n = 100,
    offset = 0,
    sort = "",
    roleId = "",
  }: PagingParams & { groupId: string; sort?: string | null; roleId?: string | null }) => [
    "group",
    groupId,
    "members",
    {
      n: Number(n),
      offset: Number(offset),
      sort: sort ?? "",
      roleId: roleId ?? "",
    },
  ],
  groupGallery: ({ groupId, galleryId, n = 100, offset = 0 }: PagingParams & { groupId: string; galleryId: string }) => [
    "group",
    groupId,
    "gallery",
    galleryId,
    {
      n: Number(n),
      offset: Number(offset),
    },
  ],
  groupCalendar: (groupId: string) => ["group", groupId, "calendar"],
  groupCalendarEvent: ({ groupId, eventId }: { groupId: string; eventId: string }) => ["group", groupId, "calendarEvent", eventId],
  avatarGallery: (avatarId: string) => ["avatar", avatarId, "gallery"],
  worldsByUser: ({
    userId,
    n = 50,
    offset = 0,
    sort = "",
    order = "",
    user = "",
    releaseStatus = "",
    option = "",
  }: PagingParams & {
    userId: string;
    sort?: string | null;
    order?: string | null;
    user?: string | null;
    releaseStatus?: string | null;
    option?: string | null;
  }) => [
    "worlds",
    "user",
    userId,
    {
      n: Number(n),
      offset: Number(offset),
      sort: sort ?? "",
      order: order ?? "",
      user: user ?? "",
      releaseStatus: releaseStatus ?? "",
      option: option ?? "",
    },
  ],
  favoriteLimits: () => ["favorite", "limits"],
  userInventoryItem: ({ inventoryId, userId }: { inventoryId: string; userId: string }) => ["inventory", "item", userId, inventoryId],
  fileAnalysis: ({ fileId, version, variant }: { fileId: string; version: number | string; variant?: string | null }) => [
    "analysis",
    fileId,
    Number(version),
    variant ?? "",
  ],
  worldPersistData: (worldId: string) => ["world", worldId, "persistData"],
  mutualCounts: (userId: string) => ["user", userId, "mutualCounts"],
  visits: () => ["visits"],
  instanceCount: () => ["instances", "count"],
  file: (fileId: string) => ["file", fileId],
  avatarStyles: () => ["avatar", "styles"],
  representedGroup: (userId: string) => ["user", userId, "representedGroup"],
  vrchatCredits: () => ["credits"],
});
