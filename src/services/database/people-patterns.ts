import { cellNumber, cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";
import { MAX_REPEAT_ROWS, MAX_VOTE_KICK_EVENTS, MIN_REPEAT_PLACES } from "../../shared/utils/people-patterns.ts";
import type { FriendStay, PresenceEvent, RepeatEncounter, TimeSpan, VoteKickEvent } from "../../shared/utils/people-patterns.ts";

async function getRepeatEncounters(selfId: string): Promise<RepeatEncounter[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetRepeatEncounters(selfId, MIN_REPEAT_PLACES, MAX_REPEAT_ROWS));
  const encounters: RepeatEncounter[] = [];
  for (const row of rows) {
    const id = cellText(row[0]);
    if (id) {
      encounters.push({
        id,
        displayName: cellText(row[1]) ?? id,
        placeCount: cellNumber(row[2]) ?? 0,
        lastSeenAt: cellText(row[3]) ?? "",
        timeTogether: cellNumber(row[4]) ?? 0,
      });
    }
  }
  return encounters;
}

async function getFriendStays(since: string): Promise<FriendStay[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetFriendGatherings(since));
  const stays: FriendStay[] = [];
  for (const row of rows) {
    const location = cellText(row[0]);
    const userId = cellText(row[3]);
    const startedAt = cellNumber(row[5]);
    const endedAt = cellNumber(row[6]);
    if (location && userId && startedAt !== null && endedAt !== null) {
      stays.push({
        location,
        worldName: cellText(row[1]) ?? "",
        groupName: cellText(row[2]) ?? "",
        userId,
        displayName: cellText(row[4]) ?? userId,
        startedAt,
        endedAt,
      });
    }
  }
  return stays;
}

async function getFriendPresenceSince(since: string): Promise<PresenceEvent[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetFriendPresenceSince(since));
  const events: PresenceEvent[] = [];
  for (const row of rows) {
    const userId = cellText(row[0]);
    const at = cellNumber(row[2]);
    if (userId && at !== null) {
      events.push({ userId, displayName: cellText(row[1]) ?? "", at, isOnline: cellText(row[3]) === "Online" });
    }
  }
  return events;
}

async function getOwnLocationSpans(since: string): Promise<TimeSpan[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetOwnLocationsSince(since));
  const spans: TimeSpan[] = [];
  for (const row of rows) {
    const startedAt = cellNumber(row[0]);
    const time = cellNumber(row[1]);
    if (startedAt !== null && time !== null && time > 0) {
      spans.push({ startedAt, endedAt: startedAt + time });
    }
  }
  return spans;
}

async function getVoteKickEvents(): Promise<VoteKickEvent[]> {
  const rows = await sqliteService.rows(DatabaseApi.GetVoteKickEvents(MAX_VOTE_KICK_EVENTS));
  const events: VoteKickEvent[] = [];
  for (const row of rows) {
    const at = cellText(row[0]);
    const text = cellText(row[1]);
    if (at && text) {
      events.push({ at, text, worldName: cellText(row[2]) ?? "" });
    }
  }
  return events;
}

async function getFirstMet(userId: string): Promise<string> {
  const rows = await sqliteService.rows(DatabaseApi.GetFirstMetByUserId(userId));
  return cellText(rows[0]?.[0]) ?? "";
}

const peoplePatterns = {
  getRepeatEncounters,
  getFriendStays,
  getFriendPresenceSince,
  getOwnLocationSpans,
  getVoteKickEvents,
  getFirstMet,
};

export { peoplePatterns };
