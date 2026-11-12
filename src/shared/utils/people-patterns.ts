const PATTERN_WINDOW_DAYS = 90;
const MIN_REPEAT_PLACES = 3;
const MAX_REPEAT_ROWS = 500;
const MAX_OPEN_SESSION_MS = 12 * 60 * 60 * 1000;
const MERGE_GAP_MS = 60 * 1000;

const PEOPLE_VIEWS = ["repeat", "gatherings", "overlap", "votekicks", "seen"] as const;
const MAX_VOTE_KICK_EVENTS = 2000;
const VOTE_RESULT_WINDOW_MS = 5 * 60 * 1000;
const VOTE_STARTED = /^A vote kick has been initiated against (.+), do you agree\?$/;
const VOTE_PASSED = /^Vote to kick (.+) succeeded$/;

type PeopleView = (typeof PEOPLE_VIEWS)[number];

function isPeopleView(value: unknown): value is PeopleView {
  return PEOPLE_VIEWS.some((view) => view === value);
}

type RepeatEncounter = {
  id: string;
  displayName: string;
  placeCount: number;
  lastSeenAt: string;
  timeTogether: number;
};

type FriendStay = {
  location: string;
  worldName: string;
  groupName: string;
  userId: string;
  displayName: string;
  startedAt: number;
  endedAt: number;
};

type GatheringPerson = {
  id: string;
  displayName: string;
};

type Gathering = {
  id: string;
  worldName: string;
  groupName: string;
  startedAt: string;
  people: GatheringPerson[];
  peopleCount: number;
  names: string;
  timeTogether: number;
};

type PresenceEvent = {
  userId: string;
  displayName: string;
  at: number;
  isOnline: boolean;
};

type TimeSpan = {
  startedAt: number;
  endedAt: number;
};

type OnlineOverlap = {
  id: string;
  displayName: string;
  timeTogether: number;
  theirTime: number;
  theirShare: number;
  myShare: number;
};

type VoteKickEvent = {
  at: string;
  text: string;
  worldName: string;
};

type VoteKickOutcome = "started" | "passed" | "self";

type VoteKick = {
  id: string;
  at: string;
  displayName: string;
  outcome: VoteKickOutcome;
  worldName: string;
};

type StayEdge = {
  at: number;
  isArrival: boolean;
  userId: string;
  displayName: string;
};

function gatheringAt(location: string, stays: FriendStay[]): Gathering | null {
  const edges: StayEdge[] = [];
  for (const stay of stays) {
    if (stay.endedAt > stay.startedAt) {
      edges.push({ at: stay.startedAt, isArrival: true, userId: stay.userId, displayName: stay.displayName });
      edges.push({ at: stay.endedAt, isArrival: false, userId: stay.userId, displayName: stay.displayName });
    }
  }
  edges.sort((a, b) => a.at - b.at || Number(a.isArrival) - Number(b.isArrival));
  const present = new Map<string, number>();
  const people = new Map<string, string>();
  let timeTogether = 0;
  let startedAt = 0;
  let previousAt = 0;
  for (const edge of edges) {
    if (present.size >= 2) {
      timeTogether += edge.at - previousAt;
    }
    previousAt = edge.at;
    const count = (present.get(edge.userId) ?? 0) + (edge.isArrival ? 1 : -1);
    if (count > 0) {
      present.set(edge.userId, count);
    } else {
      present.delete(edge.userId);
    }
    if (edge.isArrival && present.size >= 2) {
      if (startedAt === 0) {
        startedAt = edge.at;
      }
      for (const userId of present.keys()) {
        if (!people.has(userId)) {
          people.set(userId, stays.find((stay) => stay.userId === userId)?.displayName ?? userId);
        }
      }
    }
  }
  if (people.size < 2 || timeTogether <= 0) {
    return null;
  }
  const first = stays[0];
  const list = [...people].map(([id, displayName]) => ({ id, displayName })).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return {
    id: location,
    worldName: first?.worldName ?? "",
    groupName: first?.groupName ?? "",
    startedAt: new Date(startedAt).toISOString(),
    people: list,
    peopleCount: list.length,
    names: list.map((person) => person.displayName).join(", "),
    timeTogether,
  };
}

function buildGatherings(stays: FriendStay[]): Gathering[] {
  const byLocation = new Map<string, FriendStay[]>();
  for (const stay of stays) {
    const list = byLocation.get(stay.location);
    if (list) {
      list.push(stay);
    } else {
      byLocation.set(stay.location, [stay]);
    }
  }
  const gatherings: Gathering[] = [];
  for (const [location, list] of byLocation) {
    const gathering = gatheringAt(location, list);
    if (gathering) {
      gatherings.push(gathering);
    }
  }
  return gatherings.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function mergeSpans(spans: TimeSpan[]): TimeSpan[] {
  const sorted = spans.filter((span) => span.endedAt > span.startedAt).sort((a, b) => a.startedAt - b.startedAt);
  const merged: TimeSpan[] = [];
  for (const span of sorted) {
    const last = merged.at(-1);
    if (last && span.startedAt <= last.endedAt + MERGE_GAP_MS) {
      last.endedAt = Math.max(last.endedAt, span.endedAt);
    } else {
      merged.push({ startedAt: span.startedAt, endedAt: span.endedAt });
    }
  }
  return merged;
}

function spanTotal(spans: TimeSpan[]): number {
  return spans.reduce((total, span) => total + span.endedAt - span.startedAt, 0);
}

function sharedTime(theirs: TimeSpan[], mine: TimeSpan[]): number {
  let total = 0;
  let index = 0;
  for (const span of theirs) {
    while (index < mine.length && (mine[index]?.endedAt ?? 0) <= span.startedAt) {
      index += 1;
    }
    for (let cursor = index; cursor < mine.length; cursor += 1) {
      const own = mine[cursor];
      if (!own || own.startedAt >= span.endedAt) {
        break;
      }
      total += Math.min(span.endedAt, own.endedAt) - Math.max(span.startedAt, own.startedAt);
    }
  }
  return total;
}

function share(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

function buildOnlineOverlap(events: PresenceEvent[], ownSpans: TimeSpan[], now: number): OnlineOverlap[] {
  const mine = mergeSpans(ownSpans);
  const myTime = spanTotal(mine);
  const sessions = new Map<string, { displayName: string; spans: TimeSpan[]; onlineSince: number }>();
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    let entry = sessions.get(event.userId);
    if (!entry) {
      entry = { displayName: event.displayName, spans: [], onlineSince: 0 };
      sessions.set(event.userId, entry);
    }
    entry.displayName = event.displayName || entry.displayName;
    if (event.isOnline) {
      entry.onlineSince = event.at;
    } else if (entry.onlineSince > 0) {
      entry.spans.push({ startedAt: entry.onlineSince, endedAt: event.at });
      entry.onlineSince = 0;
    }
  }
  const rows: OnlineOverlap[] = [];
  for (const [id, entry] of sessions) {
    if (entry.onlineSince > 0) {
      entry.spans.push({ startedAt: entry.onlineSince, endedAt: Math.min(now, entry.onlineSince + MAX_OPEN_SESSION_MS) });
    }
    const theirs = mergeSpans(entry.spans);
    const theirTime = spanTotal(theirs);
    const timeTogether = sharedTime(theirs, mine);
    if (timeTogether > 0) {
      rows.push({
        id,
        displayName: entry.displayName || id,
        timeTogether,
        theirTime,
        theirShare: share(timeTogether, theirTime),
        myShare: share(timeTogether, myTime),
      });
    }
  }
  return rows.sort((a, b) => b.timeTogether - a.timeTogether);
}

function buildVoteKicks(events: VoteKickEvent[]): VoteKick[] {
  const kicks: VoteKick[] = [];
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  sorted.forEach((event, position) => {
    const id = `${event.at}:${position}`;
    const started = VOTE_STARTED.exec(event.text)?.[1];
    const passed = VOTE_PASSED.exec(event.text)?.[1];
    if (started) {
      kicks.push({ id, at: event.at, displayName: started, outcome: "started", worldName: event.worldName });
    } else if (passed) {
      const open = kicks.findLast(
        (kick) => kick.displayName === passed && kick.outcome === "started" && Date.parse(event.at) - Date.parse(kick.at) <= VOTE_RESULT_WINDOW_MS
      );
      if (open) {
        open.outcome = "passed";
      } else {
        kicks.push({ id, at: event.at, displayName: passed, outcome: "passed", worldName: event.worldName });
      }
    } else if (event.text.includes("You have been kicked")) {
      kicks.push({ id, at: event.at, displayName: "", outcome: "self", worldName: event.worldName });
    }
  });
  return kicks.reverse();
}

function filterVoteKicks(rows: VoteKick[], query: string): VoteKick[] {
  return rows.filter((row) => matches(query, row.displayName, row.worldName));
}

function matches(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  return needle === "" || fields.some((field) => field.toLowerCase().includes(needle));
}

function filterRepeatEncounters(rows: RepeatEncounter[], query: string): RepeatEncounter[] {
  return rows.filter((row) => matches(query, row.displayName));
}

function filterGatherings(rows: Gathering[], query: string): Gathering[] {
  return rows.filter((row) => matches(query, row.names, row.worldName, row.groupName));
}

function filterOnlineOverlap(rows: OnlineOverlap[], query: string): OnlineOverlap[] {
  return rows.filter((row) => matches(query, row.displayName));
}

function patternWindowStart(now: number): string {
  return new Date(now - PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export {
  MAX_REPEAT_ROWS,
  MAX_VOTE_KICK_EVENTS,
  MIN_REPEAT_PLACES,
  PATTERN_WINDOW_DAYS,
  PEOPLE_VIEWS,
  buildGatherings,
  buildOnlineOverlap,
  buildVoteKicks,
  filterGatherings,
  filterOnlineOverlap,
  filterRepeatEncounters,
  filterVoteKicks,
  isPeopleView,
  patternWindowStart,
};
export type {
  FriendStay,
  Gathering,
  GatheringPerson,
  OnlineOverlap,
  PeopleView,
  PresenceEvent,
  RepeatEncounter,
  TimeSpan,
  VoteKick,
  VoteKickEvent,
  VoteKickOutcome,
};
