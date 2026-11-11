import type { VrConfig, VrFeedItem, VrHudTimeoutItem, VrLastLocation, VrNowPlaying } from "./vr-types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseVrPayload<T>(json: string, label: string, isPayload: (value: unknown) => value is T): T {
  const value: unknown = JSON.parse(json);
  if (!isPayload(value)) {
    throw new Error(`The VR ${label} payload is not the expected JSON shape. Check the VRCX code that sends it.`);
  }
  return value;
}

export function isVrConfig(value: unknown): value is VrConfig {
  return isRecord(value);
}

export function isVrNowPlaying(value: unknown): value is VrNowPlaying {
  return isRecord(value);
}

export function isVrLastLocation(value: unknown): value is VrLastLocation {
  return isRecord(value);
}

export function isVrFeedItem(value: unknown): value is VrFeedItem {
  return isRecord(value);
}

export function isVrFeedList(value: unknown): value is VrFeedItem[] {
  return Array.isArray(value);
}

export function isVrHudTimeoutList(value: unknown): value is VrHudTimeoutItem[] {
  return Array.isArray(value);
}

export function isVrOverlayHandler(value: unknown): value is (json: string) => void {
  return typeof value === "function";
}
