import type { VrcxInstance, VrcxUser } from "../types/vrcx";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSlimInstance(value: unknown): value is { instanceId: string; n_users: number } {
  return isRecord(value) && typeof value["instanceId"] === "string" && typeof value["n_users"] === "number";
}

export function isInstanceRef(value: unknown): value is Partial<VrcxInstance> {
  return isRecord(value);
}

export function isVrcxUser(value: unknown): value is VrcxUser {
  return isRecord(value);
}

export function isPhotonMember(value: unknown): value is { id?: string; displayName?: string } {
  return isRecord(value);
}

export function isPhotonJointime(value: unknown): value is { inVRMode: boolean | null; groupOnNameplate: string; canModerateInstance: boolean } {
  return isRecord(value);
}

export function isPhotonTimeout(value: unknown): value is { userId?: string; displayName?: string; time: number } {
  return isRecord(value);
}
