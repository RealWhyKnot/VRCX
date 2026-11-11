import { database } from "../services/database";
import { field, isRecord, stringField } from "../services/websocket-guards";
import type { PipelineRecord } from "../services/websocket-guards";
import { useGameLogStore } from "../stores/gameLog";
import { useNotificationStore } from "../stores/notification";
import { useUserStore } from "../stores/user";
import { getCurrentUser } from "./user-coordinator";

export type BadgeEventType = "user-badge-assigned" | "user-badge-unassigned";

function assignedBadgeName(record: PipelineRecord): string | undefined {
  const badge = field(record, "badge");
  if (!isRecord(badge)) {
    return undefined;
  }
  return stringField(badge, "badgeName") ?? stringField(badge, "badgeId");
}

function unassignedBadgeName(record: PipelineRecord): string | undefined {
  const badgeId = stringField(record, "badgeId");
  if (!badgeId) {
    return undefined;
  }
  const owned = useUserStore().currentUser.badges.find((badge) => badge.badgeId === badgeId);
  return owned?.badgeName ?? badgeId;
}

export function badgeEventMessage(type: BadgeEventType, record: PipelineRecord): string | undefined {
  if (type === "user-badge-assigned") {
    const name = assignedBadgeName(record);
    return name ? `Badge earned: ${name}` : undefined;
  }
  const name = unassignedBadgeName(record);
  return name ? `Badge removed: ${name}` : undefined;
}

export async function runBadgeEventFlow(type: BadgeEventType, record: PipelineRecord): Promise<void> {
  const message = badgeEventMessage(type, record);
  if (!message) {
    return;
  }
  const entry = {
    created_at: new Date().toJSON(),
    type: "Event",
    data: message,
  };
  useNotificationStore().queueGameLogNoty(entry);
  const persistedEntry = await database.addGamelogEventToDatabase(entry);
  if (persistedEntry) {
    useGameLogStore().addGameLog(persistedEntry);
  }
  await getCurrentUser();
}
