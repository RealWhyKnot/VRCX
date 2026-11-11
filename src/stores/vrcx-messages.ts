import type { PhotonEvent, PhotonOperationResponse, PhotonVrcEvent } from "./photon-types";

export type IpcVrcxMessage =
  | { MsgType: "CustomTag"; UserId: string; Tag: string; TagColour: string }
  | { MsgType: "ClearCustomTags" }
  | { MsgType: "Noty"; Data: string | null }
  | { MsgType: "External"; Data: string | null; DisplayName: string | null; notify: boolean | null; UserId: string | null };

export type IpcMessage =
  | { type: "OnEvent"; OnEventData: PhotonEvent; dt: string }
  | { type: "OnOperationResponse"; OnOperationResponseData: PhotonOperationResponse; dt: string }
  | { type: "OnOperationRequest"; OnOperationRequestData: { OperationCode: number; Parameters?: unknown } }
  | (PhotonVrcEvent & { type: "VRCEvent" })
  | { type: "Event7List"; Event7List: Record<string, string>; dt: string }
  | (IpcVrcxMessage & { type: "VrcxMessage" })
  | { type: "Ping" }
  | { type: "MsgPing"; version: number }
  | { type: "LaunchCommand"; command: string }
  | { type: "VRCXLaunch" };

export type RegistryBackup = {
  name: string;
  date: string;
  data: unknown;
};

type TaggedRecord = { type?: unknown; name?: unknown; date?: unknown };

function isRecord(value: unknown): value is TaggedRecord {
  return typeof value === "object" && value !== null;
}

export function isIpcMessage(value: unknown): value is IpcMessage {
  return isRecord(value) && typeof value.type === "string";
}

export function isAutoBackup(value: unknown): value is RegistryBackup {
  return isRecord(value) && value.name === "Auto Backup" && typeof value.date === "string";
}

export function parseRegistryBackups(json: string): unknown[] {
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? parsed : [];
}

export function parseLeadingInt(value: string | null | undefined): number {
  const match = /^\s*[+-]?\d+/.exec(value ?? "");
  return match ? Number(match[0]) : Number.NaN;
}

export function param254(parameters: unknown): unknown {
  return typeof parameters === "object" && parameters !== null && "254" in parameters ? parameters["254"] : undefined;
}

export function logError(err: unknown): void {
  console.error(err);
}
