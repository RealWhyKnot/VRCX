import dayjs from "dayjs";

const FRIEND_TYPES = new Set<string>(["friendRequest", "ignoredFriendRequest", "invite", "requestInvite", "inviteResponse", "requestInviteResponse", "boop"]);
const GROUP_TYPES_PREFIX: readonly string[] = ["group.", "moderation."];
const GROUP_EXACT_TYPES = new Set<string>(["groupChange", "event.announcement"]);

type NotificationCategory = "friend" | "group" | "other";

type NotificationTimestampSource = {
  created_at?: unknown;
  createdAt?: unknown;
};

function getNotificationCategory(type: string | null | undefined): NotificationCategory {
  if (!type) return "other";
  if (FRIEND_TYPES.has(type)) return "friend";
  if (GROUP_EXACT_TYPES.has(type) || GROUP_TYPES_PREFIX.some((p) => type.startsWith(p))) return "group";
  return "other";
}

function isDateInput(value: unknown): value is string | Date | null | undefined {
  return value === undefined || value === null || typeof value === "string" || value instanceof Date;
}

function getNotificationTs(n: NotificationTimestampSource): number {
  const raw = n.created_at ?? n.createdAt;
  if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
  const ts = isDateInput(raw) ? dayjs(raw).valueOf() : Number.NaN;
  return Number.isFinite(ts) ? ts : 0;
}

export { FRIEND_TYPES, GROUP_TYPES_PREFIX, GROUP_EXACT_TYPES, getNotificationCategory, getNotificationTs };
