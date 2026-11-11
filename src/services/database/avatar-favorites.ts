import { cellNumber, cellText } from "./cells.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type CacheEntry = {
  id: string;
  authorId: string | null;
  authorName: string | null;
  created_at: string | null;
  description: string | null;
  imageUrl: string | null;
  name: string | null;
  releaseStatus: string | null;
  thumbnailImageUrl: string | null;
  updated_at: string | null;
  version: number | null;
};

type CachedAvatar = {
  id: string | null;
  authorId: string | null;
  authorName: string | null;
  created_at: string | null;
  description: string | null;
  imageUrl: string | null;
  name: string | null;
  releaseStatus: string | null;
  thumbnailImageUrl: string | null;
  updated_at: string | null;
  version: number | null;
};

type AvatarHistoryEntry = CachedAvatar;

type AvatarTimeSpent = { timeSpent: number | null; avatarId: string };

function toCachedAvatar(row: DatabaseRow): CachedAvatar {
  return {
    id: cellText(row[0]),
    authorId: cellText(row[2]),
    authorName: cellText(row[3]),
    created_at: cellText(row[4]),
    description: cellText(row[5]),
    imageUrl: cellText(row[6]),
    name: cellText(row[7]),
    releaseStatus: cellText(row[8]),
    thumbnailImageUrl: cellText(row[9]),
    updated_at: cellText(row[10]),
    version: cellNumber(row[11]),
  };
}

function toAvatarHistoryEntry(row: DatabaseRow): AvatarHistoryEntry {
  return {
    id: cellText(row[0]),
    authorId: cellText(row[5]),
    authorName: cellText(row[6]),
    created_at: cellText(row[7]),
    description: cellText(row[8]),
    imageUrl: cellText(row[9]),
    name: cellText(row[10]),
    releaseStatus: cellText(row[11]),
    thumbnailImageUrl: cellText(row[12]),
    updated_at: cellText(row[13]),
    version: cellNumber(row[14]),
  };
}

const avatarFavorites = {
  addAvatarToCache(entry: CacheEntry): void {
    void sqliteService
      .run(
        DatabaseApi.AddAvatarToCache(
          entry.id,
          new Date().toJSON(),
          entry.authorId,
          entry.authorName,
          entry.created_at,
          entry.description,
          entry.imageUrl,
          entry.name,
          entry.releaseStatus,
          entry.thumbnailImageUrl,
          entry.updated_at,
          entry.version
        )
      )
      .catch(logDatabaseError);
  },

  addAvatarToHistory(avatarId: string): void {
    void sqliteService.run(DatabaseApi.AddAvatarToHistory(avatarId, new Date().toJSON())).catch(logDatabaseError).catch(logDatabaseError);
  },

  async getAvatarTimeSpent(avatarId: string): Promise<AvatarTimeSpent> {
    const row = (await sqliteService.rows(DatabaseApi.GetAvatarTimeSpent(avatarId))).at(-1);
    return { timeSpent: row === undefined ? 0 : cellNumber(row[0]), avatarId };
  },

  async getAllAvatarTimeSpent(): Promise<Map<string | null, number>> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllAvatarTimeSpent());
    const map = new Map<string | null, number>();
    for (const row of rows) {
      map.set(cellText(row[0]), cellNumber(row[1]) ?? 0);
    }
    return map;
  },

  addAvatarTimeSpent(avatarId: string, timeSpent: number): void {
    void sqliteService.run(DatabaseApi.AddAvatarTimeSpent(avatarId, timeSpent)).catch(logDatabaseError).catch(logDatabaseError);
  },

  async getAvatarHistory(currentUserId: string, limit = 100): Promise<AvatarHistoryEntry[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAvatarHistory(currentUserId, limit));
    return rows.map(toAvatarHistoryEntry);
  },

  async getCachedAvatarById(id: string): Promise<CachedAvatar | null> {
    const row = (await sqliteService.rows(DatabaseApi.GetCachedAvatarById(id))).at(-1);
    return row === undefined ? null : toCachedAvatar(row);
  },

  clearAvatarHistory(): void {
    void sqliteService.run(DatabaseApi.ClearAvatarHistory()).catch(logDatabaseError).catch(logDatabaseError);
  },

  addAvatarToFavorites(avatarId: string, groupName: string): void {
    void sqliteService
      .run(DatabaseApi.AddAvatarToFavorites(avatarId, groupName, new Date().toJSON()))
      .catch(logDatabaseError)
      .catch(logDatabaseError);
  },

  renameAvatarFavoriteGroup(newGroupName: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RenameAvatarFavoriteGroup(newGroupName, groupName)).catch(logDatabaseError).catch(logDatabaseError);
  },

  deleteAvatarFavoriteGroup(groupName: string): void {
    void sqliteService.run(DatabaseApi.DeleteAvatarFavoriteGroup(groupName)).catch(logDatabaseError).catch(logDatabaseError);
  },

  removeAvatarFromFavorites(avatarId: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RemoveAvatarFromFavorites(avatarId, groupName)).catch(logDatabaseError).catch(logDatabaseError);
  },

  async getAvatarFavorites(): Promise<{ created_at: string | null; avatarId: string | null; groupName: string | null }[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAvatarFavorites());
    return rows.map((row) => ({
      created_at: cellText(row[1]),
      avatarId: cellText(row[2]),
      groupName: cellText(row[3]),
    }));
  },

  removeAvatarFromCache(avatarId: string): void {
    void sqliteService.run(DatabaseApi.RemoveAvatarFromCache(avatarId)).catch(logDatabaseError).catch(logDatabaseError);
  },

  async getAvatarCache(): Promise<CachedAvatar[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAvatarCache());
    return rows.map(toCachedAvatar);
  },
};

export { avatarFavorites };
