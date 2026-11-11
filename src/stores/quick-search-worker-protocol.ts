export type ObjectRecord = Readonly<{
  type?: unknown;
  payload?: unknown;
  seq?: unknown;
  query?: unknown;
  currentUserId?: unknown;
  language?: unknown;
  id?: unknown;
  name?: unknown;
  imageUrl?: unknown;
  authorId?: unknown;
  ownerId?: unknown;
  memo?: unknown;
  note?: unknown;
  friends?: unknown;
  avatars?: unknown;
  worlds?: unknown;
  groups?: unknown;
  favAvatars?: unknown;
  favWorlds?: unknown;
  ownAvatars?: unknown;
  ownWorlds?: unknown;
  ownGroups?: unknown;
  joinedGroups?: unknown;
}>;

type ObjectRecordKey = keyof ObjectRecord;

export type IndexEntry = {
  id: string;
  name: string | undefined;
  imageUrl: string | undefined;
  authorId: string | undefined;
  ownerId: string | undefined;
  memo: string | undefined;
  note: string | undefined;
  normalized: string | undefined;
};

export type IndexPayload = {
  friends: IndexEntry[] | undefined;
  avatars: IndexEntry[] | undefined;
  worlds: IndexEntry[] | undefined;
  groups: IndexEntry[] | undefined;
  favAvatars: IndexEntry[] | undefined;
  favWorlds: IndexEntry[] | undefined;
};

export type SearchRequest = {
  seq: unknown;
  query: string;
  currentUserId: string | undefined;
  language: string | undefined;
};

export type WorkerRequest =
  { type: "updateIndex"; payload: IndexPayload } | { type: "search"; payload: SearchRequest } | { type: "unknown"; received: unknown };

export type FriendMatchField = "name" | "memo" | "note";

export type FriendSearchResult = {
  id: string;
  name: string | undefined;
  type: "friend";
  imageUrl: string | undefined;
  memo: string;
  note: string;
  matchedField: FriendMatchField;
};

export type ItemType = "avatar" | "world" | "group";

export type ItemSearchResult = {
  id: string;
  name: string;
  type: ItemType;
  imageUrl: string | undefined;
};

export type SearchResultPayload = {
  seq: unknown;
  friends: FriendSearchResult[];
  ownAvatars: ItemSearchResult[];
  favAvatars: ItemSearchResult[];
  ownWorlds: ItemSearchResult[];
  favWorlds: ItemSearchResult[];
  ownGroups: ItemSearchResult[];
  joinedGroups: ItemSearchResult[];
};

export type SearchWorkerResponse = {
  type: "searchResult";
  payload: SearchResultPayload;
};

export function isObjectRecord(value: unknown): value is ObjectRecord {
  return typeof value === "object" && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function readString(source: ObjectRecord, key: ObjectRecordKey): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function parseEntry(value: unknown): IndexEntry | undefined {
  if (!isObjectRecord(value)) return undefined;
  const id = readString(value, "id");
  if (id === undefined) return undefined;
  return {
    id,
    name: readString(value, "name"),
    imageUrl: readString(value, "imageUrl"),
    authorId: readString(value, "authorId"),
    ownerId: readString(value, "ownerId"),
    memo: readString(value, "memo"),
    note: readString(value, "note"),
    normalized: undefined,
  };
}

function parseEntries(value: unknown): IndexEntry[] | undefined {
  if (!isUnknownArray(value)) return undefined;
  const entries: IndexEntry[] = [];
  for (const item of value) {
    const entry = parseEntry(item);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseIndexPayload(value: unknown): IndexPayload {
  const source: ObjectRecord = isObjectRecord(value) ? value : {};
  return {
    friends: parseEntries(source.friends),
    avatars: parseEntries(source.avatars),
    worlds: parseEntries(source.worlds),
    groups: parseEntries(source.groups),
    favAvatars: parseEntries(source.favAvatars),
    favWorlds: parseEntries(source.favWorlds),
  };
}

function parseSearchRequest(value: unknown): SearchRequest {
  const source: ObjectRecord = isObjectRecord(value) ? value : {};
  return {
    seq: source.seq,
    query: readString(source, "query") ?? "",
    currentUserId: readString(source, "currentUserId"),
    language: readString(source, "language"),
  };
}

export function parseWorkerRequest(value: unknown): WorkerRequest {
  const source: ObjectRecord = isObjectRecord(value) ? value : {};
  const type = source.type;
  if (type === "updateIndex") {
    return { type, payload: parseIndexPayload(source.payload) };
  }
  if (type === "search") {
    return { type, payload: parseSearchRequest(source.payload) };
  }
  return { type: "unknown", received: type };
}
