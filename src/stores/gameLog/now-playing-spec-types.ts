import type { Ref } from "vue";

export type NowPlayingState = {
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

export type NowPlayingEntry = {
  created_at: string;
  type: "VideoPlay";
  videoUrl: string;
  videoId: string;
  videoName: string;
  videoLength: number;
  location: string;
  displayName: string;
  userId: string;
  videoPos: number;
  thumbnailUrl: string;
  urlHidden: boolean;
};

export type NowPlayingVideoEntry = {
  dt: string;
  videoUrl: string;
  displayName: string;
  videoPos: number;
  mediaIdOverride: string;
};

export type NowPlayingGameLog = {
  data: string;
  dt: string;
};

export type NowPlayingSpecEvent = {
  id: string;
  type: string;
  mediaUrl?: unknown;
  mediaName?: unknown;
  mediaImage?: unknown;
  mediaOwnerName?: unknown;
  mediaId?: unknown;
  mediaLength?: unknown;
  mediaSpeed?: unknown;
  mediaTime?: unknown;
  hideUrl?: unknown;
  highPriority?: unknown;
  loading?: unknown;
};

export type NowPlayingSpecDeps = {
  nowPlaying: Ref<NowPlayingState>;
  setNowPlaying: (entry: NowPlayingEntry) => Promise<void>;
  clearNowPlaying: () => void;
  startNowPlayingTicker: () => void;
  updateNowPlayingVideoName: (videoName: string) => Promise<void>;
  addGameLogVideo: (entry: NowPlayingVideoEntry, location: string, userId: string) => Promise<void>;
};
