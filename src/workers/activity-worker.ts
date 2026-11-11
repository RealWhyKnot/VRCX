import {
  buildDailySummary,
  buildSessionsFromEvents,
  buildSessionsFromGamelog,
  buildHeatmapBuckets,
  buildOverlapBuckets,
  computeActivityView,
  computeOverlapView,
  normalizeBuckets,
} from "../shared/utils/activity-engine.ts";
import type { ActivityEvent, ActivityExcludeHours, ActivityNormalizeConfig, ActivitySession, GamelogSessionRow } from "../types/activity.ts";

type WorkerEnvelope = { type: string; seq: number; payload: unknown };

type SnapshotInput = {
  sourceType: string;
  sourceRevision: string;
  rows: GamelogSessionRow[];
  events: ActivityEvent[];
  initialStart: number | null;
  mergeGapMs: number | undefined;
  nowMs: number | undefined;
  mayHaveOpenTail: boolean;
};

type ActivityViewInput = {
  sessions: ActivitySession[];
  dayLabels: string[];
  rangeDays: number;
  nowMs: number | undefined;
  normalizeConfig: ActivityNormalizeConfig;
  maxSessionMs: number | undefined;
};

type OverlapViewInput = {
  selfSessions: ActivitySession[];
  targetSessions: ActivitySession[];
  dayLabels: string[];
  rangeDays: number;
  excludeHours: ActivityExcludeHours | null;
  nowMs: number | undefined;
  normalizeConfig: ActivityNormalizeConfig;
  maxSessionMs: number | undefined;
};

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(data: unknown): WorkerEnvelope {
  if (!isFields(data) || typeof data.type !== "string" || typeof data.seq !== "number") {
    throw new Error("Activity worker received a malformed message");
  }
  return { type: data.type, seq: data.seq, payload: data.payload };
}

function requireFields(payload: unknown, task: string): Fields {
  if (!isFields(payload)) {
    throw new Error(`Activity worker task ${task} needs an object payload`);
  }
  return payload;
}

function requireString(fields: Fields, key: string): string {
  const value = fields[key];
  if (typeof value !== "string") {
    throw new Error(`Activity worker payload field ${key} must be a string`);
  }
  return value;
}

function requireNumber(fields: Fields, key: string): number {
  const value = fields[key];
  if (typeof value !== "number") {
    throw new Error(`Activity worker payload field ${key} must be a number`);
  }
  return value;
}

function optionalNumber(fields: Fields, key: string): number | undefined {
  const value = fields[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`Activity worker payload field ${key} must be a number`);
  }
  return value;
}

function optionalNullableNumber(fields: Fields, key: string): number | null | undefined {
  const value = fields[key];
  if (value === null) {
    return null;
  }
  return optionalNumber(fields, key);
}

function optionalArray<T>(fields: Fields, key: string, guard: (value: unknown) => value is T): T[] {
  const value = fields[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    if (items.every(guard)) {
      return items;
    }
  }
  throw new Error(`Activity worker payload field ${key} has an invalid entry`);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isActivitySession(value: unknown): value is ActivitySession {
  if (!isFields(value)) {
    return false;
  }
  return (
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    (value.isOpenTail === undefined || typeof value.isOpenTail === "boolean") &&
    (value.sourceRevision === undefined || typeof value.sourceRevision === "string")
  );
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  return isFields(value) && typeof value.created_at === "string" && typeof value.type === "string";
}

function isGamelogSessionRow(value: unknown): value is GamelogSessionRow {
  return isFields(value) && typeof value.created_at === "string" && (value.time === undefined || value.time === null || typeof value.time === "number");
}

function parseNormalizeConfig(value: unknown): ActivityNormalizeConfig {
  if (value === undefined || value === null) {
    return {};
  }
  const fields = requireFields(value, "normalizeConfig");
  return {
    floorPercentile: optionalNumber(fields, "floorPercentile"),
    capPercentile: optionalNumber(fields, "capPercentile"),
    rankWeight: optionalNumber(fields, "rankWeight"),
    targetCoverage: optionalNumber(fields, "targetCoverage"),
    targetVolume: optionalNumber(fields, "targetVolume"),
    rangeDays: optionalNumber(fields, "rangeDays"),
  };
}

function parseExcludeHours(value: unknown): ActivityExcludeHours | null {
  if (value === undefined || value === null) {
    return null;
  }
  const fields = requireFields(value, "excludeHours");
  return { startHour: requireNumber(fields, "startHour"), endHour: requireNumber(fields, "endHour") };
}

function parseSnapshotInput(payload: unknown): SnapshotInput {
  const fields = requireFields(payload, "computeSessionsSnapshot");
  return {
    sourceType: requireString(fields, "sourceType"),
    sourceRevision: typeof fields.sourceRevision === "string" ? fields.sourceRevision : "",
    rows: optionalArray(fields, "rows", isGamelogSessionRow),
    events: optionalArray(fields, "events", isActivityEvent),
    initialStart: optionalNullableNumber(fields, "initialStart") ?? null,
    mergeGapMs: optionalNumber(fields, "mergeGapMs"),
    nowMs: optionalNumber(fields, "nowMs"),
    mayHaveOpenTail: fields.mayHaveOpenTail === true,
  };
}

function parseActivityViewInput(payload: unknown): ActivityViewInput {
  const fields = requireFields(payload, "computeActivityView");
  return {
    sessions: optionalArray(fields, "sessions", isActivitySession),
    dayLabels: optionalArray(fields, "dayLabels", isString),
    rangeDays: requireNumber(fields, "rangeDays"),
    nowMs: optionalNumber(fields, "nowMs"),
    normalizeConfig: parseNormalizeConfig(fields.normalizeConfig),
    maxSessionMs: optionalNumber(fields, "maxSessionMs"),
  };
}

function parseOverlapViewInput(payload: unknown): OverlapViewInput {
  const fields = requireFields(payload, "computeOverlapView");
  return {
    selfSessions: optionalArray(fields, "selfSessions", isActivitySession),
    targetSessions: optionalArray(fields, "targetSessions", isActivitySession),
    dayLabels: optionalArray(fields, "dayLabels", isString),
    rangeDays: requireNumber(fields, "rangeDays"),
    excludeHours: parseExcludeHours(fields.excludeHours),
    nowMs: optionalNumber(fields, "nowMs"),
    normalizeConfig: parseNormalizeConfig(fields.normalizeConfig),
    maxSessionMs: optionalNumber(fields, "maxSessionMs"),
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

self.addEventListener("message", (event) => {
  const { type, seq, payload } = parseEnvelope(event.data);

  try {
    let result: unknown;
    switch (type) {
      case "computeSessionsSnapshot":
        result = computeSessionsSnapshot(parseSnapshotInput(payload));
        break;
      case "computeActivityView": {
        const input = parseActivityViewInput(payload);
        result = computeActivityView({
          sessions: input.sessions,
          dayLabels: input.dayLabels,
          rangeDays: input.rangeDays,
          nowMs: input.nowMs,
          normalizeConfig: input.normalizeConfig,
          maxSessionMs: input.maxSessionMs,
        });
        break;
      }
      case "computeOverlapView": {
        const input = parseOverlapViewInput(payload);
        result = computeOverlapView({
          selfSessions: input.selfSessions,
          targetSessions: input.targetSessions,
          dayLabels: input.dayLabels,
          rangeDays: input.rangeDays,
          excludeHours: input.excludeHours,
          nowMs: input.nowMs,
          normalizeConfig: input.normalizeConfig,
          maxSessionMs: input.maxSessionMs,
        });
        break;
      }
      case "buildSessionsFromGamelog": {
        const fields = requireFields(payload, type);
        result = {
          sessions: buildSessionsFromGamelog(
            optionalArray(fields, "rows", isGamelogSessionRow),
            optionalNumber(fields, "mergeGapMs"),
            optionalNumber(fields, "nowMs")
          ),
        };
        break;
      }
      case "buildSessionsFromEvents": {
        const fields = requireFields(payload, type);
        result = buildSessionsFromEvents(optionalArray(fields, "events", isActivityEvent), optionalNullableNumber(fields, "initialStart") ?? null);
        break;
      }
      case "buildHeatmapBuckets": {
        const fields = requireFields(payload, type);
        result = {
          buckets: buildHeatmapBuckets(
            optionalArray(fields, "sessions", isActivitySession),
            requireNumber(fields, "windowStartMs"),
            requireNumber(fields, "nowMs"),
            optionalNumber(fields, "maxSessionMs")
          ),
        };
        break;
      }
      case "buildOverlapBuckets": {
        const fields = requireFields(payload, type);
        result = {
          buckets: buildOverlapBuckets(
            optionalArray(fields, "selfSessions", isActivitySession),
            optionalArray(fields, "friendSessions", isActivitySession),
            requireNumber(fields, "windowStartMs"),
            requireNumber(fields, "nowMs"),
            optionalNumber(fields, "maxSessionMs")
          ),
        };
        break;
      }
      case "normalizeHeatmapBuckets": {
        const fields = requireFields(payload, type);
        if ("thresholdMinutes" in fields || "mode" in fields) {
          console.warn("[activityWorker] normalizeHeatmapBuckets received legacy payload fields (thresholdMinutes/mode). Use payload.config instead.");
        }
        result = {
          normalized: normalizeBuckets(optionalArray(fields, "buckets", isNumber), parseNormalizeConfig(fields.config)),
        };
        break;
      }
      case "computeDailySummary": {
        const fields = requireFields(payload, type);
        result = {
          dailySummary: buildDailySummary(
            optionalArray(fields, "sessions", isActivitySession),
            requireNumber(fields, "rangeStartMs"),
            optionalNumber(fields, "rangeEndMs")
          ),
        };
        break;
      }
      default:
        throw new Error(`Unknown activity worker task: ${type}`);
    }

    self.postMessage({ type: "result", seq, payload: result });
  } catch (error) {
    self.postMessage({
      type: "error",
      seq,
      payload: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

function computeSessionsSnapshot(input: SnapshotInput) {
  const sourceRevision = input.sourceRevision;
  if (input.sourceType === "self_gamelog") {
    const sessions = buildSessionsFromGamelog(input.rows, input.mergeGapMs, input.nowMs).map((session, index, list) => ({
      ...session,
      isOpenTail: index === list.length - 1 && input.mayHaveOpenTail,
      sourceRevision,
    }));
    return {
      sessions,
      pendingSessionStartAt: null,
    };
  }

  const result = buildSessionsFromEvents(input.events, input.initialStart);
  return {
    pendingSessionStartAt: result.pendingSessionStartAt,
    sessions: result.sessions.map((session) => ({
      ...session,
      isOpenTail: false,
      sourceRevision,
    })),
  };
}
