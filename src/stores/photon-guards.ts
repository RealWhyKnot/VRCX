import type { PhotonLobbyUser, PhotonModerationRow, PhotonUserPayload, PhotonUserPayloadMap } from "./photon-types";

export function isPhotonUserPayload(value: unknown): value is PhotonUserPayload {
  return typeof value === "object" && value !== null;
}

export function isPhotonUserPayloadMap(value: unknown): value is PhotonUserPayloadMap {
  return typeof value === "object" && value !== null;
}

export function isPhotonLobbyUser(value: unknown): value is PhotonLobbyUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

export function isCustomUserTag(value: unknown): value is { colour?: string } {
  return typeof value === "object" && value !== null && (!("colour" in value) || typeof value.colour === "string");
}

export function isPromptResult(value: unknown): value is { ok: boolean; value?: string } {
  return typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean";
}

export function isCacheHit(value: unknown): boolean {
  return typeof value === "object" && value !== null && "Item1" in value && typeof value.Item1 === "number" && value.Item1 > 0;
}

export function isModerationRow(value: unknown): value is PhotonModerationRow {
  return typeof value === "object" && value !== null;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((item: unknown) => typeof item === "string");
}

export function isPhotonIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "number");
}
