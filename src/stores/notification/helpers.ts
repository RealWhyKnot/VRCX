import dayjs from "dayjs";

import type { NotificationEntry, StoredNotificationEntry } from "./types";

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isStoredNotification(entry: NotificationEntry): entry is StoredNotificationEntry {
  return typeof entry.id === "string";
}

function isStoredRow(value: unknown): value is StoredNotificationEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "created_at" in value &&
    typeof value.created_at === "string"
  );
}

export function toStoredNotifications(rows: unknown): StoredNotificationEntry[] {
  return Array.isArray(rows) ? rows.filter(isStoredRow) : [];
}

export function findStoredNotification(rows: NotificationEntry[], id: unknown): StoredNotificationEntry | undefined {
  return rows.find((row): row is StoredNotificationEntry => isStoredNotification(row) && row.id === id);
}

export function findLastStoredNotification(rows: NotificationEntry[], id: unknown): StoredNotificationEntry | undefined {
  return rows.findLast((row): row is StoredNotificationEntry => isStoredNotification(row) && row.id === id);
}

export function readMaxTableSize(limits: unknown): number {
  return typeof limits === "object" && limits !== null && "maxTableSize" in limits && typeof limits.maxTableSize === "number" ? limits.maxTableSize : 0;
}

export function hasBoopFields(entry: StoredNotificationEntry): entry is StoredNotificationEntry & { title: string; imageUrl: string } {
  return entry.title !== undefined && entry.imageUrl !== undefined;
}

export async function forEachNotificationPage<Row>(
  fetchPage: (params: { n: number; offset: number }) => Promise<{ json: Row[] }>,
  handleRow: (row: Row) => void
) {
  const params = {
    n: 100,
    offset: 0,
  };
  for (let i = 0; i < 50; i++) {
    const args = await fetchPage(params);
    for (const json of args.json) {
      handleRow(json);
    }
    params.offset += 100;
    if (args.json.length < 100) {
      break;
    }
  }
}

export function isNotificationExpired(notification: NotificationEntry) {
  if (notification.$isExpired !== undefined) {
    return notification.$isExpired;
  }
  if (!notification.expiresAt) {
    return false;
  }
  const expiresAt = dayjs(notification.expiresAt);
  return expiresAt.isValid() && dayjs().isSameOrAfter(expiresAt);
}
