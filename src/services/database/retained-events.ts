import { watch } from "vue";

import { cellNumber, cellText } from "./cells.ts";
import { dbVars } from "./index.ts";

import { sqliteService } from "../sqlite.ts";
import { watchState } from "../watch-state";

type AvatarObservation = {
  avatarName: string;
  displayName: string;
  location: string;
  source: "game-log" | "photon";
  avatarId?: string | undefined;
  authorId?: string | undefined;
  releaseStatus?: string | undefined;
  imageUrl?: string | undefined;
  thumbnailImageUrl?: string | undefined;
};

type RemoteFavoriteObservation = {
  type: string;
  itemId: string;
  group: string;
  name?: string | undefined;
  createdAt?: string | undefined;
};

type ProfileFields = { bio?: string; pronouns?: string; tags?: string[] };
type ProfileObservation = { id: string; bio?: string | undefined; pronouns?: string | undefined; tags?: string[] | undefined };
type ProfileEvent = { kind: "profile"; subject: string; createdAt: string; data: ProfileFields };
type PendingProfile = { observed: ProfileFields; events: ProfileEvent[] };

type RetainedEvent =
  | { kind: "avatar"; subject: string; createdAt: string; data: AvatarObservation }
  | ProfileEvent
  | {
      kind: "badge";
      subject: string;
      createdAt: string;
      data: { action: "add" | "remove"; badgeId: string; name?: string | undefined; description?: string | undefined; imageUrl?: string | undefined };
    }
  | { kind: "remote-favorites"; subject: string; createdAt: string; data: RemoteFavoriteObservation[] };

type QueuedEvent = { account: string; event: RetainedEvent };
type HistoryRow = { id: number; subject: string; detail: string; createdAt: string; data: unknown };

const avatarBatchSize = 4;
const batchSize = 16;
const queueLimit = 8192;
const queue: QueuedEvent[] = [];
let isFlushing = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let pruneTimer: ReturnType<typeof setTimeout> | undefined;
let lastPrune = 0;
let eventsSincePrune = 0;
let profileAccount = "";
let profileSession = 0;
let isProfileLookupScheduled = false;
let pendingProfileCount = 0;
const profiles = new Map<string, ProfileFields>();
const pendingProfiles = new Map<string, PendingProfile>();

function clearProfiles(): void {
  profileAccount = "";
  profileSession += 1;
  profiles.clear();
  pendingProfiles.clear();
  pendingProfileCount = 0;
}

watch(
  () => watchState.isLoggedIn,
  (isLoggedIn) => {
    if (!isLoggedIn) {
      clearProfiles();
    }
  },
  { flush: "sync" }
);
watch(() => watchState.isFriendsLoaded, scheduleProfiles, { flush: "post" });

function scheduleProfiles(): void {
  if (isProfileLookupScheduled || pendingProfiles.size === 0 || !watchState.isFriendsLoaded) {
    return;
  }
  isProfileLookupScheduled = true;
  const submit = () => {
    void loadProfileBaselines().catch((error: unknown) => {
      console.error(error);
      setTimeout(finishProfileLookup, 5000);
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(submit, { timeout: 2000 });
  } else {
    setTimeout(submit, 0);
  }
}

function finishProfileLookup(): void {
  isProfileLookupScheduled = false;
  scheduleProfiles();
}

async function loadProfileBaselines(): Promise<void> {
  if (!watchState.isLoggedIn || dbVars.userId !== profileAccount) {
    clearProfiles();
  }
  if (!watchState.isFriendsLoaded || pendingProfiles.size === 0) {
    finishProfileLookup();
    return;
  }

  const account = profileAccount;
  const session = profileSession;
  const subjects = Array.from(pendingProfiles.keys()).slice(0, 512);
  const rows = await sqliteService.rows(DatabaseApi.GetRetainedProfileBaselines(account, JSON.stringify(subjects)));
  if (session === profileSession && account === dbVars.userId && watchState.isLoggedIn) {
    const stored = readProfileBaselines(rows);
    for (const subject of subjects) {
      const pending = pendingProfiles.get(subject);
      if (pending === undefined) {
        continue;
      }
      const baseline = stored.get(subject) ?? {};
      for (const event of pending.events) {
        const data = changedProfileFields(event.data, baseline);
        if (hasProfileFields(data)) {
          queueRetainedEvent({ ...event, data }, account);
          Object.assign(baseline, data);
        }
      }
      rememberProfile(subject, baseline);
      pendingProfiles.delete(subject);
      pendingProfileCount -= pending.events.length;
    }
  }
  finishProfileLookup();
}

function decodeProfileField(encoded: unknown): unknown {
  return typeof encoded === "string" ? JSON.parse(encoded) : undefined;
}

function readProfileBaselines(rows: unknown[][]): Map<string, ProfileFields> {
  const stored = new Map<string, ProfileFields>();
  for (const [id, encodedBio, encodedPronouns, encodedTags] of rows) {
    if (typeof id !== "string") {
      continue;
    }
    const bio = decodeProfileField(encodedBio);
    const pronouns = decodeProfileField(encodedPronouns);
    const tags = decodeProfileField(encodedTags);
    const profile: ProfileFields = {};
    if (typeof bio === "string") {
      profile.bio = bio;
    }
    if (typeof pronouns === "string") {
      profile.pronouns = pronouns;
    }
    if (Array.isArray(tags)) {
      profile.tags = tags.filter((tag: unknown): tag is string => typeof tag === "string");
    }
    stored.set(id, profile);
  }
  return stored;
}

function changedProfileFields(fields: ProfileFields, prior: ProfileFields | undefined): ProfileFields {
  const data: ProfileFields = {};
  if (fields.bio !== undefined && fields.bio !== prior?.bio) {
    data.bio = fields.bio;
  }
  if (fields.pronouns !== undefined && fields.pronouns !== prior?.pronouns) {
    data.pronouns = fields.pronouns;
  }
  const tags = fields.tags;
  if (tags !== undefined && (tags.length !== prior?.tags?.length || tags.some((tag, index) => tag !== prior.tags?.[index]))) {
    data.tags = tags;
  }
  return data;
}

function hasProfileFields(data: ProfileFields): boolean {
  return data.bio !== undefined || data.pronouns !== undefined || data.tags !== undefined;
}

function rememberProfile(subject: string, fields: ProfileFields): void {
  profiles.delete(subject);
  profiles.set(subject, fields);
  if (profiles.size > queueLimit) {
    const oldest = profiles.keys().next().value;
    if (oldest !== undefined) {
      profiles.delete(oldest);
    }
  }
}

function observeRetainedProfile(profile: ProfileObservation): void {
  const account = dbVars.userId;
  if (!watchState.isLoggedIn || !account || !profile.id) {
    return;
  }
  if (account !== profileAccount) {
    clearProfiles();
    profileAccount = account;
  }
  const prior = profiles.get(profile.id);
  const pending = pendingProfiles.get(profile.id);
  const fields: ProfileFields = {};
  if (typeof profile.bio === "string") {
    fields.bio = profile.bio;
  }
  if (typeof profile.pronouns === "string") {
    fields.pronouns = profile.pronouns;
  }
  if (Array.isArray(profile.tags)) {
    fields.tags = [...new Set(profile.tags.filter((tag) => typeof tag === "string"))].sort();
  }
  const data = changedProfileFields(fields, prior ?? pending?.observed);
  if (!hasProfileFields(data)) {
    return;
  }
  const event: ProfileEvent = { kind: "profile", subject: profile.id, createdAt: new Date().toJSON(), data };
  if (prior !== undefined) {
    queueRetainedEvent(event, account);
    rememberProfile(profile.id, { ...prior, ...data });
  } else if (pendingProfileCount < queueLimit) {
    const entry = pending ?? { observed: {}, events: [] };
    Object.assign(entry.observed, data);
    entry.events.push(event);
    pendingProfiles.set(profile.id, entry);
    pendingProfileCount += 1;
    scheduleProfiles();
  }
}

function scheduleRetainedPrune(): void {
  eventsSincePrune += 1;
  if (pruneTimer !== undefined || (Date.now() - lastPrune < 300_000 && eventsSincePrune < 4096)) {
    return;
  }
  pruneTimer = setTimeout(() => {
    pruneTimer = undefined;
    lastPrune = Date.now();
    eventsSincePrune = 0;
    void sqliteService.run(DatabaseApi.PruneRetainedEvents()).catch((error: unknown) => console.error(error));
  }, 2500);
}

function scheduleFlush(delay: number): void {
  if (flushTimer !== undefined || isFlushing) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flush().catch((error: unknown) => console.error(error));
  }, delay);
}

async function flush(): Promise<void> {
  const first = queue[0];
  if (first === undefined) {
    return;
  }
  isFlushing = true;
  const isAvatar = first.event.kind === "avatar";
  const limit = isAvatar ? avatarBatchSize : batchSize;
  let count = 1;
  while (count < limit) {
    const next = queue[count];
    if (next?.account !== first.account || (next.event.kind === "avatar") !== isAvatar) {
      break;
    }
    count += 1;
  }
  const batch = queue.splice(0, count);
  let delay = 0;
  try {
    const pending = await appendBatch(batch);
    if (pending.length > 0) {
      queue.unshift(...pending);
      delay = 5000;
    }
  } finally {
    isFlushing = false;
    if (queue.length > 0) {
      scheduleFlush(delay);
    }
  }
}

function isTransientWriteError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const codes = ["code" in error ? error.code : undefined, "resultCode" in error ? error.resultCode : undefined];
    if (codes.some((code) => (typeof code === "number" && [5, 6].includes(code & 255)) || (typeof code === "string" && /SQLITE_(BUSY|LOCKED)/iu.test(code)))) {
      return true;
    }
  }
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  return /SQLITE_(BUSY|LOCKED)|database(?: table| schema)? is (?:locked|busy)/iu.test(message);
}

async function appendBatch(batch: QueuedEvent[], hasRetriedSingle = false): Promise<QueuedEvent[]> {
  const first = batch[0];
  if (!first) return [];
  try {
    await sqliteService.run(DatabaseApi.AppendRetainedEvents(first.account, JSON.stringify(batch.map(({ event }) => event))));
    eventsSincePrune += batch.length - 1;
    scheduleRetainedPrune();
    return [];
  } catch (error) {
    if (isTransientWriteError(error)) {
      console.error(error);
      return batch;
    }
    if (batch.length === 1) {
      if (!hasRetriedSingle) return appendBatch(batch, true);
      console.error(error);
      return [];
    }
    const middle = Math.floor(batch.length / 2);
    const pending = await appendBatch(batch.slice(0, middle));
    return pending.length > 0 ? [...pending, ...batch.slice(middle)] : appendBatch(batch.slice(middle));
  }
}

function queueRetainedEvent(event: RetainedEvent, expectedAccount?: string): void {
  const account = dbVars.userId;
  if (!watchState.isLoggedIn || !account || (expectedAccount !== undefined && expectedAccount !== account) || !event.subject || !event.createdAt) {
    return;
  }
  if (queue.length >= queueLimit) {
    console.error("The history queue is full");
    return;
  }
  queue.push({ account, event });
  scheduleFlush(250);
}

async function readHistory(call: Promise<string>): Promise<HistoryRow[]> {
  return (await sqliteService.rows(call)).flatMap((row) => {
    const id = cellNumber(row[0]);
    const subject = cellText(row[1]);
    const detail = cellText(row[2]);
    const createdAt = cellText(row[3]);
    const encodedData = cellText(row[4]);
    if (id === null || subject === null || detail === null || createdAt === null || encodedData === null) {
      return [];
    }
    const data: unknown = JSON.parse(encodedData);
    return [{ id, subject, detail, createdAt, data }];
  });
}

const retainedEvents = {
  queueRetainedEvent,
  observeRetainedProfile,

  getPlayerAvatarHistory(userId: string, limit = 50, beforeId: number | null = null) {
    return readHistory(DatabaseApi.GetPlayerAvatarHistory(userId, beforeId, limit));
  },

  getFriendPlatformHistory(userId: string, limit = 50, beforeId: number | null = null) {
    return readHistory(DatabaseApi.GetFriendPlatformHistory(userId, beforeId, limit));
  },

  getProfileHistory(userId: string, limit = 50, beforeId: number | null = null) {
    return readHistory(DatabaseApi.GetProfileHistory(userId, beforeId, limit));
  },

  getFavoriteHistory(limit = 50, beforeId: number | null = null) {
    return readHistory(DatabaseApi.GetFavoriteHistory(beforeId, limit));
  },

  getBadgeHistory(limit = 50, beforeId: number | null = null) {
    return readHistory(DatabaseApi.GetBadgeHistory(beforeId, limit));
  },

  async getLatestBadgeById(badgeId: string): Promise<HistoryRow | null> {
    return (await readHistory(DatabaseApi.GetLatestBadgeById(badgeId)))[0] ?? null;
  },

  getBadgeHistoryAt(createdAt: string): Promise<HistoryRow[]> {
    return readHistory(DatabaseApi.GetBadgeHistoryAt(createdAt));
  },
};

export { retainedEvents, scheduleRetainedPrune };
export type { AvatarObservation, HistoryRow, RemoteFavoriteObservation };
