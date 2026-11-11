import Noty from "noty";

import { escapeTag, escapeTagRecursive } from "../shared/utils/base/string";
import { displayLocation } from "../shared/utils/location-parser";

import { isRecord, isVrFeedItem, parseVrPayload } from "./vr-payload";
import type { VrFeedItem, VrState } from "./vr-types";

const NOTY_LAYOUTS = [
  "top",
  "topLeft",
  "topCenter",
  "topRight",
  "center",
  "centerLeft",
  "centerRight",
  "bottom",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
] satisfies Noty.Layout[];

function isNotyLayout(value: unknown): value is Noty.Layout {
  return typeof value === "string" && NOTY_LAYOUTS.some((layout) => layout === value);
}

type VrNotyPayload = {
  noty?: unknown;
  message?: string;
  image?: string;
};

function isVrNotyPayload(value: unknown): value is VrNotyPayload {
  return isRecord(value);
}

function buildNotyText(noty: VrFeedItem, message: string): string | undefined {
  const displayName = String(noty.displayName);
  switch (noty.type) {
    case "OnPlayerJoined":
      return `<strong>${displayName}</strong> has joined`;
    case "OnPlayerLeft":
      return `<strong>${displayName}</strong> has left`;
    case "OnPlayerJoining":
      return `<strong>${displayName}</strong> is joining`;
    case "GPS":
      return `<strong>${displayName}</strong> is in ${String(displayLocation(noty.location, noty.worldName, noty.groupName))}`;
    case "Online": {
      let locationName = "";
      if (noty.worldName) {
        locationName = ` to ${String(displayLocation(noty.location, noty.worldName, noty.groupName))}`;
      }
      return `<strong>${displayName}</strong> has logged in${locationName}`;
    }
    case "Offline":
      return `<strong>${displayName}</strong> has logged out`;
    case "Status":
      return `<strong>${displayName}</strong> status is now <i>${String(noty.status)}</i> ${String(noty.statusDescription)}`;
    case "invite":
      return `<strong>${String(noty.senderUsername)}</strong> has invited you to ${String(displayLocation(noty.details.worldId, noty.details.worldName, ""))}${message}`;
    case "requestInvite":
      return `<strong>${String(noty.senderUsername)}</strong> has requested an invite ${message}`;
    case "inviteResponse":
      return `<strong>${String(noty.senderUsername)}</strong> has responded to your invite ${message}`;
    case "requestInviteResponse":
      return `<strong>${String(noty.senderUsername)}</strong> has responded to your invite request ${message}`;
    case "friendRequest":
      return `<strong>${String(noty.senderUsername)}</strong> has sent you a friend request`;
    case "Friend":
      return `<strong>${displayName}</strong> is now your friend`;
    case "Unfriend":
      return `<strong>${displayName}</strong> is no longer your friend`;
    case "TrustLevel":
      return `<strong>${displayName}</strong> trust level is now ${String(noty.trustLevel)}`;
    case "DisplayName":
      return `<strong>${String(noty.previousDisplayName)}</strong> changed their name to ${displayName}`;
    case "boop":
      return noty.message;
    case "groupChange":
      return `<strong>${String(noty.senderUsername)}</strong> ${String(noty.message)}`;
    case "group.announcement":
    case "group.event.created":
    case "group.event.starting":
    case "group.informative":
    case "group.invite":
    case "group.joinRequest":
    case "group.transfer":
    case "group.queueReady":
    case "instance.closed":
      return noty.message;
    case "PortalSpawn":
      if (noty.displayName) {
        return `<strong>${displayName}</strong> has spawned a portal to ${String(displayLocation(noty.instanceId, noty.worldName, noty.groupName))}`;
      }
      return "User has spawned a portal";
    case "AvatarChange":
      return `<strong>${displayName}</strong> changed into avatar ${String(noty.name)}`;
    case "ChatBoxMessage":
      return `<strong>${displayName}</strong> said ${String(noty.text)}`;
    case "Event":
      return noty.data;
    case "External":
      return noty.message;
    case "VideoPlay":
      return `<strong>Now playing:</strong> ${String(noty.notyName)}`;
    case "BlockedOnPlayerJoined":
      return `Blocked user <strong>${displayName}</strong> has joined`;
    case "BlockedOnPlayerLeft":
      return `Blocked user <strong>${displayName}</strong> has left`;
    case "MutedOnPlayerJoined":
      return `Muted user <strong>${displayName}</strong> has joined`;
    case "MutedOnPlayerLeft":
      return `Muted user <strong>${displayName}</strong> has left`;
    case "Blocked":
      return `<strong>${displayName}</strong> has blocked you`;
    case "Unblocked":
      return `<strong>${displayName}</strong> has unblocked you`;
    case "Muted":
      return `<strong>${displayName}</strong> has muted you`;
    case "Unmuted":
      return `<strong>${displayName}</strong> has unmuted you`;
    case undefined:
    default:
      return undefined;
  }
}

export function playNoty(vrState: VrState, json: string): void {
  const payload = parseVrPayload(json, "noty", isVrNotyPayload);
  if (typeof payload.noty === "undefined") {
    console.error("noty is undefined");
    return;
  }
  const noty: unknown = escapeTagRecursive(payload.noty);
  const message = escapeTag(payload.message);
  const img = payload.image ? `<img class="noty-img" src="${payload.image}"></img>` : "";
  const text = isVrFeedItem(noty) ? buildNotyText(noty, message) : undefined;
  if (text) {
    const options: Noty.Options = {
      type: "alert",
      text: `${img}<div class="noty-text">${text}</div>`,
    };
    if (vrState.config.notificationTheme !== undefined) {
      options.theme = vrState.config.notificationTheme;
    }
    if (vrState.config.notificationTimeout !== undefined) {
      options.timeout = vrState.config.notificationTimeout;
    }
    const layout = vrState.config.notificationPosition;
    if (isNotyLayout(layout)) {
      options.layout = layout;
    }
    new Noty(options).show();
  }
}

export function notyClear(): void {
  Noty.closeAll();
}
