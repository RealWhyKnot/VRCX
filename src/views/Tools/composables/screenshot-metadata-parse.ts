export type ScreenshotPlayer = {
  id?: string | undefined;
  displayName?: string | undefined;
};

export type ScreenshotMetadata = {
  sourceFile?: string | undefined;
  filePath?: string | undefined;
  fileName?: string | undefined;
  previousFilePath?: string | undefined;
  nextFilePath?: string | undefined;
  fileResolution?: string | undefined;
  fileSize?: string | undefined;
  fileSizeBytes?: string | undefined;
  creationDate?: string | undefined;
  timestamp?: string | undefined;
  application?: string | undefined;
  dateTime?: number | undefined;
  note?: string | undefined;
  error?: string | undefined;
  world?: { name?: string | undefined; instanceId?: string | undefined } | undefined;
  author?: ScreenshotPlayer | undefined;
  players?: ScreenshotPlayer[] | undefined;
};

export type ScreenshotDialogState = {
  loading: boolean;
  search: string;
  searchType: string;
  searchTypes: string[];
  searchIndex: number | null;
  searchResults: string[] | null;
  metadata: ScreenshotMetadata;
  isUploading: boolean;
};

export type ScreenshotSearchRow = {
  filePath: string;
  dateTime: number;
  dateFormatted: string;
  world: string;
  playerCount: number;
  players: number;
  resolution: string;
  match: string;
  author: string;
};

export type ScreenshotSortKey = "dateTime" | "world" | "match" | "author" | "players";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function readPlayer(value: unknown): ScreenshotPlayer {
  if (!isRecord(value)) {
    return {};
  }
  return { id: readString(value, "id"), displayName: readString(value, "displayName") };
}

export function toLookupRef(player: ScreenshotPlayer): { userId?: string; displayName?: string } {
  const ref: { userId?: string; displayName?: string } = {};
  if (player.id !== undefined) {
    ref.userId = player.id;
  }
  if (player.displayName !== undefined) {
    ref.displayName = player.displayName;
  }
  return ref;
}

export function readScreenshotMetadata(record: Record<string, unknown>): ScreenshotMetadata {
  const world = record["world"];
  const author = record["author"];
  const players = record["players"];
  return {
    sourceFile: readString(record, "sourceFile"),
    filePath: readString(record, "filePath"),
    fileName: readString(record, "fileName"),
    previousFilePath: readString(record, "previousFilePath"),
    nextFilePath: readString(record, "nextFilePath"),
    fileResolution: readString(record, "fileResolution"),
    fileSize: readString(record, "fileSize"),
    fileSizeBytes: readString(record, "fileSizeBytes"),
    creationDate: readString(record, "creationDate"),
    timestamp: readString(record, "timestamp"),
    application: readString(record, "application"),
    dateTime: readNumber(record, "dateTime"),
    note: readString(record, "note"),
    error: readString(record, "error"),
    world: isRecord(world) ? { name: readString(world, "name"), instanceId: readString(world, "instanceId") } : undefined,
    author: isRecord(author) ? readPlayer(author) : undefined,
    players: Array.isArray(players) ? players.map(readPlayer) : undefined,
  };
}

export function parseJsonRecord(json: string): Record<string, unknown> | null {
  const parsed: unknown = JSON.parse(json);
  return isRecord(parsed) ? parsed : null;
}
