import { database } from "../../services/database";
import type { StoredNotificationEntry } from "./types";

export type InviteReply = "invited" | "autoInvited";

const INVITE_REPLIES: readonly string[] = ["invited", "autoInvited"];

export function isInviteReply(value: unknown): value is InviteReply {
  return typeof value === "string" && INVITE_REPLIES.includes(value);
}

function detailText(entry: StoredNotificationEntry, key: string): string | undefined {
  const value = entry.details[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function recordInviteReply(entry: StoredNotificationEntry, reply: InviteReply, location: string, worldName: string): Promise<void> {
  entry.details = { ...entry.details, worldId: location, worldName, responseMessage: reply };
  entry.$isExpired = true;
  const imageUrl = detailText(entry, "imageUrl");
  const requestMessage = detailText(entry, "requestMessage");
  return database.replaceNotificationInDatabase({
    id: entry.id,
    created_at: entry.created_at,
    type: entry.type,
    senderUserId: entry.senderUserId,
    senderUsername: entry.senderUsername,
    receiverUserId: entry.receiverUserId,
    message: entry.message,
    imageUrl: entry.imageUrl,
    details: {
      worldId: location,
      worldName,
      responseMessage: reply,
      ...(imageUrl === undefined ? {} : { imageUrl }),
      ...(requestMessage === undefined ? {} : { requestMessage }),
    },
    $isExpired: true,
  });
}
