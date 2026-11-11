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

type CachedWorld = {
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

function toCachedWorld(row: DatabaseRow): CachedWorld {
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

const worldFavorites = {
  addWorldToCache(entry: CacheEntry): void {
    void sqliteService
      .run(
        DatabaseApi.AddWorldToCache(
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

  addWorldToFavorites(worldId: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.AddWorldToFavorites(worldId, groupName, new Date().toJSON())).catch(logDatabaseError);
  },

  renameWorldFavoriteGroup(newGroupName: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RenameWorldFavoriteGroup(newGroupName, groupName)).catch(logDatabaseError);
  },

  deleteWorldFavoriteGroup(groupName: string): void {
    void sqliteService.run(DatabaseApi.DeleteWorldFavoriteGroup(groupName)).catch(logDatabaseError);
  },

  removeWorldFromFavorites(worldId: string, groupName: string): void {
    void sqliteService.run(DatabaseApi.RemoveWorldFromFavorites(worldId, groupName)).catch(logDatabaseError);
  },

  async getWorldFavorites(): Promise<{ created_at: string | null; worldId: string | null; groupName: string | null }[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetWorldFavorites());
    return rows.map((row) => ({
      created_at: cellText(row[1]),
      worldId: cellText(row[2]),
      groupName: cellText(row[3]),
    }));
  },

  removeWorldFromCache(worldId: string): void {
    void sqliteService.run(DatabaseApi.RemoveWorldFromCache(worldId)).catch(logDatabaseError);
  },

  async getWorldCache(): Promise<CachedWorld[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetWorldCache());
    return rows.map(toCachedWorld);
  },

  async getCachedWorldById(id: string): Promise<CachedWorld | null> {
    const row = (await sqliteService.rows(DatabaseApi.GetCachedWorldById(id))).at(-1);
    return row === undefined ? null : toCachedWorld(row);
  },
};

export { worldFavorites };
