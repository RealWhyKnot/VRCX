import { toast } from "vue-sonner";

import { useAuthStore } from "../stores/auth";
import { useModalStore } from "../stores/modal";
import { useNotificationStore } from "../stores/notification";
import { useUpdateLoopStore } from "../stores/update-loop";
import { getCurrentUser } from "../coordinators/user-coordinator";
import { AppDebug, isApiLogSuppressed, logWebRequest } from "./app-config.ts";
import { i18n } from "../plugins/i18n";
import { statusCodes } from "../shared/constants/api.ts";
import type { RequestOptions } from "../types/vrcx";
import { watchState } from "./watch-state";

import { webApiService } from "./webapi.ts";

type ApiRequestInit = RequestOptions & { url: string };

type ApiResponse = { status: number; data?: string | null | undefined };

type ParsedApiResponse = { status: number; data?: unknown; hasApiError?: boolean; parseError?: boolean };

type PendingGetRequest = { req: Promise<unknown>; time: number };

type BulkPage = { json?: unknown; results?: unknown; hasNext?: unknown };

type BulkOptions<TParams, TPage extends BulkPage> = {
  fn?: (params: TParams) => Promise<TPage>;
  params: TParams;
  N?: number;
  limitParam?: string;
  handle?: (result: TPage) => void;
  done?: (succeeded: boolean) => void;
};

export type RequestError = Error & { status: number; endpoint: string | undefined };

const pendingGetRequests = new Map<string, PendingGetRequest>();
export const failedGetRequests = new Map<string, number>();

const t = i18n.global.t;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function readField(value: unknown, key: string): unknown {
  return isObjectLike(value) ? value[key] : undefined;
}

function apiErrorField(data: unknown, key: string): unknown {
  return readField(readField(data, "error"), key);
}

function logError(err: unknown): void {
  console.error(err);
}

function codeField(value: unknown, fallback: number): number {
  const code = readField(value, "status_code");
  return typeof code === "number" && code !== 0 ? code : fallback;
}

export function buildRequestInit(endpoint: string, options: RequestOptions = {}): ApiRequestInit {
  const init: ApiRequestInit = {
    url: `${AppDebug.endpointDomain}/${endpoint}`,
    method: "GET",
    ...options,
  };
  const { params } = init;
  if (init.method === "GET") {
    if (isObjectLike(params)) {
      const url = new URL(init.url);
      const { searchParams } = url;
      for (const key of Object.keys(params)) {
        searchParams.set(key, String(params[key]));
      }
      init.url = url.toString();
    }
  } else if (!(init.uploadImage || init.uploadFilePUT || init.uploadImageLegacy)) {
    init.headers = {
      "Content-Type": "application/json;charset=utf-8",
      ...init.headers,
    };
    init.body = isObjectLike(params) ? JSON.stringify(params) : "{}";
  }
  return init;
}

export function parseResponse(response: ApiResponse): ParsedApiResponse {
  if (!response.data) {
    return response;
  }
  try {
    const data: unknown = JSON.parse(response.data);
    if (readField(data, "error")) {
      return { status: response.status, data, hasApiError: true };
    }
    return { status: response.status, data };
  } catch {
    return { status: response.status, data: response.data, parseError: true };
  }
}

export function request(endpoint: string, options: RequestOptions): Promise<unknown> {
  const authStore = useAuthStore();
  const modalStore = useModalStore();
  const notificationStore = useNotificationStore();
  const updateLoopStore = useUpdateLoopStore();
  if (!watchState.isLoggedIn && endpoint.startsWith("/auth") && endpoint !== "config") {
    throw new Error(`API request blocked while logged out: ${endpoint}`);
  }
  const init = buildRequestInit(endpoint, options);
  if (init.method === "GET") {
    const lastRun = failedGetRequests.get(endpoint);
    if (lastRun !== undefined) {
      if (lastRun >= Date.now() - 900000) {
        $throw(-1, t("api.error.message.403_404_bailing_request"), endpoint);
      }
      failedGetRequests.delete(endpoint);
    }

    const pending = pendingGetRequests.get(init.url);
    if (pending !== undefined) {
      if (pending.time >= Date.now() - 10000) {
        return pending.req;
      }
      pendingGetRequests.delete(init.url);
    }
  }
  const req: Promise<unknown> = webApiService
    .execute(init)
    .catch((err: unknown) => {
      $throw(0, err, endpoint);
    })
    .then((response) => {
      if (!watchState.isLoggedIn && endpoint.startsWith("/auth") && endpoint !== "config") {
        throw new Error(`API request blocked while logged out: ${endpoint}`);
      }
      const parsed = parseResponse(response);
      if (!isApiLogSuppressed()) {
        const tag = `[API ${init.method}]`;
        if (!parsed.data) {
          logWebRequest(tag, endpoint, `(${parsed.status}) no data`);
        } else if (init.method === "PUT" || init.method === "POST") {
          logWebRequest(tag, endpoint, `(${parsed.status})`, init.params, parsed.data);
        } else {
          logWebRequest(tag, endpoint, `(${parsed.status})`, parsed.data);
        }
      }
      if (parsed.status === 403 && endpoint === "config") {
        modalStore
          .alert({
            description: t("api.error.message.vpn_in_use"),
            title: `403 ${t("api.error.message.login_error")}`,
          })
          .catch(logError);
        authStore.handleLogoutEvent().catch(logError);
        $throw(403, apiErrorField(parsed.data, "message") ?? "", endpoint);
      }
      if (parsed.hasApiError) {
        if (parsed.status === 401) {
          if (apiErrorField(parsed.data, "message") === '"Missing Credentials"') {
            authStore.handleAutoLogin().catch(logError);
            $throw(401, t("api.error.message.missing_credentials"), endpoint);
          } else if (apiErrorField(parsed.data, "message") === '"Unauthorized"' && endpoint !== "auth/user") {
            if (!authStore.twoFactorAuthDialogVisible) {
              getCurrentUser().catch(logError);
            }
            $throw(401, t("api.status_code.401"), endpoint);
          }
        }
        $throw(codeField(readField(parsed.data, "error"), 0), apiErrorField(parsed.data, "message"), endpoint);
      }
      if (parsed.parseError) {
        if (parsed.data === "ok") {
          return parsed;
        }
        console.error("JSON parse error for", endpoint);
        if (parsed.status === 200) {
          $throw(0, t("api.error.message.invalid_json_response"), endpoint);
        }
        if (parsed.status === 429 && init.url.endsWith("/instances/groups")) {
          updateLoopStore.setNextGroupInstanceRefresh(120);
          $throw(429, t("api.status_code.429"), endpoint);
        }
        if (parsed.status === 504 || parsed.status === 502) {
          $throw(parsed.status, parsed.data ?? "", endpoint);
        }
      }
      return parsed;
    })
    .then(({ data, status }) => {
      if (status === 200) {
        if (!data) {
          return data;
        }
        const success = readField(data, "success");
        const okText = readField(data, "OK");
        let text = "";
        if (isObjectLike(success)) {
          const message = readField(success, "message");
          if (typeof message === "string") {
            text = message;
          }
        } else if (typeof okText === "string") {
          text = okText;
        }
        if (text) {
          let toastText = text;
          if (options.customMsg) {
            toastText = options.customMsg;
          }
          toast.success(toastText);
        }
        return data;
      }
      if (init.method === "GET" && status === 404 && endpoint.startsWith("avatars/")) {
        $throw(404, apiErrorField(data, "message") ?? "", endpoint);
      }
      if (status === 404 && endpoint.endsWith("/persist/exists")) {
        return false;
      }
      if (status === 404 && endpoint.endsWith("/respond")) {
        return null;
      }
      if (init.method === "GET" && (status === 404 || status === 403) && !endpoint.startsWith("auth/user")) {
        failedGetRequests.set(endpoint, Date.now());
      }
      if (init.method === "GET" && status === 404 && endpoint.startsWith("users/") && endpoint.split("/").length - 1 === 1) {
        $throw(404, apiErrorField(data, "message") ?? "", endpoint);
      }
      if (status === 404 && endpoint.startsWith("invite/") && init.inviteId) {
        notificationStore.expireNotification(init.inviteId);
      }
      const apiError = readField(data, "error");
      if (isObjectLike(apiError)) {
        $throw(codeField(apiError, status), readField(apiError, "message"), endpoint);
      } else if (typeof apiError === "string") {
        $throw(codeField(data, status), apiError, endpoint);
      }
      $throw(status, data, endpoint);
    });
  if (init.method === "GET") {
    const clearPendingGetRequest = (): void => {
      pendingGetRequests.delete(init.url);
    };
    req.then(clearPendingGetRequest, clearPendingGetRequest);
    pendingGetRequests.set(init.url, {
      req,
      time: Date.now(),
    });
  }
  return req;
}

export function shouldIgnoreError(code: number, endpoint: string | undefined): boolean {
  if (
    (code === 404 || code === -1) &&
    typeof endpoint === "string" &&
    endpoint.split("/").length === 2 &&
    (endpoint.startsWith("users/") ||
      endpoint.startsWith("worlds/") ||
      endpoint.startsWith("avatars/") ||
      endpoint.startsWith("groups/") ||
      endpoint.startsWith("file/"))
  ) {
    return true;
  }
  if ((code === 403 || code === 404 || code === -1) && endpoint?.startsWith("instances/")) {
    return true;
  }
  if (endpoint?.startsWith("analysis/") || endpoint?.startsWith("auth/device/")) {
    return true;
  }
  if (endpoint?.endsWith("/mutuals") && (code === 403 || code === -1)) {
    return true;
  }
  if (endpoint?.endsWith("/see") && (code === 429 || code === -1)) {
    return true;
  }
  return false;
}

export function $throw(code: number, error: unknown, endpoint: string | undefined): never {
  const message: string[] = [];
  if (code > 0) {
    if (!Object.hasOwn(statusCodes, code)) {
      message.push(`${code}`);
    } else {
      const codeText = t(`api.status_code.${code}`);
      message.push(`${code} ${codeText}`);
    }
  }
  if (typeof error !== "undefined") {
    message.push(`${t("api.error.message.error_message")}: ${typeof error === "string" ? error : JSON.stringify(error)}`);
  }
  if (typeof endpoint !== "undefined") {
    message.push(`${t("api.error.message.endpoint")}: "${endpoint}"`);
  }
  const isErrorIgnored = shouldIgnoreError(code, endpoint);
  if ((code === 403 || code === 404 || code === -1) && endpoint?.includes("/mutuals/friends")) {
    message[1] = `${t("api.error.message.error_message")}: "${t("api.error.message.unavailable")}"`;
  }
  const text = message.join("\n");

  if (text.length && !isErrorIgnored) {
    toast.error(message[0] ?? "", {
      description: message.slice(1).join("\n"),
      position: "bottom-left",
    });
  }

  const e: RequestError = Object.assign(new Error(text), { status: code, endpoint });
  throw e;
}

export async function processBulk<TParams extends object, TPage extends BulkPage>(options: BulkOptions<TParams, TPage>): Promise<void> {
  const { fn, params: rawParams, N = -1, limitParam = "n", handle, done } = options;

  if (typeof fn !== "function") {
    return;
  }

  const rawOffset = readField(rawParams, "offset");
  let offset = typeof rawOffset === "number" ? rawOffset : 0;
  const pageSize = Number(readField(rawParams, limitParam));

  let totalFetched = 0;

  try {
    for (;;) {
      const result = await fn({ ...rawParams, offset });
      let batchSize = 0;
      if (Array.isArray(result.json)) {
        batchSize = result.json.length;
      } else if (Array.isArray(result.results)) {
        batchSize = result.results.length;
      } else {
        throw new Error("Invalid result format: expected an array in result.json or result.results");
      }

      if (typeof handle === "function") {
        handle(result);
      }
      if (batchSize === 0) {
        break;
      }
      if (typeof result.hasNext === "boolean" && !result.hasNext) {
        break;
      }

      if (N > 0) {
        totalFetched += batchSize;
        if (totalFetched >= N) {
          break;
        }
      } else if (N === 0) {
        if (batchSize < pageSize) {
          break;
        }
        totalFetched += batchSize;
      } else {
        totalFetched += batchSize;
      }
      offset += batchSize;
    }

    if (typeof done === "function") {
      done(true);
    }
  } catch (err) {
    console.error("Bulk processing error:", err);
    if (typeof done === "function") {
      done(false);
    }
  }
}
