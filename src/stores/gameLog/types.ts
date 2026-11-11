export type SessionsViewMode = "sessions" | "table";

export type GameLogSessionMember = {
  displayName: string | null;
  userId: string | null;
  created_at: string;
  isFriend: boolean;
  isFavorite: boolean;
};

export type GameLogEntry = {
  rowId?: number | null | undefined;
  uid?: string | undefined;
  type: string;
  created_at: string;
  displayName?: string | null | undefined;
  userId?: string | null | undefined;
  location?: string | null | undefined;
  worldId?: string | null | undefined;
  worldName?: string | null | undefined;
  groupName?: string | null | undefined;
  time?: number | null | undefined;
  videoUrl?: string | null | undefined;
  videoName?: string | null | undefined;
  videoId?: string | null | undefined;
  data?: string | null | undefined;
  message?: string | null | undefined;
  resourceUrl?: string | null | undefined;
  members?: GameLogSessionMember[] | undefined;
  isFriend?: boolean | undefined;
  isFavorite?: boolean | undefined;
};

export type PersistedGameLogEntry = GameLogEntry & { rowId: number };

export type GameLogLocationInput = {
  type: string;
  created_at: string;
  location: string;
  worldId: string;
  worldName: string;
  time: number;
};

export type GameLogLocationEntry = GameLogLocationInput & {
  groupName: string;
};

export type NowPlayingUpdate = {
  created_at: string;
  updatedAt?: string | undefined;
  videoUrl: string;
  videoName?: string | null | undefined;
  videoId?: string | null | undefined;
  videoLength: number;
  videoPos: number;
  displayName?: string | undefined;
  userId?: string | undefined;
  location?: string | null | undefined;
  thumbnailUrl: string;
  urlHidden?: boolean | undefined;
};

export type NowPlaying = {
  url: string;
  name: string;
  videoName: string;
  length: number;
  startTime: number;
  offset: number;
  elapsed: number;
  percentage: number;
  remainingText: string;
  playing: boolean;
  thumbnailUrl: string;
  speed: number;
  paused: boolean;
  spec: boolean;
  urlHidden: boolean;
};

export type GameLogTableState = {
  loading: boolean;
  search: string;
  filter: string[];
  pageSize: number;
  pageSizeLinked: boolean;
  vip: boolean;
};

export type SessionLocation = {
  id: number;
  created_at: string;
  location?: string | null | undefined;
  worldId?: string | null | undefined;
  worldName?: string | null | undefined;
  time?: number | null | undefined;
  groupName?: string | null | undefined;
};

export type SessionSegment = {
  id: number;
  created_at: string;
  location?: string | null | undefined;
  worldId?: string | null | undefined;
  worldName?: string | null | undefined;
  groupName?: string | null | undefined;
  duration?: number | null | undefined;
  events: GameLogEntry[];
};
