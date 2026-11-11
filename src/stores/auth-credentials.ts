import type { CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";
import { configRepository } from "../services/config";
import { isStoredCredentials, type LoginParams, type StoredCredential, type StoredCredentials } from "./auth-types";

export function parseStoredCredentials(raw: string | null): StoredCredentials {
  const parsed: unknown = JSON.parse(raw ?? "null");
  if (!isStoredCredentials(parsed)) {
    throw new TypeError("savedCredentials is not a credential map");
  }
  return parsed;
}

export async function getAllSavedCredentials(): Promise<StoredCredentials> {
  let savedCredentials: StoredCredentials = {};
  try {
    savedCredentials = parseStoredCredentials(await configRepository.getString("savedCredentials", "{}"));
    let isEdited = false;
    for (const userId of Object.keys(savedCredentials)) {
      const entry = savedCredentials[userId];
      if (!entry) continue;
      if (entry.loginParmas) {
        entry.loginParams = entry.loginParmas;
        delete entry.loginParmas;
        isEdited = true;
      }

      const loginParams = entry.loginParams;
      if (!loginParams) {
        throw new TypeError("Saved credential has no login params");
      }
      if (!loginParams.endpoint) {
        loginParams.endpoint = "";
        isEdited = true;
      }
      if (!loginParams.websocket) {
        loginParams.websocket = "";
        isEdited = true;
      }
    }
    if (isEdited) {
      await configRepository.setString("savedCredentials", JSON.stringify(savedCredentials));
    }
  } catch (e) {
    console.error("Failed to get saved credentials:", e);
  }
  return savedCredentials;
}

export function requireLoginParams(entry: StoredCredential | undefined): LoginParams {
  const loginParams = entry?.loginParams;
  if (!loginParams) {
    throw new TypeError("Saved credential has no login params");
  }
  return {
    username: loginParams.username,
    password: loginParams.password,
    endpoint: loginParams.endpoint ?? "",
    websocket: loginParams.websocket ?? "",
  };
}

export function requireUser(entry: StoredCredential | undefined): Json<CurrentUser> {
  const user = entry?.user;
  if (!user) {
    throw new TypeError("Saved credential has no user");
  }
  return user;
}
