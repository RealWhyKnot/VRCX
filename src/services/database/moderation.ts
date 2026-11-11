import { cellNumber, cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type ModerationRecord = {
  userId: string | null;
  updatedAt: string | null;
  displayName: string | null;
  block: boolean;
  mute: boolean;
};

type ModerationWriteEntry = {
  userId: string;
  updatedAt: string | null;
  displayName: string | null;
  block: boolean;
  mute: boolean;
};

const moderation = {
  async getModeration(userId: string): Promise<Partial<ModerationRecord>> {
    const row = (await sqliteService.rows(DatabaseApi.GetModeration(userId))).at(-1);
    if (row === undefined) {
      return {};
    }
    return {
      userId: cellText(row[0]),
      updatedAt: cellText(row[1]),
      displayName: cellText(row[2]),
      block: cellNumber(row[3]) === 1,
      mute: cellNumber(row[4]) === 1,
    };
  },

  setModeration(entry: ModerationWriteEntry): void {
    void sqliteService.run(DatabaseApi.SetModeration(entry.userId, entry.updatedAt, entry.displayName, entry.block, entry.mute)).catch(logDatabaseError);
  },

  deleteModeration(userId: string): void {
    void sqliteService.run(DatabaseApi.DeleteModeration(userId)).catch(logDatabaseError);
  },
};

export { moderation };
