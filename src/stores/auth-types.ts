import type { ApiConfig, CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";

export type LoginForm = {
  loading: boolean;
  username: string;
  password: string;
  endpoint: string;
  websocket: string;
  saveCredentials: boolean;
  lastUserLoggedIn: string;
};

export type PrimaryPasswordDialog = {
  visible: boolean;
  password: string;
  rePassword: string;
  beforeClose: (done: () => void) => void;
};

export type CachedPermissions = {
  maxUserStickers: number;
  maxUserEmoji: number;
  maxUserGallery: number;
  maxUserIcons: number;
  maxUserPrints: number;
};

export type LoginNetworkIssueHintState = {
  hinted: boolean;
  timestamps: number[];
  lastAttemptFingerprint: string;
};

export type LoginParams = {
  username: string;
  password: string;
  endpoint: string;
  websocket: string;
};

export type StoredLoginParams = {
  username: string;
  password: string;
  endpoint?: string;
  websocket?: string;
};

export type StoredCredential = {
  user?: Json<CurrentUser>;
  cookies?: string;
  loginParams?: StoredLoginParams;
  loginParmas?: StoredLoginParams;
};

export type StoredCredentials = Record<string, StoredCredential>;

export type CredentialsToSave = Partial<LoginParams>;

export type AuthLoginParams = {
  username: string;
  password: string;
  endpoint: string;
  websocket: string;
  saveCredentials?: boolean;
  cipher?: string;
};

export type AuthUserResponse = Json<CurrentUser> & { requiresTwoFactorAuth?: string[] };

export type AuthLoginResult = {
  json: AuthUserResponse;
  origin: boolean;
};

export type ModalPromptResult = {
  ok: boolean;
  value: string;
};

export type ModalOtpResult = {
  ok: boolean;
  reason: string;
  value: string;
};

export type CachedConfig = Partial<Json<ApiConfig>>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function isStoredLoginParams(value: unknown): value is StoredLoginParams {
  return (
    isRecord(value) &&
    typeof value["username"] === "string" &&
    typeof value["password"] === "string" &&
    isOptionalString(value["endpoint"]) &&
    isOptionalString(value["websocket"])
  );
}

export function isStoredCredential(value: unknown): value is StoredCredential {
  return (
    isRecord(value) &&
    (value["user"] === undefined || isRecord(value["user"])) &&
    isOptionalString(value["cookies"]) &&
    (value["loginParams"] === undefined || isStoredLoginParams(value["loginParams"])) &&
    (value["loginParmas"] === undefined || isStoredLoginParams(value["loginParmas"]))
  );
}

export function isStoredCredentials(value: unknown): value is StoredCredentials {
  return isRecord(value) && Object.values(value).every(isStoredCredential);
}

export function isAuthUserResponse(value: unknown): value is AuthUserResponse {
  return isRecord(value) && (typeof value["id"] === "string" || isStringArray(value["requiresTwoFactorAuth"]));
}

export function toPromptResult(value: unknown): ModalPromptResult {
  if (isRecord(value) && typeof value["ok"] === "boolean" && typeof value["value"] === "string") {
    return { ok: value["ok"], value: value["value"] };
  }
  throw new TypeError("Unexpected prompt result");
}

export function toOtpResult(value: unknown): ModalOtpResult {
  if (isRecord(value) && typeof value["ok"] === "boolean" && typeof value["reason"] === "string" && typeof value["value"] === "string") {
    return { ok: value["ok"], reason: value["reason"], value: value["value"] };
  }
  throw new TypeError("Unexpected OTP prompt result");
}

export function toConfirmOk(value: unknown): boolean {
  if (isRecord(value) && typeof value["ok"] === "boolean") {
    return value["ok"];
  }
  throw new TypeError("Unexpected confirm result");
}

export function toCipherText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  throw new TypeError("Encryption returned no text");
}

export function errorMessageIncludes(err: unknown, text: string): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const message: string = err.message;
  return message.includes(text);
}
