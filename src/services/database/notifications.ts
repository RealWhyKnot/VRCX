import { dbVars } from "../database";

import { cellNumber, cellText } from "./cells.ts";
import { sqliteService } from "../sqlite.ts";
import type { DatabaseRow } from "../sqlite.ts";

type NotificationDetailsRow = {
  worldId: string | null;
  worldName: string | null;
  imageUrl: string | null;
  inviteMessage: string | null;
  requestMessage: string | null;
  responseMessage: string | null;
};

type NotificationRow = {
  id: string | null;
  created_at: string | null;
  type: string | null;
  senderUserId: string | null;
  senderUsername: string | null;
  receiverUserId: string | null;
  message: string | null;
  details: NotificationDetailsRow;
  $isExpired: boolean;
};

type NotificationV2Row = {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  type: string | null;
  link: string | null;
  linkText: string | null;
  message: string | null;
  title: string | null;
  imageUrl: string | null;
  seen: boolean;
  senderUserId: string | null;
  senderUsername: string | null;
  data: unknown;
  responses: unknown;
  details: unknown;
  created_at: string | null;
  version: number;
};

type NotificationDetailsInput = {
  worldId?: string;
  worldName?: string;
  imageUrl?: string;
  inviteMessage?: string;
  requestMessage?: string;
  responseMessage?: string;
};

type NotificationInput = {
  id?: string;
  created_at?: string;
  type?: string;
  senderUserId?: string;
  senderUsername?: string;
  receiverUserId?: string;
  message?: string;
  imageUrl?: string;
  details?: NotificationDetailsInput;
  $isExpired?: boolean;
};

type NotificationV2Input = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  type?: string;
  link?: string;
  linkText?: string;
  message?: string;
  title?: string;
  imageUrl?: string;
  seen?: boolean;
  senderUserId?: string;
  senderUsername?: string;
  data?: unknown;
  responses?: unknown;
  details?: unknown;
};

function logDatabaseError(error: unknown): void {
  console.error(error);
}

function parseJsonCell(cell: unknown, fallback: string): unknown {
  const text = cellText(cell) ?? "";
  const parsed: unknown = JSON.parse(text.length > 0 ? text : fallback);
  return parsed;
}

function mapNotificationRow(row: DatabaseRow): NotificationRow {
  return {
    id: cellText(row[0]),
    created_at: cellText(row[1]),
    type: cellText(row[2]),
    senderUserId: cellText(row[3]),
    senderUsername: cellText(row[4]),
    receiverUserId: cellText(row[5]),
    message: cellText(row[6]),
    details: {
      worldId: cellText(row[7]),
      worldName: cellText(row[8]),
      imageUrl: cellText(row[9]),
      inviteMessage: cellText(row[10]),
      requestMessage: cellText(row[11]),
      responseMessage: cellText(row[12]),
    },
    $isExpired: cellNumber(row[13]) === 1,
  };
}

function mapNotificationV2Row(row: DatabaseRow): NotificationV2Row {
  const createdAt = cellText(row[1]);
  return {
    id: cellText(row[0]),
    createdAt,
    updatedAt: cellText(row[2]),
    expiresAt: cellText(row[3]),
    type: cellText(row[4]),
    link: cellText(row[5]),
    linkText: cellText(row[6]),
    message: cellText(row[7]),
    title: cellText(row[8]),
    imageUrl: cellText(row[9]),
    seen: cellNumber(row[10]) === 1,
    senderUserId: cellText(row[11]),
    senderUsername: cellText(row[12]),
    data: parseJsonCell(row[13], "{}"),
    responses: parseJsonCell(row[14], "[]"),
    details: parseJsonCell(row[15], "{}"),
    created_at: createdAt,
    version: 2,
  };
}

const notifications = {
  async getNotifications(): Promise<NotificationRow[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetNotifications(dbVars.maxTableSize));
    return rows.map(mapNotificationRow).reverse();
  },

  async lookupNotificationDatabase(search: string, filters: string[], vipList: string[], maxEntries = dbVars.maxTableSize): Promise<NotificationRow[]> {
    const rows = await sqliteService.rows(DatabaseApi.LookupNotifications(search, filters, vipList, maxEntries));
    return rows.map(mapNotificationRow).reverse();
  },

  addNotificationToDatabase(row: NotificationInput): void {
    const id = row.id ?? "";
    const createdAt = row.created_at ?? "";
    const type = row.type ?? "";
    if (!createdAt || !type || !id) {
      console.error("Notification is missing required field", row);
      throw new Error("Notification is missing required field");
    }
    const detailsImageUrl = row.details?.imageUrl ?? "";
    void sqliteService
      .run(
        DatabaseApi.AddNotification(
          id,
          createdAt,
          type,
          row.senderUserId ?? "",
          row.senderUsername ?? "",
          row.receiverUserId ?? "",
          row.message ?? "",
          row.details?.worldId ?? "",
          row.details?.worldName ?? "",
          detailsImageUrl.length > 0 ? detailsImageUrl : (row.imageUrl ?? ""),
          row.details?.inviteMessage ?? "",
          row.details?.requestMessage ?? "",
          row.details?.responseMessage ?? "",
          row.$isExpired === true
        )
      )
      .catch(logDatabaseError);
  },

  deleteNotification(rowId: string): void {
    void sqliteService.run(DatabaseApi.DeleteNotification(rowId)).catch(logDatabaseError);
  },

  updateNotificationExpired(entry: { id: string; $isExpired?: boolean }): void {
    void sqliteService.run(DatabaseApi.UpdateNotificationExpired(entry.id, entry.$isExpired === true)).catch(logDatabaseError);
  },

  async getNotificationsV2(): Promise<NotificationV2Row[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetNotificationsV2(dbVars.maxTableSize));
    return rows.map(mapNotificationV2Row).reverse();
  },

  addNotificationV2ToDatabase(entry: NotificationV2Input): void {
    void sqliteService
      .run(
        DatabaseApi.AddNotificationV2(
          entry.id,
          entry.createdAt ?? null,
          entry.updatedAt ?? null,
          entry.expiresAt ?? null,
          entry.type ?? null,
          entry.link ?? null,
          entry.linkText ?? null,
          entry.message ?? null,
          entry.title ?? null,
          entry.imageUrl ?? null,
          entry.seen === true,
          entry.senderUserId ?? null,
          entry.senderUsername ?? null,
          JSON.stringify(entry.data ?? {}),
          JSON.stringify(entry.responses ?? []),
          JSON.stringify(entry.details ?? {})
        )
      )
      .catch(logDatabaseError);
  },

  expireNotificationV2(id: string): void {
    void sqliteService.run(DatabaseApi.ExpireNotificationV2(id, new Date().toJSON())).catch(logDatabaseError);
  },

  seenNotificationV2(id: string): void {
    void sqliteService.run(DatabaseApi.SeenNotificationV2(id)).catch(logDatabaseError);
  },

  deleteNotificationV2(id: string): void {
    void sqliteService.run(DatabaseApi.DeleteNotificationV2(id)).catch(logDatabaseError);
  },
};

export { notifications };
