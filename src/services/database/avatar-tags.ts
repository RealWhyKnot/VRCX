import { cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";

type AvatarTag = { tag: string | null; color: string | null };
type AvatarTagEntry = { tag: string | null; color: string | null };

function colorOrNull(value: unknown): string | null {
  const color = cellText(value);
  return color === "" ? null : color;
}

const avatarTags = {
  async getAvatarTags(avatarId: string): Promise<AvatarTag[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAvatarTags(avatarId));
    return rows.map((row) => ({ tag: cellText(row[0]), color: colorOrNull(row[1]) }));
  },

  async getAllAvatarTags(): Promise<Map<string | null, AvatarTagEntry[]>> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllAvatarTags());
    const map = new Map<string | null, AvatarTagEntry[]>();
    for (const row of rows) {
      const avatarId = cellText(row[0]);
      const tags = map.get(avatarId) ?? [];
      tags.push({ tag: cellText(row[1]), color: colorOrNull(row[2]) });
      map.set(avatarId, tags);
    }
    return map;
  },

  async getAllDistinctTags(): Promise<(string | null)[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllDistinctTags());
    return rows.map((row) => cellText(row[0]));
  },

  async addAvatarTag(avatarId: string, tag: string, color: string | null = null): Promise<void> {
    await sqliteService.run(DatabaseApi.AddAvatarTag(avatarId, tag, color));
  },

  async updateAvatarTagColor(avatarId: string, tag: string, color: string | null): Promise<void> {
    await sqliteService.run(DatabaseApi.UpdateAvatarTagColor(avatarId, tag, color));
  },

  async removeAvatarTag(avatarId: string, tag: string): Promise<void> {
    await sqliteService.run(DatabaseApi.RemoveAvatarTag(avatarId, tag));
  },

  async removeAllAvatarTags(avatarId: string): Promise<void> {
    await sqliteService.run(DatabaseApi.RemoveAllAvatarTags(avatarId));
  },
};

export { avatarTags };
