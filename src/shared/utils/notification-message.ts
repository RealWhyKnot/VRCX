import { displayLocation } from "./location-parser";
import { i18n } from "../../plugins/i18n";
import type { NotificationMessage, NotificationRecord } from "../../types/notification.ts";

import { parseNotificationDetails } from "./notification-transforms";

export type NotificationWithData = Omit<NotificationRecord, "data" | "details"> & {
  data?: unknown;
  details?: (Record<string, unknown> & { worldId?: string; worldName?: string }) | undefined;
};

export function hasNamedNotification(type: string) {
  return type === "boop" || type === "group.informative" || type === "group.invite" || type === "group.transfer" || type === "votetokick";
}

export function notificationName(noty: NotificationWithData, key: string): string | undefined {
  const value = parseNotificationDetails(noty.data)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function namedGroupBody(noty: NotificationWithData, key: string, translation: string): string | undefined {
  const name = notificationName(noty, key);
  const body = noty.message;
  if (!name || body?.includes(name) || noty.title?.includes(name)) return body;
  const attribution = i18n.global.t(translation, { name });
  return body ? `${attribution} ${body}` : attribution;
}

function pick(value: string | undefined, fallback: string | undefined): string | undefined {
  if (!value) {
    return fallback;
  }
  return value;
}

export function getNotificationMessage(
  noty: NotificationWithData,
  message: string | undefined,
  displayNameOverride?: string,
  resolveDisplayName?: (id: string) => string | undefined
): NotificationMessage | null {
  const name = pick(displayNameOverride, noty.displayName);
  const sender = pick(displayNameOverride, noty.senderUsername);
  const t = i18n.global.t;

  switch (noty.type) {
    case "OnPlayerJoined":
      return { title: name, body: t("notifications.has_joined") };
    case "OnPlayerLeft":
      return { title: name, body: t("notifications.has_left") };
    case "OnPlayerJoining":
      return { title: name, body: t("notifications.is_joining") };
    case "GPS":
      return {
        title: name,
        body: t("notifications.gps", {
          location: displayLocation(noty.location, noty.worldName, noty.groupName),
        }),
      };
    case "Online": {
      if (noty.worldName) {
        return {
          title: name,
          body: t("notifications.online_location", {
            location: displayLocation(noty.location, noty.worldName, noty.groupName),
          }),
        };
      }
      return {
        title: name,
        body: t("notifications.online"),
      };
    }
    case "Offline":
      return { title: name, body: t("notifications.offline") };
    case "Status":
      return {
        title: name,
        body: t("notifications.status_update", {
          status: noty.status,
          description: noty.statusDescription,
        }),
      };
    case "invite":
      return {
        title: sender,
        body: t("notifications.invite", {
          location: displayLocation(noty.details?.worldId, noty.details?.worldName),
          message,
        }),
      };
    case "requestInvite":
      return {
        title: sender,
        body: t("notifications.request_invite", { message }),
      };
    case "inviteResponse":
      return {
        title: sender,
        body: t("notifications.invite_response", { message }),
      };
    case "requestInviteResponse":
      return {
        title: sender,
        body: t("notifications.request_invite_response", { message }),
      };
    case "friendRequest":
      return {
        title: sender,
        body: t("notifications.friend_request"),
      };
    case "Friend":
      return { title: name, body: t("notifications.friend") };
    case "Unfriend":
      return {
        title: name,
        body: t("notifications.unfriend"),
      };
    case "TrustLevel":
      return {
        title: name,
        body: t("notifications.trust_level", {
          trustLevel: noty.trustLevel,
        }),
      };
    case "DisplayName":
      return {
        title: pick(displayNameOverride, noty.previousDisplayName),
        body: t("notifications.display_name", {
          displayName: noty.displayName,
        }),
      };
    case "boop":
      return { title: pick(displayNameOverride, notificationName(noty, "boopingUserDisplayName") ?? sender), body: noty.message };
    case "votetokick": {
      const { initiatorUserId, userToKickId } = noty.details ?? {};
      if (typeof initiatorUserId !== "string" || !initiatorUserId || typeof userToKickId !== "string" || !userToKickId) {
        return { title: noty.title, body: noty.message };
      }
      const initiator = resolveDisplayName?.(initiatorUserId) ?? (initiatorUserId === noty.senderUserId ? sender : undefined) ?? initiatorUserId;
      const target = resolveDisplayName?.(userToKickId) ?? userToKickId;
      return { title: noty.title, body: t("notifications.vote_to_kick", { initiator, target }) };
    }
    case "groupChange":
      return { title: sender, body: noty.message };
    case "group.announcement":
      return {
        title: pick(noty.title, t("notifications.group_announcement_title")),
        body: noty.message,
      };
    case "group.event.created":
      return {
        title: pick(noty.title, t("notifications.group_event_created_title")),
        body: noty.message,
      };
    case "group.event.starting":
      return {
        title: pick(noty.title, t("notifications.group_event_starting_title")),
        body: noty.message,
      };
    case "group.informative":
      return {
        title: pick(noty.title, t("notifications.group_informative_title")),
        body: namedGroupBody(noty, "transferTargetDisplayName", "notifications.group_transfer_target"),
      };
    case "group.invite":
      return {
        title: pick(noty.title, t("notifications.group_invite_title")),
        body: namedGroupBody(noty, "managerUserDisplayName", "notifications.group_invited_by"),
      };
    case "group.joinRequest":
      return {
        title: pick(noty.title, t("notifications.group_join_request_title")),
        body: noty.message,
      };
    case "group.transfer":
      return {
        title: pick(noty.title, t("notifications.group_transfer_request_title")),
        body: namedGroupBody(noty, "ownerUserDisplayName", "notifications.group_transfer_by"),
      };
    case "group.queueReady":
      return {
        title: pick(noty.title, t("notifications.group_queue_ready_title")),
        body: noty.message,
      };
    case "instance.closed":
      return {
        title: pick(noty.title, t("notifications.instance_closed_title")),
        body: noty.message,
      };
    case "PortalSpawn":
      if (name) {
        return {
          title: name,
          body: t("notifications.portal_spawn_name", {
            location: displayLocation(noty.instanceId, noty.worldName, noty.groupName),
          }),
        };
      }
      return { title: "", body: t("notifications.portal_spawn") };
    case "AvatarChange":
      return {
        title: name,
        body: t("notifications.avatar_change", { avatar: noty.name }),
      };
    case "ChatBoxMessage":
      return {
        title: name,
        body: t("notifications.chat_message", { message: noty.text }),
      };
    case "Event":
      return { title: "Event", body: typeof noty.data === "string" ? noty.data : undefined };
    case "External":
      return { title: "External", body: noty.message };
    case "VideoPlay":
      return { title: "Now playing", body: noty.notyName };
    case "BlockedOnPlayerJoined":
      return {
        title: name,
        body: t("notifications.blocked_player_joined"),
      };
    case "BlockedOnPlayerLeft":
      return {
        title: name,
        body: t("notifications.blocked_player_left"),
      };
    case "MutedOnPlayerJoined":
      return {
        title: name,
        body: t("notifications.muted_player_joined"),
      };
    case "MutedOnPlayerLeft":
      return {
        title: name,
        body: t("notifications.muted_player_left"),
      };
    case "Blocked":
      return { title: name, body: t("notifications.blocked") };
    case "Unblocked":
      return { title: name, body: t("notifications.unblocked") };
    case "Muted":
      return { title: name, body: t("notifications.muted") };
    case "Unmuted":
      return { title: name, body: t("notifications.unmuted") };
    default:
      return null;
  }
}

const BODY_ONLY_TYPES = new Set([
  "boop",
  "group.announcement",
  "group.informative",
  "group.invite",
  "group.joinRequest",
  "group.transfer",
  "group.queueReady",
  "instance.closed",
  "Event",
  "External",
]);

const COLON_SEPARATOR_TYPES = new Set(["groupChange", "VideoPlay"]);

const CUSTOM_FORMAT_MESSAGES = new Map<string, (title: string | undefined) => string>([
  ["BlockedOnPlayerJoined", (title) => `Blocked user ${String(title)} has joined`],
  ["BlockedOnPlayerLeft", (title) => `Blocked user ${String(title)} has left`],
  ["MutedOnPlayerJoined", (title) => `Muted user ${String(title)} has joined`],
  ["MutedOnPlayerLeft", (title) => `Muted user ${String(title)} has left`],
]);

export function toNotificationText(title: string | undefined, body: string | undefined, type: string): string | undefined {
  if (BODY_ONLY_TYPES.has(type)) {
    return body;
  }
  if (COLON_SEPARATOR_TYPES.has(type)) {
    return title ? `${title}: ${String(body)}` : body;
  }
  const customFmt = CUSTOM_FORMAT_MESSAGES.get(type);
  if (customFmt) {
    return customFmt(title);
  }
  return title ? `${title} ${String(body)}` : body;
}

export function getUserIdFromNoty(noty: NotificationWithData): string {
  return [noty.userId, noty.senderUserId, noty.sourceUserId].find((id) => id) ?? "";
}
