import type { GameLogEntry } from "../stores/gameLog/types";

export type GameLogEvent =
  | { type: "location-destination"; dt: string; location: string }
  | { type: "location"; dt: string; location: string; worldName: string }
  | { type: "player-joined"; dt: string; displayName: string; userId?: string }
  | { type: "player-left"; dt: string; displayName: string; userId?: string }
  | { type: "portal-spawn"; dt: string }
  | { type: "nowplaying"; dt: string; data: string }
  | { type: "video-play"; dt: string; videoUrl: string }
  | { type: "video-sync"; timestamp: string }
  | { type: "resource-load-string"; dt: string; resourceUrl: string }
  | { type: "resource-load-image"; dt: string; resourceUrl: string }
  | { type: "screenshot"; screenshotPath: string }
  | { type: "api-request"; url: string }
  | { type: "avatar-change"; dt: string; displayName: string; avatarName: string; userId?: string }
  | { type: "vrcx"; dt: string; data: string }
  | { type: "photon-id"; displayName: string; photonId: string }
  | { type: "notification" }
  | { type: "event"; dt: string; event: string }
  | { type: "vrc-quit"; dt: string }
  | { type: "openvr-init" }
  | { type: "desktop-mode" }
  | { type: "udon-exception"; data: string }
  | { type: "sticker-spawn"; displayName: string; userId: string; inventoryId: string };

export function isGameLogEvent(value: unknown): value is GameLogEvent {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

export function isRawLogValue(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

export function isGameLogEntry(value: unknown): value is GameLogEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "created_at" in value &&
    typeof value.created_at === "string"
  );
}
