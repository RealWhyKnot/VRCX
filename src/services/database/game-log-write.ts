import { sqliteService } from "../sqlite.ts";

type GameLogLocationEntry = {
  created_at: string | null;
  location: string | null;
  worldId: string | null;
  worldName: string | null;
  time: number;
  groupName: string | null;
};

type GameLogJoinLeaveEntry = {
  created_at: string | null;
  type: string | null;
  displayName: string | null;
  location: string | null;
  userId: string | null;
  time: number | null;
};

type GameLogPortalSpawnEntry = {
  created_at: string | null;
  displayName: string | null;
  location: string | null;
  userId: string | null;
  instanceId: string | null;
  worldName: string | null;
};

type GameLogVideoPlayEntry = {
  created_at: string | null;
  videoUrl: string | null;
  videoName: string | null;
  videoId: string | null;
  location: string | null;
  displayName: string | null;
  userId: string | null;
};

type GameLogResourceLoadEntry = {
  created_at: string | null;
  resourceUrl: string | null;
  type: string | null;
  location: string | null;
};

type GameLogEventEntry = {
  created_at: string | null;
  data: string | null;
};

type GameLogExternalEntry = {
  created_at: string | null;
  message: string | null;
  displayName: string | null;
  userId: string | null;
  location: string | null;
};

type GameLogDeleteTarget = {
  type?: string | null;
  created_at: string | null;
  videoUrl?: string | null;
  location?: string | null;
  data?: string | null;
  message?: string | null;
  resourceUrl?: string | null;
};

type GameLogInstanceDeleteTarget = {
  id: string | null;
  displayName: string | null;
  location: string | null;
  events: (number | null)[];
};

type GameLogPersistedEntry<T> = T & { rowId: number };

function logWriteError(error: unknown): void {
  console.error(error);
}

function runWrite(write: Promise<void>): void {
  void sqliteService.run(write).catch(logWriteError);
}

async function insertEntry<T extends object>(insert: Promise<number>, entry: T): Promise<GameLogPersistedEntry<T> | undefined> {
  const rowId = await sqliteService.run(insert);
  return rowId ? { ...entry, rowId } : undefined;
}

function addGamelogLocationToDatabase(entry: GameLogLocationEntry) {
  return insertEntry(DatabaseApi.AddGamelogLocation(entry.created_at, entry.location, entry.worldId, entry.worldName, entry.time, entry.groupName), entry);
}

function updateGamelogLocationTimeToDatabase(entry: { created_at: string | null; time: number }): void {
  runWrite(DatabaseApi.UpdateGamelogLocationTime(entry.created_at, entry.time));
}

function addGamelogJoinLeaveToDatabase(entry: GameLogJoinLeaveEntry) {
  return insertEntry(DatabaseApi.AddGamelogJoinLeave(entry.created_at, entry.type, entry.displayName, entry.location, entry.userId, entry.time), entry);
}

async function addGamelogJoinLeaveBulk(inputData: GameLogJoinLeaveEntry[]) {
  if (inputData.length === 0) {
    return [];
  }
  const entries = await Promise.all(inputData.map((entry) => addGamelogJoinLeaveToDatabase(entry)));
  return entries.filter((entry) => entry !== undefined);
}

function addGamelogPortalSpawnToDatabase(entry: GameLogPortalSpawnEntry) {
  return insertEntry(
    DatabaseApi.AddGamelogPortalSpawn(entry.created_at, entry.displayName, entry.location, entry.userId, entry.instanceId, entry.worldName),
    entry
  );
}

function addGamelogVideoPlayToDatabase(entry: GameLogVideoPlayEntry) {
  return insertEntry(
    DatabaseApi.AddGamelogVideoPlay(entry.created_at, entry.videoUrl, entry.videoName, entry.videoId, entry.location, entry.displayName, entry.userId),
    entry
  );
}

function updateGamelogVideoPlayName(rowId: number, videoName: string | null) {
  return sqliteService.run(DatabaseApi.UpdateGamelogVideoPlayName(rowId, videoName));
}

function addGamelogResourceLoadToDatabase(entry: GameLogResourceLoadEntry) {
  return insertEntry(DatabaseApi.AddGamelogResourceLoad(entry.created_at, entry.resourceUrl, entry.type, entry.location), entry);
}

function addGamelogEventToDatabase(entry: GameLogEventEntry) {
  return insertEntry(DatabaseApi.AddGamelogEvent(entry.created_at, entry.data), entry);
}

function addGamelogExternalToDatabase(entry: GameLogExternalEntry) {
  return insertEntry(DatabaseApi.AddGamelogExternal(entry.created_at, entry.message, entry.displayName, entry.userId, entry.location), entry);
}

function deleteGameLogInstanceByInstanceId(input: { location: string | null }): void {
  runWrite(DatabaseApi.DeleteGameLogInstanceByLocation(input.location));
}

function deleteGameLogInstance(input: GameLogInstanceDeleteTarget): void {
  const eventIds = input.events.flatMap((eventId) => (eventId === null ? [] : [String(eventId)]));
  runWrite(DatabaseApi.DeleteGameLogInstance(input.id, input.displayName, input.location, eventIds));
}

function deleteGameLogVideoPlay(input: GameLogDeleteTarget): void {
  runWrite(DatabaseApi.DeleteGameLogVideoPlay(input.created_at, input.videoUrl ?? null, input.location ?? null));
}

function deleteGameLogEvent(input: GameLogDeleteTarget): void {
  runWrite(DatabaseApi.DeleteGameLogEvent(input.created_at, input.data ?? null));
}

function deleteGameLogExternal(input: GameLogDeleteTarget): void {
  runWrite(DatabaseApi.DeleteGameLogExternal(input.created_at, input.message ?? null));
}

function deleteGameLogResourceLoad(input: GameLogDeleteTarget): void {
  runWrite(DatabaseApi.DeleteGameLogResourceLoad(input.created_at, input.resourceUrl ?? null, input.location ?? null));
}

function deleteGameLogEntry(input: GameLogDeleteTarget): void {
  switch (input.type ?? "") {
    case "VideoPlay":
      deleteGameLogVideoPlay(input);
      break;
    case "Event":
      deleteGameLogEvent(input);
      break;
    case "External":
      deleteGameLogExternal(input);
      break;
    case "StringLoad":
    case "ImageLoad":
      deleteGameLogResourceLoad(input);
      break;
    default:
      break;
  }
}

export {
  addGamelogEventToDatabase,
  addGamelogExternalToDatabase,
  addGamelogJoinLeaveBulk,
  addGamelogJoinLeaveToDatabase,
  addGamelogLocationToDatabase,
  addGamelogPortalSpawnToDatabase,
  addGamelogResourceLoadToDatabase,
  addGamelogVideoPlayToDatabase,
  deleteGameLogEntry,
  deleteGameLogEvent,
  deleteGameLogExternal,
  deleteGameLogInstance,
  deleteGameLogInstanceByInstanceId,
  deleteGameLogResourceLoad,
  deleteGameLogVideoPlay,
  updateGamelogLocationTimeToDatabase,
  updateGamelogVideoPlayName,
};
