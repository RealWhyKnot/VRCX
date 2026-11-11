import type { NowPlayingGameLog, NowPlayingSpecDeps, NowPlayingSpecEvent } from "./now-playing-spec-types";

type NowPlayingProducer = {
  id: string;
  hasMedia: boolean;
  url: string;
  publishedUrl: string;
  name: string;
  image: string;
  ownerName: string;
  mediaId: string;
  length: number;
  speed: number;
  hideUrl: boolean;
  highPriority: boolean;
  anchorPos: number;
  anchorWall: number;
  paused: boolean;
  stopped: boolean;
  loading: boolean;
  lastChange: number;
};

function isNowPlayingSpecEvent(value: unknown): value is NowPlayingSpecEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "id" in value && typeof value.id === "string" && value.id !== "" && "type" in value && typeof value.type === "string";
}

function parseEvent(data: string): NowPlayingSpecEvent | null {
  try {
    const event: unknown = JSON.parse(data);
    if (isNowPlayingSpecEvent(event)) {
      return event;
    }
  } catch {
    console.warn("Failed to parse nowplaying event:", data);
  }
  return null;
}

function parseMediaId(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function decodeUrl(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

function getYouTubeVideoId(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null | undefined = "";
  if (host === "youtu.be") {
    id = parsed.pathname.split("/")[1];
  } else if (host === "youtube.com") {
    const [, section, pathId] = parsed.pathname.split("/");
    if (section === "watch") {
      id = parsed.searchParams.get("v");
    } else if (["shorts", "live", "embed"].includes(section ?? "")) {
      id = pathId;
    }
  }
  return typeof id === "string" && /^[\w-]{11}$/.test(id) ? id : "";
}

function getMediaImage(image: unknown, url: string): string {
  if (typeof image === "string" && image) {
    return image;
  }
  const youtubeId = getYouTubeVideoId(url);
  return youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "";
}

function createProducer(id: string): NowPlayingProducer {
  return {
    id,
    hasMedia: false,
    url: "",
    publishedUrl: "",
    name: "",
    image: "",
    ownerName: "",
    mediaId: "",
    length: 0,
    speed: 1,
    hideUrl: false,
    highPriority: false,
    anchorPos: 0,
    anchorWall: 0,
    paused: false,
    stopped: false,
    loading: false,
    lastChange: 0,
  };
}

function getPosition(producer: NowPlayingProducer, now: number): number {
  if (producer.paused || producer.stopped) {
    return producer.anchorPos;
  }
  const pos = producer.anchorPos + (now - producer.anchorWall) * producer.speed;
  return producer.length > 0 ? Math.min(pos, producer.length) : pos;
}

function setAnchor(producer: NowPlayingProducer, now: number, mediaTime?: unknown): void {
  producer.anchorPos = typeof mediaTime === "number" ? Math.max(0, mediaTime) : getPosition(producer, now);
  producer.anchorWall = now;
}

function getDisplayUrl(producer: NowPlayingProducer): string {
  return producer.hideUrl ? producer.name : producer.url;
}

export function createNowPlayingSpecHandler({
  nowPlaying,
  setNowPlaying,
  clearNowPlaying,
  startNowPlayingTicker,
  updateNowPlayingVideoName,
  addGameLogVideo,
}: NowPlayingSpecDeps) {
  const producers = new Map<string, NowPlayingProducer>();
  let followedId = "";
  let changeSequence = 0;

  function pickFollowed(): NowPlayingProducer | null {
    let best: NowPlayingProducer | null = null;
    for (const producer of producers.values()) {
      if (!producer.hasMedia || producer.stopped) {
        continue;
      }
      if (!best || (producer.highPriority && !best.highPriority) || (producer.highPriority === best.highPriority && producer.lastChange > best.lastChange)) {
        best = producer;
      }
    }
    return best;
  }

  async function publishMedia(producer: NowPlayingProducer, location: string, dt: string): Promise<void> {
    const videoUrl = getDisplayUrl(producer);
    producer.publishedUrl = videoUrl;
    if (!videoUrl) {
      if (nowPlaying.value.spec) {
        clearNowPlaying();
      }
      return;
    }
    if (nowPlaying.value.url === videoUrl) {
      if (producer.name) {
        const owner = producer.ownerName ? ` (${producer.ownerName})` : "";
        nowPlaying.value.name = `${producer.name}${owner}`;
        nowPlaying.value.videoName = producer.name;
        await updateNowPlayingVideoName(producer.name);
      }
      nowPlaying.value.thumbnailUrl = producer.image;
      return;
    }
    if (!producer.name && !producer.hideUrl) {
      await addGameLogVideo({ dt, videoUrl, displayName: producer.ownerName, videoPos: 0, mediaIdOverride: producer.mediaId }, location, "");
      return;
    }
    await setNowPlaying({
      created_at: dt,
      type: "VideoPlay",
      videoUrl,
      videoId: producer.mediaId || (producer.id.split("-")[0] ?? ""),
      videoName: producer.name,
      videoLength: producer.length,
      location,
      displayName: producer.ownerName,
      userId: "",
      videoPos: 0,
      thumbnailUrl: producer.image,
      urlHidden: producer.hideUrl,
    });
  }

  function applyTiming(producer: NowPlayingProducer, now: number): void {
    const np = nowPlaying.value;
    if (!np.url || np.url !== producer.publishedUrl) {
      return;
    }
    const speed = producer.speed > 0 ? producer.speed : 1;
    const pos = getPosition(producer, now);
    np.spec = true;
    np.urlHidden = producer.hideUrl;
    np.speed = speed;
    np.paused = producer.paused;
    np.length = producer.length || np.length;
    np.offset = pos;
    np.elapsed = pos;
    np.startTime = now - pos / speed;
    np.playing = np.length > 0;
    startNowPlayingTicker();
  }

  async function sync(changed: NowPlayingProducer, isMediaChange: boolean, location: string, dt: string, now: number): Promise<void> {
    const followed = pickFollowed();
    if (!followed) {
      if (followedId && nowPlaying.value.spec) {
        clearNowPlaying();
      }
      followedId = "";
      return;
    }
    const isSwitched = followed.id !== followedId;
    if (isSwitched || (isMediaChange && followed === changed)) {
      followedId = followed.id;
      await publishMedia(followed, location, dt);
    }
    if (isSwitched || followed === changed || isMediaChange) {
      applyTiming(followed, now);
    }
  }

  async function handleNowPlayingEvent(gameLog: NowPlayingGameLog, location: string): Promise<void> {
    const event = parseEvent(gameLog.data);
    if (!event) {
      return;
    }
    const now = Date.parse(gameLog.dt) / 1000;
    let producer = producers.get(event.id);
    if (!producer) {
      producer = createProducer(event.id);
      producers.set(event.id, producer);
    }

    switch (event.type) {
      case "mediaChange": {
        const url = typeof event.mediaUrl === "string" ? decodeUrl(event.mediaUrl) : "";
        Object.assign(producer, {
          hasMedia: true,
          url,
          name: typeof event.mediaName === "string" ? event.mediaName : "",
          image: getMediaImage(event.mediaImage, url),
          ownerName: typeof event.mediaOwnerName === "string" ? event.mediaOwnerName : "",
          mediaId: parseMediaId(event.mediaId),
          length: typeof event.mediaLength === "number" && event.mediaLength > 0 ? event.mediaLength : 0,
          speed: typeof event.mediaSpeed === "number" && event.mediaSpeed > 0 ? event.mediaSpeed : 1,
          hideUrl: event.hideUrl === true,
          highPriority: event.highPriority === true,
          anchorPos: 0,
          anchorWall: now,
          paused: false,
          stopped: false,
          loading: false,
          lastChange: ++changeSequence,
        });
        await sync(producer, true, location, gameLog.dt, now);
        return;
      }
      case "mediaInfo":
        if (typeof event.mediaSpeed === "number" && event.mediaSpeed > 0) {
          setAnchor(producer, now);
          producer.speed = event.mediaSpeed;
        }
        if (typeof event.mediaName === "string") {
          producer.name = event.mediaName;
        }
        if (typeof event.mediaImage === "string") {
          producer.image = getMediaImage(event.mediaImage, producer.url);
        }
        if (producer.id !== followedId) {
          return;
        }
        if (!producer.publishedUrl) {
          if (producer.name) {
            await publishMedia(producer, location, gameLog.dt);
            applyTiming(producer, now);
          }
          return;
        }
        if (nowPlaying.value.spec) {
          if (typeof event.mediaName === "string" || typeof event.mediaImage === "string") {
            const owner = producer.ownerName ? ` (${producer.ownerName})` : "";
            nowPlaying.value.name = `${producer.name}${owner}`;
            nowPlaying.value.videoName = producer.name;
            nowPlaying.value.thumbnailUrl = producer.image;
            await updateNowPlayingVideoName(producer.name);
          }
          applyTiming(producer, now);
        }
        return;
      case "mediaLoading":
        producer.loading = event.loading === true;
        return;
      case "mediaError":
        producer.loading = false;
        return;
      case "mediaPlay":
        setAnchor(producer, now, event.mediaTime);
        producer.paused = false;
        producer.stopped = false;
        producer.loading = false;
        break;
      case "mediaPause":
        setAnchor(producer, now, event.mediaTime);
        producer.paused = true;
        producer.loading = false;
        break;
      case "mediaSeek":
        setAnchor(producer, now, event.mediaTime);
        break;
      case "mediaStop":
        setAnchor(producer, now);
        producer.stopped = true;
        producer.loading = false;
        break;
      default:
        console.warn("Unknown nowplaying event type:", event.type);
        return;
    }
    await sync(producer, false, location, gameLog.dt, now);
  }

  function resetNowPlayingProducers(): void {
    producers.clear();
    followedId = "";
  }

  function hasNowPlayingProducer(): boolean {
    return producers.size > 0;
  }

  return {
    handleNowPlayingEvent,
    resetNowPlayingProducers,
    hasNowPlayingProducer,
  };
}
