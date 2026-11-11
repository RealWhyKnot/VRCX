import type { QueryKey } from "@tanstack/vue-query";
import { logWebRequest, withQueryLog } from "../services/app-config";
import { queryClient } from "./client";
import { queryKeys } from "./keys";
import { toQueryOptions } from "./policies";

type Row = Record<string, unknown>;

type QueryLogRunner = <T>(fn: () => Promise<T>) => Promise<T>;

function isQueryLogRunner(value: unknown): value is QueryLogRunner {
  return typeof value === "function";
}

const queryLogRunnerValue: unknown = withQueryLog;
if (!isQueryLogRunner(queryLogRunnerValue)) {
  throw new TypeError("withQueryLog from services/app-config is not a function");
}
const runWithQueryLog: QueryLogRunner = queryLogRunnerValue;

type EntityQueryPolicy = {
  staleTime: number;
  gcTime: number;
  retry: number;
  refetchOnWindowFocus: boolean;
};

const RECENCY_FIELDS = [
  "updated_at",
  "updatedAt",
  "last_activity",
  "last_login",
  "memberCountSyncedAt",
  "$location_at",
  "$lastFetch",
  "$fetchedAt",
  "created_at",
  "createdAt",
];

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function getComparableEntity(data: unknown): Row | null {
  if (!isRow(data)) {
    return null;
  }
  if (isRow(data["ref"])) {
    return data["ref"];
  }
  if (isRow(data["json"]) && !Array.isArray(data["json"])) {
    return data["json"];
  }
  return data;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getRecencyTimestamp(data: unknown): number | null {
  const comparable = getComparableEntity(data);
  if (comparable === null) {
    return null;
  }

  for (const field of RECENCY_FIELDS) {
    const ts = parseTimestamp(comparable[field]);
    if (ts !== null) {
      return ts;
    }
  }

  return null;
}

function shouldReplaceCurrent(currentData: unknown, nextData: unknown): boolean {
  if (typeof currentData === "undefined") {
    return true;
  }

  const currentTs = getRecencyTimestamp(currentData);
  const nextTs = getRecencyTimestamp(nextData);

  if (currentTs !== null && nextTs !== null) {
    return nextTs >= currentTs;
  }

  if (currentTs !== null && nextTs === null) {
    return false;
  }

  return true;
}

function hasCompleteEntityData(data: unknown): boolean {
  if (!isRow(data)) {
    return false;
  }

  const params = data["params"];
  if (!isRow(params)) {
    return false;
  }

  const refId = isRow(data["ref"]) ? data["ref"]["id"] : undefined;
  const jsonId = isRow(data["json"]) ? data["json"]["id"] : undefined;

  return (
    Boolean(refId) ||
    Boolean(jsonId) ||
    Boolean(params["userId"]) ||
    Boolean(params["avatarId"]) ||
    Boolean(params["worldId"]) ||
    Boolean(params["groupId"]) ||
    Boolean(params["fileId"]) ||
    Boolean(params["printId"]) ||
    Boolean(params["inventoryId"])
  );
}

export function patchQueryDataWithRecency({ queryKey, nextData }: { queryKey: QueryKey; nextData: unknown }): void {
  queryClient.setQueryData(queryKey, (currentData: unknown) => {
    if (!shouldReplaceCurrent(currentData, nextData)) {
      return currentData;
    }
    return nextData;
  });
}

export async function fetchWithEntityPolicy<T>({
  queryKey,
  policy,
  queryFn,
  label,
}: {
  queryKey: QueryKey;
  policy: EntityQueryPolicy;
  queryFn: () => Promise<T>;
  label?: string;
}): Promise<{ data: T; cache: boolean }> {
  const queryState = queryClient.getQueryState(queryKey);
  const dataUpdatedAt = queryState?.dataUpdatedAt;
  const isFresh = Boolean(dataUpdatedAt) && policy.staleTime > 0 && Date.now() - (dataUpdatedAt ?? 0) < policy.staleTime;

  const data = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => runWithQueryLog(queryFn),
    ...toQueryOptions(policy),
  });

  const target = label === undefined || label === "" ? String(queryKey[0]) : label;
  if (isFresh) {
    logWebRequest("[QUERY CACHE HIT]", target, queryKey, data);
  } else {
    logWebRequest("[QUERY FETCH]", target, queryKey, data);
  }

  return {
    data,
    cache: isFresh,
  };
}

export async function refetchActiveEntityQuery(queryKey: QueryKey): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey,
    exact: true,
    refetchType: "active",
  });
}

export async function patchAndRefetchActiveQuery({ queryKey, nextData }: { queryKey: QueryKey; nextData: unknown }): Promise<void> {
  patchQueryDataWithRecency({ queryKey, nextData });
  await refetchActiveEntityQuery(queryKey);
}

export function patchUserFromEvent(ref: { id?: string } | undefined): void {
  if (!ref?.id) return;
  const queryKey = queryKeys.user(ref.id);
  const existing = queryClient.getQueryData(queryKey);
  if (!hasCompleteEntityData(existing)) return;
  patchQueryDataWithRecency({
    queryKey,
    nextData: {
      cache: false,
      json: ref,
      params: { userId: ref.id },
      ref,
    },
  });
}

export function patchAvatarFromEvent(ref: { id?: string } | undefined): void {
  if (!ref?.id) return;
  const queryKey = queryKeys.avatar(ref.id);
  const existing = queryClient.getQueryData(queryKey);
  if (!hasCompleteEntityData(existing)) return;
  patchQueryDataWithRecency({
    queryKey,
    nextData: {
      cache: false,
      json: ref,
      params: { avatarId: ref.id },
      ref,
    },
  });
}

export function patchWorldFromEvent(ref: { id?: string } | undefined): void {
  if (!ref?.id) return;
  const queryKey = queryKeys.world(ref.id);
  const existing = queryClient.getQueryData(queryKey);
  if (!hasCompleteEntityData(existing)) return;
  patchQueryDataWithRecency({
    queryKey,
    nextData: {
      cache: false,
      json: ref,
      params: { worldId: ref.id },
      ref,
    },
  });
}

export function patchGroupFromEvent(ref: { id?: string } | undefined): void {
  if (!ref?.id) return;

  const nextData = {
    cache: false,
    json: ref,
    params: { groupId: ref.id },
    ref,
  };

  const keyFalse = queryKeys.group(ref.id, false);
  const existingFalse = queryClient.getQueryData(keyFalse);
  if (hasCompleteEntityData(existingFalse)) {
    patchQueryDataWithRecency({
      queryKey: keyFalse,
      nextData,
    });
  }

  const keyTrue = queryKeys.group(ref.id, true);
  const existingTrue = queryClient.getQueryData(keyTrue);
  if (hasCompleteEntityData(existingTrue)) {
    patchQueryDataWithRecency({
      queryKey: keyTrue,
      nextData,
    });
  }
}

export const _entityCacheInternals = {
  hasCompleteEntityData,
  getRecencyTimestamp,
  shouldReplaceCurrent,
};
