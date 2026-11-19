import { database } from "../../services/database";
import { toStoredNotifications } from "./helpers";
import type { FriendRequestOutcome, StoredNotificationEntry } from "./types";

const FRIEND_REQUEST_TYPES = ["friendRequest", "ignoredFriendRequest"];
const FRIEND_REQUEST_HISTORY_LIMIT = 100000;
const OUTCOMES: readonly string[] = ["", "accepted", "declined", "autoDeclined"];

function isFriendRequestOutcome(value: unknown): value is FriendRequestOutcome {
  return typeof value === "string" && OUTCOMES.includes(value);
}

export function isFriendRequestType(type: string): boolean {
  return FRIEND_REQUEST_TYPES.includes(type);
}

export function restoreFriendRequestRecord(entry: StoredNotificationEntry): StoredNotificationEntry {
  if (!isFriendRequestType(entry.type)) {
    return entry;
  }
  const outcome = entry.details["responseMessage"];
  entry.$friendRequestOutcome = isFriendRequestOutcome(outcome) ? outcome : "";
  entry.$isExpired = true;
  return entry;
}

export async function loadFriendRequestHistory(): Promise<StoredNotificationEntry[]> {
  const rows = await database.lookupNotificationDatabase("", FRIEND_REQUEST_TYPES, [], FRIEND_REQUEST_HISTORY_LIMIT);
  return toStoredNotifications(rows).map(restoreFriendRequestRecord);
}

function shouldRecord(current: FriendRequestOutcome | undefined, next: FriendRequestOutcome): boolean {
  if (current === next) {
    return false;
  }
  if (current === undefined) {
    return true;
  }
  if (next === "") {
    return false;
  }
  return !(next === "declined" && current === "autoDeclined");
}

let pendingWrite: Promise<void> = Promise.resolve();

export function recordFriendRequest(entry: StoredNotificationEntry, outcome: FriendRequestOutcome): Promise<void> {
  if (!shouldRecord(entry.$friendRequestOutcome, outcome)) {
    return Promise.resolve();
  }
  entry.$friendRequestOutcome = outcome;
  const isDeclined = outcome === "declined" || outcome === "autoDeclined";
  const row = {
    id: entry.id,
    created_at: entry.created_at,
    type: isDeclined ? "ignoredFriendRequest" : "friendRequest",
    senderUserId: entry.senderUserId,
    senderUsername: entry.senderUsername,
    receiverUserId: entry.receiverUserId,
    message: entry.message,
    imageUrl: entry.imageUrl,
    details: { responseMessage: outcome },
    $isExpired: outcome !== "",
  };
  const replace = () => database.replaceNotificationInDatabase(row);
  const write = pendingWrite.then(replace, replace);
  pendingWrite = write;
  return write;
}
