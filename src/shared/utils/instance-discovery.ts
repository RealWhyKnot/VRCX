export type DiscoverMode = "active" | "match" | "population" | "random";

export type DiscoverFilters = {
  region: string;
  platform: string;
  categoryId: string;
  vibeIds: string[];
  mode: DiscoverMode;
  minOccupants: number;
  isGroupHosted: boolean;
  isTrendingOnly: boolean;
};

export type DiscoveredInstance = {
  location: string;
  worldId: string;
  instanceId: string;
  shortName: string;
  displayName: string;
  description: string;
  worldName: string;
  worldAuthorName: string;
  worldImageUrl: string;
  userCount: number;
  capacity: number;
  queueSize: number;
  friendCount: number;
  friendIconUrls: string[];
  userIconUrls: string[];
  isFull: boolean;
  region: string;
  accessType: string;
  ownerId: string;
  ownerName: string;
  ownerIconUrl: string;
  categoryId: string;
  vibeIds: string[];
  dominantLanguage: string;
};

export const DISCOVER_PAGE_SIZE = 50;
export const DISCOVER_MAX_VIBES = 3;
export const DISCOVER_MAX_OCCUPANTS = 500;

const DISCOVER_REGIONS = ["us", "use", "eu", "jp"] as const;
const DISCOVER_PLATFORMS = ["standalonewindows", "android", "ios"] as const;
const DISCOVER_MODES = ["active", "population", "match", "random"] as const satisfies readonly DiscoverMode[];

export { DISCOVER_MODES, DISCOVER_PLATFORMS, DISCOVER_REGIONS };

export function createDiscoverFilters(): DiscoverFilters {
  return {
    region: "",
    platform: "",
    categoryId: "",
    vibeIds: [],
    mode: "active",
    minOccupants: 0,
    isGroupHosted: false,
    isTrendingOnly: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function count(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function textList(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const ICON_KEYS = ["iconUrl", "userIcon", "profilePicOverride", "imageUrl", "url"] as const;

function iconUrl(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }
  if (!isRecord(item)) {
    return "";
  }
  for (const key of ICON_KEYS) {
    const value = text(item, key);
    if (value) {
      return value;
    }
  }
  return "";
}

function iconList(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  return Array.isArray(value) ? value.map(iconUrl).filter((url) => url.startsWith("https://")) : [];
}

function listLength(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return Array.isArray(value) ? value.length : 0;
}

export function clampOccupants(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.min(DISCOVER_MAX_OCCUPANTS, Math.floor(amount));
}

export function buildDiscoverQuery(filters: DiscoverFilters): string {
  const query = new URLSearchParams();
  query.append("n", String(DISCOVER_PAGE_SIZE));
  query.append("mode", filters.mode);
  if (filters.region) {
    query.append("region", filters.region);
  }
  if (filters.platform) {
    query.append("platform", filters.platform);
  }
  if (filters.categoryId) {
    query.append("category", filters.categoryId);
  }
  for (const vibeId of filters.vibeIds.slice(0, DISCOVER_MAX_VIBES)) {
    query.append("vibe", vibeId);
  }
  const minOccupants = clampOccupants(filters.minOccupants);
  if (minOccupants > 0) {
    query.append("minOccupants", String(minOccupants));
  }
  if (filters.isGroupHosted) {
    query.append("groupHosted", "true");
  }
  if (filters.isTrendingOnly) {
    query.append("worldPool", "trending");
  }
  return query.toString();
}

export function toDiscoveredInstance(json: unknown): DiscoveredInstance | undefined {
  if (!isRecord(json)) {
    return undefined;
  }
  const world = isRecord(json["world"]) ? json["world"] : {};
  const worldId = text(json, "worldId") || text(world, "id");
  const instanceId = text(json, "instanceId");
  const location = text(json, "location") || (worldId && instanceId ? `${worldId}:${instanceId}` : "");
  if (!worldId || !location) {
    return undefined;
  }
  const capacity = count(json, "capacity") || count(world, "capacity");
  const userCount = count(json, "userCount") || count(json, "n_users");
  return {
    location,
    worldId,
    instanceId,
    shortName: text(json, "shortName"),
    displayName: text(json, "displayName"),
    description: text(json, "description"),
    worldName: text(world, "name") || worldId,
    worldAuthorName: text(world, "authorName"),
    worldImageUrl: text(world, "thumbnailImageUrl") || text(world, "imageUrl"),
    userCount,
    capacity,
    queueSize: count(json, "queueSize"),
    friendCount: listLength(json, "friendIcons"),
    friendIconUrls: iconList(json, "friendIcons"),
    userIconUrls: iconList(json, "userIcons"),
    isFull: json["full"] === true || (capacity > 0 && userCount >= capacity),
    region: text(json, "region") || text(json, "photonRegion"),
    accessType: text(json, "accessType") || text(json, "type"),
    ownerId: text(json, "ownerId"),
    ownerName: text(json, "ownerName"),
    ownerIconUrl: text(json, "ownerIconUrl"),
    categoryId: text(json, "categoryId"),
    vibeIds: textList(json, "vibeIds"),
    dominantLanguage: text(json, "dominantLanguage"),
  };
}

export function parseDiscovery(json: unknown): DiscoveredInstance[] {
  const list: unknown = isRecord(json) ? json["instances"] : json;
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set<string>();
  const instances: DiscoveredInstance[] = [];
  for (const item of list) {
    const instance = toDiscoveredInstance(item);
    if (instance && !seen.has(instance.location)) {
      seen.add(instance.location);
      instances.push(instance);
    }
  }
  return instances;
}

export function filterDiscovered(instances: DiscoveredInstance[], search: string): DiscoveredInstance[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return instances;
  }
  return instances.filter((instance) =>
    [instance.worldName, instance.worldAuthorName, instance.ownerName, instance.displayName, instance.description].some((value) =>
      value.toLowerCase().includes(needle)
    )
  );
}
