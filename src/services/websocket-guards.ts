import type { NotificationEntry } from "../stores/notification/types";
import { applyCurrentUser } from "../coordinators/current-user-apply";
import { applyUser } from "../coordinators/user-profile-apply";
import { handleGroupMember } from "../coordinators/group-coordinator";
import { AppDebug } from "./app-config";

export type UserUpdate = Parameters<typeof applyUser>[0];

type CurrentUserUpdate = Parameters<typeof applyCurrentUser>[0];

type GroupMemberUpdate = Parameters<typeof handleGroupMember>[0]["json"];

export type PipelineRecord = Record<string, unknown>;

export type PipelineMessage = { type: unknown; content: unknown; err: unknown };

export function isRecord(value: unknown): value is PipelineRecord {
  return typeof value === "object" && value !== null;
}

export function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isPipelineMessage(value: unknown): value is PipelineMessage {
  return isRecord(value);
}

export function isUserUpdate(value: unknown): value is UserUpdate {
  return isRecord(value);
}

export function isCurrentUserUpdate(value: unknown): value is CurrentUserUpdate {
  return isRecord(value);
}

export function isGroupMemberUpdate(value: unknown): value is GroupMemberUpdate {
  return isRecord(value);
}

export function isNotificationEntry(value: PipelineRecord): value is NotificationEntry {
  return stringField(value, "id") !== undefined && stringField(value, "type") !== undefined;
}

export function field(record: PipelineRecord, key: string): unknown {
  return record[key];
}

export function stringField(record: PipelineRecord, key: string): string | undefined {
  const value = field(record, key);
  return typeof value === "string" ? value : undefined;
}

export function numberField(record: PipelineRecord, key: string): number | undefined {
  const value = field(record, key);
  return typeof value === "number" ? value : undefined;
}

export function userWithId(record: PipelineRecord): UserUpdate | undefined {
  const user = field(record, "user");
  return isUserUpdate(user) && Boolean(user.id) ? user : undefined;
}

export function parsePipelineMessage(data: string): PipelineMessage {
  const json: unknown = JSON.parse(data);
  if (!isPipelineMessage(json)) {
    throw new Error("WebSocket message is not an object");
  }
  if (typeof json.content === "string") {
    try {
      const content: unknown = JSON.parse(json.content);
      json.content = content;
    } catch (err) {
      if (AppDebug.debugWebSocket) {
        console.log("WebSocket content is not JSON", err);
      }
    }
  }
  return json;
}
