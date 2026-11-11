import type { GameLogEntry, GameLogSessionMember, SessionLocation, SessionSegment } from "../../../stores/gameLog/types";

export type GameLogSessionEvent = GameLogEntry & {
  count?: number | undefined;
  playCount?: number | undefined;
};

type SegmentDraft = {
  epoch: number;
  id: number;
  created_at: string;
  location: string | null | undefined;
  worldId: string | null | undefined;
  worldName: string | null | undefined;
  groupName: string | null | undefined;
  duration: number | null;
  events: GameLogSessionEvent[];
};

const TOLERANCE_MS = 1000;
const AGGREGATE_THRESHOLD = 5;
const AGGREGATE_WINDOW_MS = 5000;

function toEpoch(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  return Number.isNaN(t) ? 0 : t;
}

function findSegmentIndex(eventEpoch: number, segmentsAsc: SegmentDraft[]): number {
  const target = eventEpoch + TOLERANCE_MS;
  const index = segmentsAsc.findLastIndex((segment) => segment.epoch <= target);
  return index === -1 ? 0 : index;
}

function toMember(e: GameLogEntry): GameLogSessionMember {
  return {
    displayName: e.displayName ?? null,
    userId: e.userId ?? null,
    created_at: e.created_at,
    isFriend: e.isFriend ?? false,
    isFavorite: e.isFavorite ?? false,
  };
}

function makeGroup(groupType: string, batch: GameLogSessionEvent[]): GameLogSessionEvent {
  return {
    type: groupType,
    created_at: batch[0]?.created_at ?? "",
    count: batch.length,
    members: batch.map(toMember),
  };
}

function collapseIntoGroup(events: GameLogSessionEvent[], indices: number[], groupType: string, batch: GameLogSessionEvent[]) {
  const firstIndex = indices[0];
  if (firstIndex === undefined) return;
  const group = makeGroup(groupType, batch);
  for (const index of [...indices].reverse()) {
    events.splice(index, 1);
  }
  events.splice(firstIndex, 0, group);
}

function aggregateTailEvents(events: GameLogSessionEvent[], matchType: string, groupType: string) {
  if (events.length === 0) return;

  const lastIdx = events.findLastIndex((event) => event.type === matchType);
  if (lastIdx === -1) return;

  const windowStart = toEpoch(events[lastIdx]?.created_at) - AGGREGATE_WINDOW_MS;
  const indices: number[] = [];
  const batch: GameLogSessionEvent[] = [];
  for (let i = lastIdx; i >= 0; i--) {
    const event = events[i];
    if (!event || toEpoch(event.created_at) < windowStart) break;
    if (event.type === matchType) {
      indices.unshift(i);
      batch.unshift(event);
    }
  }
  if (indices.length < AGGREGATE_THRESHOLD) return;

  collapseIntoGroup(events, indices, groupType, batch);
}

function aggregateHeadEvents(events: GameLogSessionEvent[], matchType: string, groupType: string) {
  if (events.length === 0) return;

  const firstIdx = events.findIndex((event) => event.type === matchType);
  if (firstIdx === -1) return;

  const windowEnd = toEpoch(events[firstIdx]?.created_at) + AGGREGATE_WINDOW_MS;
  const indices: number[] = [];
  const batch: GameLogSessionEvent[] = [];
  for (let i = firstIdx; i < events.length; i++) {
    const event = events[i];
    if (!event || toEpoch(event.created_at) > windowEnd) break;
    if (event.type === matchType) {
      indices.push(i);
      batch.push(event);
    }
  }
  if (indices.length < AGGREGATE_THRESHOLD) return;

  collapseIntoGroup(events, indices, groupType, batch);
}

function applyAggregation(segmentsAsc: SegmentDraft[]) {
  for (const seg of segmentsAsc) {
    aggregateTailEvents(seg.events, "OnPlayerLeft", "LeftGroup");
    aggregateTailEvents(seg.events, "OnPlayerJoined", "JoinGroup");
    aggregateHeadEvents(seg.events, "OnPlayerJoined", "JoinGroup");
  }
}

function videoKey(event: GameLogSessionEvent): string | null | undefined {
  if (event.videoUrl) return event.videoUrl;
  return event.videoName;
}

function playCountOf(event: GameLogSessionEvent): number {
  if (event.playCount) return event.playCount;
  return 1;
}

function toDuration(time: number | null | undefined): number | null {
  if (time) return time;
  return null;
}

function deduplicateVideoPlay(events: GameLogSessionEvent[]) {
  for (let i = events.length - 1; i > 0; i--) {
    const current = events[i];
    const previous = events[i - 1];
    if (current && previous && current.type === "VideoPlay" && previous.type === "VideoPlay" && videoKey(current) === videoKey(previous)) {
      previous.playCount = playCountOf(previous) + playCountOf(current);
      events.splice(i, 1);
    }
  }
  for (const e of events) {
    if (e.type === "VideoPlay" && !e.playCount) e.playCount = 1;
  }
}

function dedupeFlatEvents(flatEvents: GameLogEntry[]): GameLogEntry[] {
  const seen = new Set<string>();
  return flatEvents.filter((e) => {
    const key = `${e.type}\0${e.created_at}\0${e.userId ?? ""}\0${e.location ?? ""}\0${e.videoUrl ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickSegmentIndex(candidates: number[], segmentsAsc: SegmentDraft[], eventEpoch: number): number {
  const target = eventEpoch + TOLERANCE_MS;
  const matched = candidates.findLast((index) => (segmentsAsc[index]?.epoch ?? Number.POSITIVE_INFINITY) <= target);
  return matched ?? candidates[0] ?? 0;
}

export function buildGameLogSessions(locationSegments: SessionLocation[], flatEvents: GameLogEntry[]): { segments: SessionSegment[] } {
  if (locationSegments.length === 0) {
    return { segments: [] };
  }

  const segmentsAsc: SegmentDraft[] = locationSegments
    .map((loc) => ({
      id: loc.id,
      created_at: loc.created_at,
      epoch: toEpoch(loc.created_at),
      location: loc.location,
      worldId: loc.worldId,
      worldName: loc.worldName,
      groupName: loc.groupName,
      duration: toDuration(loc.time),
      events: [],
    }))
    .sort((a, b) => a.epoch - b.epoch);

  const dedupedEvents = dedupeFlatEvents(flatEvents);

  const locationMap = new Map<string | null | undefined, number[]>();
  segmentsAsc.forEach((segment, i) => {
    const indices = locationMap.get(segment.location);
    if (indices) {
      indices.push(i);
    } else {
      locationMap.set(segment.location, [i]);
    }
  });

  for (const event of dedupedEvents) {
    const eventEpoch = toEpoch(event.created_at);
    const candidates = event.location ? locationMap.get(event.location) : undefined;

    const idx = candidates && candidates.length > 0 ? pickSegmentIndex(candidates, segmentsAsc, eventEpoch) : findSegmentIndex(eventEpoch, segmentsAsc);

    segmentsAsc[idx]?.events.push({ ...event });
  }

  for (const seg of segmentsAsc) {
    seg.events.sort((a, b) => toEpoch(a.created_at) - toEpoch(b.created_at));
  }

  for (const seg of segmentsAsc) {
    const cutoff = seg.epoch - TOLERANCE_MS;
    seg.events = seg.events.filter((e) => toEpoch(e.created_at) >= cutoff);
  }

  for (const seg of segmentsAsc) {
    const windowEnd = seg.epoch + AGGREGATE_WINDOW_MS;
    const joinedIds = new Set<string>();
    for (const e of seg.events) {
      if (toEpoch(e.created_at) > windowEnd) break;
      if (e.type === "OnPlayerJoined" && e.userId) {
        joinedIds.add(e.userId);
      }
    }
    if (joinedIds.size > 0) {
      for (let i = seg.events.length - 1; i >= 0; i--) {
        const e = seg.events[i];
        if (!e || toEpoch(e.created_at) > windowEnd) continue;
        if (e.type === "OnPlayerLeft" && e.userId && joinedIds.has(e.userId)) {
          seg.events.splice(i, 1);
        }
      }
    }
  }

  applyAggregation(segmentsAsc);

  for (const seg of segmentsAsc) {
    deduplicateVideoPlay(seg.events);
  }
  for (const seg of segmentsAsc) seg.events.reverse();

  const segments: SessionSegment[] = segmentsAsc.reverse().map((seg) => ({
    id: seg.id,
    created_at: seg.created_at,
    location: seg.location,
    worldId: seg.worldId,
    worldName: seg.worldName,
    groupName: seg.groupName,
    duration: seg.duration,
    events: seg.events,
  }));

  return { segments };
}
