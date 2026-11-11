import { cellText } from "./cells.ts";

import { sqliteService, type DatabaseRow } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

type UserMemo = { userId: string | null; editedAt: string | null; memo: string | null };
type WorldMemo = { worldId: string | null; editedAt: string | null; memo: string | null };
type AvatarMemo = { avatarId: string | null; editedAt: string | null; memo: string | null };
type UserMemoListItem = { userId: string | null; memo: string | null };
type UserNote = { userId: string | null; displayName: string | null; note: string | null; createdAt: string | null };

type UserMemoEntry = { userId: string; editedAt: string; memo: string | null };
type WorldMemoEntry = { worldId: string; editedAt: string; memo: string | null };
type AvatarMemoEntry = { avatarId: string; editedAt: string; memo: string | null };
type UserNoteEntry = { userId: string; displayName: string | null; note: string | null; createdAt: string };

function toUserMemo(row: DatabaseRow): UserMemo {
  return { userId: cellText(row[0]), editedAt: cellText(row[1]), memo: cellText(row[2]) };
}

function toWorldMemo(row: DatabaseRow): WorldMemo {
  return { worldId: cellText(row[0]), editedAt: cellText(row[1]), memo: cellText(row[2]) };
}

function toAvatarMemo(row: DatabaseRow): AvatarMemo {
  return { avatarId: cellText(row[0]), editedAt: cellText(row[1]), memo: cellText(row[2]) };
}

const memos = {
  async getUserMemo(userId: string): Promise<Partial<UserMemo>> {
    const row = (await sqliteService.rows(DatabaseApi.GetUserMemo(userId))).at(-1);
    return row === undefined ? {} : toUserMemo(row);
  },

  async getAllUserMemos(): Promise<UserMemoListItem[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllUserMemos());
    return rows.map((row) => ({ userId: cellText(row[0]), memo: cellText(row[1]) }));
  },

  async setUserMemo(entry: UserMemoEntry): Promise<void> {
    await sqliteService.run(DatabaseApi.SetUserMemo(entry.userId, entry.editedAt, entry.memo));
  },

  async deleteUserMemo(userId: string): Promise<void> {
    await sqliteService.run(DatabaseApi.DeleteUserMemo(userId));
  },

  async getWorldMemo(worldId: string): Promise<Partial<WorldMemo>> {
    const row = (await sqliteService.rows(DatabaseApi.GetWorldMemo(worldId))).at(-1);
    return row === undefined ? {} : toWorldMemo(row);
  },

  setWorldMemo(entry: WorldMemoEntry): void {
    void sqliteService
      .run(DatabaseApi.SetWorldMemo(entry.worldId, entry.editedAt, entry.memo))
      .catch(logDatabaseError)
      .catch(logDatabaseError);
  },

  deleteWorldMemo(worldId: string): void {
    void sqliteService.run(DatabaseApi.DeleteWorldMemo(worldId)).catch(logDatabaseError).catch(logDatabaseError);
  },

  async getAvatarMemoDB(avatarId: string): Promise<Partial<AvatarMemo>> {
    const row = (await sqliteService.rows(DatabaseApi.GetAvatarMemo(avatarId))).at(-1);
    return row === undefined ? {} : toAvatarMemo(row);
  },

  setAvatarMemo(entry: AvatarMemoEntry): void {
    void sqliteService
      .run(DatabaseApi.SetAvatarMemo(entry.avatarId, entry.editedAt, entry.memo))
      .catch(logDatabaseError)
      .catch(logDatabaseError);
  },

  deleteAvatarMemo(avatarId: string): void {
    void sqliteService.run(DatabaseApi.DeleteAvatarMemo(avatarId)).catch(logDatabaseError).catch(logDatabaseError);
  },

  addUserNote(note: UserNoteEntry): Promise<void> {
    void sqliteService
      .run(DatabaseApi.AddUserNote(note.userId, note.displayName, note.note, note.createdAt))
      .catch(logDatabaseError)
      .catch(logDatabaseError);
    return Promise.resolve();
  },

  async getAllUserNotes(): Promise<UserNote[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetAllUserNotes());
    return rows.map((row) => ({
      userId: cellText(row[0]),
      displayName: cellText(row[1]),
      note: cellText(row[2]),
      createdAt: cellText(row[3]),
    }));
  },

  deleteUserNote(userId: string): void {
    void sqliteService.run(DatabaseApi.DeleteUserNote(userId)).catch(logDatabaseError).catch(logDatabaseError);
  },
};

export { memos };
