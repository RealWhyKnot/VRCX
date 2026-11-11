import type { GameLogEntry, GameLogSessionMember, SessionSegment } from "./types";
import { gameLogSearchFilter } from "../../shared/utils/game-log";

export const SESSIONS_EVENT_FILTER_ALL = "All";
export const SESSIONS_EVENT_FILTER_TYPES = ["OnPlayerJoined", "OnPlayerLeft", "VideoPlay"];
export const SESSIONS_DATE_RANGE_MAX_DAYS = 7;

export function firstItem<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error("expected a non-empty list");
  }
  return item;
}

export function lastItem<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) {
    throw new Error("expected a non-empty list");
  }
  return item;
}

export function toSessionFilterList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: unknown[] = value;
  return items.filter((item): item is string => typeof item === "string");
}

export function toSessionsEpoch(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function normalizeSessionsSearch(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isSessionsCreatedAtInRange(createdAt: string | null | undefined, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) {
    return true;
  }
  const createdAtEpoch = toSessionsEpoch(createdAt);
  if (dateFrom && createdAtEpoch < toSessionsEpoch(dateFrom)) {
    return false;
  }
  if (dateTo && createdAtEpoch > toSessionsEpoch(dateTo)) {
    return false;
  }
  return true;
}

export function clampSessionsDateRange(from: string | null | undefined, to: string | null | undefined): [string, string] {
  const start = from ?? "";
  const end = to ?? "";
  const startTs = toSessionsEpoch(start);
  const endTs = toSessionsEpoch(end);
  if (!startTs || !endTs) {
    return [start, end];
  }

  const lower = Math.min(startTs, endTs);
  const upper = Math.max(startTs, endTs);
  if (upper - lower <= SESSIONS_DATE_RANGE_MAX_DAYS * 86400000) {
    return startTs <= endTs ? [start, end] : [end, start];
  }

  const clampedEnd = new Date(lower + SESSIONS_DATE_RANGE_MAX_DAYS * 86400000).toISOString();
  return startTs <= endTs ? [start, clampedEnd] : [clampedEnd, start];
}

function containsSearchValue(item: string | null | undefined, value: string): boolean {
  return (item ?? "").toUpperCase().includes(value);
}

function isMemberSearchMatch(member: GameLogSessionMember, value: string): boolean {
  return containsSearchValue(member.displayName, value);
}

function isEventSearchMatch(event: GameLogEntry, value: string): boolean {
  if (event.type === "JoinGroup" || event.type === "LeftGroup") {
    return Array.isArray(event.members) ? event.members.some((member) => isMemberSearchMatch(member, value)) : false;
  }
  if (gameLogSearchFilter(event, value)) {
    return true;
  }
  return containsSearchValue(event.displayName, value) || containsSearchValue(event.videoName, value) || containsSearchValue(event.videoUrl, value);
}

function isSegmentHeaderSearchMatch(segment: SessionSegment, value: string): boolean {
  return containsSearchValue(segment.worldName, value);
}

export function filterSessionsEventsByFilters(events: GameLogEntry[], isVipOnly: boolean, eventFilters: string[]): GameLogEntry[] {
  let result = events;

  if (isVipOnly) {
    result = result.filter((event) => event.type === "VideoPlay" || event.isFavorite);
  }

  if (eventFilters.length > 0) {
    result = result.filter((event) => eventFilters.includes(event.type));
  }

  return result;
}

export function filterSessionsSegmentsByDateRange(segments: SessionSegment[], dateFrom: string, dateTo: string): SessionSegment[] {
  if (!dateFrom && !dateTo) {
    return segments;
  }
  return segments.filter((segment) => isSessionsCreatedAtInRange(segment.created_at, dateFrom, dateTo));
}

function matchSegmentEvents(segment: SessionSegment, value: string): GameLogEntry[] {
  return segment.events.flatMap((event): GameLogEntry[] => {
    if (event.type === "JoinGroup" || event.type === "LeftGroup") {
      if (!Array.isArray(event.members)) {
        return [];
      }
      const matchedMembers = event.members.filter((member) => isMemberSearchMatch(member, value));
      return matchedMembers.map((member) => ({
        ...member,
        type: event.type === "JoinGroup" ? "OnPlayerJoined" : "OnPlayerLeft",
        location: segment.location,
      }));
    }

    return isEventSearchMatch(event, value) ? [event] : [];
  });
}

export function applySessionsSearchFilter(segments: SessionSegment[], search: string | null | undefined, searchLimit: number): SessionSegment[] {
  const value = normalizeSessionsSearch(search);
  if (!value) {
    return segments;
  }

  const filtered: SessionSegment[] = [];
  for (const segment of segments) {
    if (isSegmentHeaderSearchMatch(segment, value)) {
      filtered.push(segment);
      continue;
    }

    const events = matchSegmentEvents(segment, value);
    if (events.length > 0) {
      filtered.push({
        ...segment,
        events,
      });
    }
  }
  return filtered.slice(0, searchLimit);
}
