import { cellText } from "./cells.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type UserProfile = {
  userId: string | null;
  bio: string | null;
  bioLinks: string[];
  updatedAt: string | null;
};

type UserProfileWriteEntry = {
  id: string;
  bio: string | null;
  bioLinks: string[];
};

function parseBioLinks(value: string): string[] {
  let links: unknown;
  try {
    links = JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return [];
    }
    throw error;
  }
  return Array.isArray(links) ? links.filter((link): link is string => typeof link === "string") : [];
}

function parseRow(row: DatabaseRow): UserProfile {
  return {
    userId: cellText(row[0]),
    bio: cellText(row[1]),
    bioLinks: parseBioLinks(cellText(row[2]) ?? ""),
    updatedAt: cellText(row[3]),
  };
}

const userProfile = {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = (await sqliteService.rows(DatabaseApi.GetUserProfile(userId))).at(-1);
    return row === undefined ? null : parseRow(row);
  },

  async getAllUserProfiles(): Promise<UserProfile[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllUserProfiles());
    return rows.map(parseRow);
  },

  setUserProfile(profile: UserProfileWriteEntry): void {
    void sqliteService.run(DatabaseApi.SetUserProfile(profile.id, profile.bio, JSON.stringify(profile.bioLinks), new Date().toJSON())).catch(logDatabaseError);
  },

  deleteUserProfile(userId: string): void {
    void sqliteService.run(DatabaseApi.DeleteUserProfile(userId)).catch(logDatabaseError);
  },
};

export { userProfile, parseBioLinks };
