import type { Ref } from "vue";
import { convertYoutubeTime } from "../../shared/utils/base/format";
import { findUserByDisplayName } from "../../shared/utils/user";
import { isRpcWorld } from "../../shared/utils/world";
import { replaceBioSymbols } from "../../shared/utils/base/string";
import type { useAdvancedSettingsStore } from "../settings/advanced";
import type { useUserStore } from "../user";
import type { NowPlaying, NowPlayingUpdate } from "./types";

export type MediaVideoInput = {
  dt: string;
  videoUrl: string;
  videoId?: string;
  videoPos?: number;
  displayName?: string;
  mediaIdOverride?: string;
};

export type MediaParsersDeps = {
  nowPlaying: Ref<NowPlaying>;
  setNowPlaying: (data: NowPlayingUpdate) => Promise<void>;
  clearNowPlaying: () => void;
  userStore: Pick<ReturnType<typeof useUserStore>, "cachedUsers" | "cachedUserIdsByDisplayName">;
  advancedSettingsStore: Pick<ReturnType<typeof useAdvancedSettingsStore>, "youTubeApi" | "lookupYouTubeVideo">;
};

type YouTubeVideoItem = {
  snippet: { title: string };
  contentDetails: { duration: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readField(source: unknown, key: string): unknown {
  if (!isRecord(source)) {
    return undefined;
  }
  return source[key];
}

function isYouTubeVideoItem(value: unknown): value is YouTubeVideoItem {
  return typeof readField(readField(value, "snippet"), "title") === "string" && typeof readField(readField(value, "contentDetails"), "duration") === "string";
}

function readYouTubeVideoItem(lookup: unknown): YouTubeVideoItem {
  const items = readField(lookup, "items");
  const item: unknown = Array.isArray(items) ? items[0] : undefined;
  if (!isYouTubeVideoItem(item)) {
    throw new Error("YouTube lookup returned no usable video");
  }
  return item;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function orFallback(value: string | undefined, fallback: string): string {
  if (value) {
    return value;
  }
  return fallback;
}

export function createMediaParsers({ nowPlaying, setNowPlaying, clearNowPlaying, userStore, advancedSettingsStore }: MediaParsersDeps) {
  async function addGameLogVideo(gameLog: MediaVideoInput, location: string, userId: string) {
    let url: URL | undefined;
    const videoUrl = gameLog.videoUrl;
    let youtubeVideoId = "";
    let videoId = "";
    let videoName = "";
    let videoLength = 0;
    let displayName = "";
    let videoPos = 8;
    if (typeof gameLog.displayName !== "undefined") {
      displayName = gameLog.displayName;
    }
    if (typeof gameLog.videoPos !== "undefined") {
      videoPos = gameLog.videoPos;
    }
    if (!isRpcWorld(location) || gameLog.videoId === "YouTube") {
      try {
        url = new URL(videoUrl);
        if (url.origin === "https://t-ne.x0.to" || url.origin === "https://nextnex.com" || url.origin === "https://r.0cm.org") {
          url = new URL(String(url.searchParams.get("url")));
        }
        if (videoUrl.startsWith("https://u2b.cx/")) {
          url = new URL(videoUrl.substring(15));
        }
        const id1 = url.pathname;
        const id2 = url.searchParams.get("v");
        if (id1.length === 12) {
          youtubeVideoId = id1.substring(1, 12);
        }
        if (id1.length === 19) {
          youtubeVideoId = id1.substring(8, 19);
        }
        if (id2?.length === 11) {
          youtubeVideoId = id2;
        }
        if (advancedSettingsStore.youTubeApi && youtubeVideoId) {
          const item = readYouTubeVideoItem(await advancedSettingsStore.lookupYouTubeVideo(youtubeVideoId));
          videoId = "YouTube";
          videoName = item.snippet.title;
          videoLength = convertYoutubeTime(item.contentDetails.duration);
        }
      } catch {
        console.error(`Invalid URL: ${String(url)}`);
      }
      const entry = {
        created_at: gameLog.dt,
        type: "VideoPlay",
        videoUrl,
        videoId: orFallback(gameLog.mediaIdOverride, videoId),
        videoName,
        videoLength,
        location,
        displayName,
        userId,
        videoPos,
        thumbnailUrl: "",
      };
      await setNowPlaying(entry);
    }
  }

  async function addGameLogVRDancing(gameLog: { dt: string; data: string }, location: string) {
    const data = /VideoPlay\(VRDancing\) "(.+?)",([\d.]+),([\d.]+),(-?[\d.]+),"(.+?)","(.+?)"/g.exec(gameLog.data);
    if (!data) {
      console.error("failed to parse", gameLog.data);
      return;
    }
    const videoUrl = data[1] ?? "";
    let videoPos = Number(data[2]);
    const videoLength = Number(data[3]);
    let videoId = data[4] ?? "";
    const displayName = data[5] ?? "";
    let videoName = data[6] ?? "";
    if (videoId === "-1") {
      videoId = "YouTube";
    }
    const videoNameIndex = videoName.indexOf("]</b> ");
    if (videoNameIndex !== -1) {
      videoName = videoName.substring(videoNameIndex + 6);
    }
    if (videoPos === videoLength) {
      videoPos = 0;
    }
    if (videoUrl === nowPlaying.value.url) {
      const entry = {
        created_at: gameLog.dt,
        updatedAt: gameLog.dt,
        videoUrl,
        videoLength,
        videoPos,
        thumbnailUrl: "",
      };
      await setNowPlaying(entry);
      return;
    }
    let userId = "";
    if (displayName) {
      userId = findUserByDisplayName(userStore.cachedUsers, displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "";
    }
    if (videoId === "YouTube") {
      const entry1 = {
        dt: gameLog.dt,
        videoUrl,
        displayName,
        videoPos,
        videoId,
      };
      await addGameLogVideo(entry1, location, userId);
    } else {
      const entry2 = {
        created_at: gameLog.dt,
        type: "VideoPlay",
        videoUrl,
        videoId,
        videoName,
        videoLength,
        location,
        displayName,
        userId,
        videoPos,
        thumbnailUrl: "",
      };
      await setNowPlaying(entry2);
    }
  }

  async function addGameLogLSMedia(gameLog: { dt: string; data: string }, location: string) {
    const data = /LSMedia ([\d.]+),([\d.]+),(.+?),(.+?),(?=[^,]*$)/g.exec(gameLog.data);
    if (!data) {
      return;
    }
    const videoPos = Number(data[1]);
    const videoLength = Number(data[2]);
    const displayName = data[3] ?? "";
    const videoName = replaceBioSymbols(data[4]);
    const videoUrl = videoName;
    const videoId = "LSMedia";
    if (videoUrl === nowPlaying.value.url) {
      const entry = {
        created_at: gameLog.dt,
        updatedAt: gameLog.dt,
        videoUrl,
        videoLength,
        videoPos,
        thumbnailUrl: "",
      };
      await setNowPlaying(entry);
      return;
    }
    let userId = "";
    if (displayName) {
      userId = findUserByDisplayName(userStore.cachedUsers, displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "";
    }
    const entry1 = {
      created_at: gameLog.dt,
      type: "VideoPlay",
      videoUrl,
      videoId,
      videoName,
      videoLength,
      location,
      displayName,
      userId,
      videoPos,
      thumbnailUrl: "",
    };
    await setNowPlaying(entry1);
  }

  async function addGameLogPopcornPalace(gameLog: { dt: string; data: string }, location: string) {
    const data = gameLog.data;
    if (!data) {
      return;
    }
    let parsed: unknown;
    try {
      const j = data.indexOf("{");
      parsed = JSON.parse(data.substring(j));
    } catch (err: unknown) {
      console.error("Failed to parse PopcornPalace data:", err);
      return;
    }

    const videoPos = Number(readField(parsed, "videoPos"));
    const videoLength = Number(readField(parsed, "videoLength"));
    const displayName = readString(readField(parsed, "displayName"));
    const videoName = readString(readField(parsed, "videoName"));
    const videoUrl = videoName;
    const videoId = "PopcornPalace";
    const thumbnailUrl = readString(readField(parsed, "thumbnailUrl"));
    if (!videoName) {
      clearNowPlaying();
      return;
    }
    if (videoUrl === nowPlaying.value.url) {
      const entry = {
        created_at: gameLog.dt,
        updatedAt: gameLog.dt,
        videoUrl,
        videoLength,
        videoPos,
        thumbnailUrl,
      };
      await setNowPlaying(entry);
      return;
    }
    let userId = "";
    if (displayName) {
      userId = findUserByDisplayName(userStore.cachedUsers, displayName, userStore.cachedUserIdsByDisplayName)?.id ?? "";
    }
    const entry1 = {
      created_at: gameLog.dt,
      type: "VideoPlay",
      videoUrl,
      videoId,
      videoName,
      videoLength,
      location,
      displayName,
      userId,
      videoPos,
      thumbnailUrl,
    };
    await setNowPlaying(entry1);
  }

  return {
    addGameLogVideo,
    addGameLogVRDancing,
    addGameLogLSMedia,
    addGameLogPopcornPalace,
  };
}
