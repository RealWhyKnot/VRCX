import { image, type Dataset, type Json, type JsonObject } from "./fixtures.ts";

type ApiReply = { status: number; body: Json };
type ApiRoute = { method: string; pattern: RegExp; reply: (match: RegExpExecArray, query: URLSearchParams) => Json | ApiReply };
type ApiResult = { Item1: number; Item2: string };

const API_ROOT = "/api/1/";
const ID_PATTERN = /^(usr|wrld|avtr|grp|file|inv|prnt|fvgrp)_[0-9a-f-]+$/u;

function isApiReply(value: Json | ApiReply): value is ApiReply {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "status" in value && "body" in value && typeof value.status === "number";
}

function page<T>(items: T[], query: URLSearchParams, fallback: number): T[] {
  const size = Number(query.get("n") ?? fallback);
  const offset = Number(query.get("offset") ?? 0);
  const start = Number.isFinite(offset) ? offset : 0;
  return items.slice(start, start + (Number.isFinite(size) ? size : fallback));
}

function syntheticUser(id: string): JsonObject {
  return {
    id,
    displayName: `Guest ${id.slice(4, 10)}`,
    username: id.slice(4, 14),
    bio: "",
    bioLinks: [],
    currentAvatarImageUrl: image("avatar", id),
    currentAvatarThumbnailImageUrl: image("avatar-thumb", id),
    currentAvatarTags: [],
    developerType: "none",
    friendKey: "",
    isFriend: false,
    last_activity: "",
    last_login: "",
    last_platform: "standalonewindows",
    location: "",
    platform: "",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    status: "offline",
    statusDescription: "",
    state: "offline",
    tags: ["system_trust_basic"],
    userIcon: "",
    pronouns: "",
    date_joined: "2021-01-01",
    badges: [],
  };
}

function publicProfile(user: JsonObject): JsonObject {
  return {
    id: user["id"] ?? "",
    displayName: user["displayName"] ?? "",
    bio: user["bio"] ?? "",
    bioLinks: user["bioLinks"] ?? [],
    badges: [],
    hasVrcPlus: false,
    pronouns: user["pronouns"] ?? "",
    profilePicOverride: "",
    userIcon: "",
    tags: user["tags"] ?? [],
  };
}

function instanceFor(location: string, data: Dataset): JsonObject {
  const [worldId = "", rest = ""] = location.split(":");
  const world = data.worlds.find((entry) => entry.id === worldId) ?? data.worlds[0] ?? {};
  const instanceId = rest.split("~")[0] ?? "";
  return {
    id: location,
    location,
    instanceId: rest,
    name: instanceId,
    worldId,
    world,
    type: rest.includes("~private(") ? "private" : rest.includes("~friends(") ? "friends" : rest.includes("~hidden(") ? "hidden" : "public",
    region: "us",
    photonRegion: "us",
    n_users: 12,
    userCount: 12,
    capacity: 32,
    recommendedCapacity: 16,
    platforms: { standalonewindows: 10, android: 2 },
    users: [],
    active: true,
    full: false,
    canRequestInvite: false,
    permanent: false,
    strict: false,
    hasCapacityForYou: true,
    queueEnabled: false,
    queueSize: 0,
    ownerId: null,
    tags: [],
    closedAt: null,
    hardClose: null,
    secureName: instanceId,
    shortName: null,
    displayName: null,
  };
}

function createApiRoutes(data: Dataset): ApiRoute[] {
  const userById = new Map(data.friends.map((friend) => [friend.id, friend]));
  const worldById = new Map(data.worlds.map((world) => [world.id, world]));
  const avatarById = new Map(data.avatars.map((avatar) => [avatar.id, avatar]));
  const groupById = new Map(data.groups.map((group) => [group.id, group]));
  const currentUserId = data.currentUser.id;
  return [
    {
      method: "GET",
      pattern: /^config$/u,
      reply: () => ({
        address: "",
        announcements: [],
        clientApiKey: "page-check",
        whiteListedAssetUrls: ["https://assets.vrchat.test/"],
        constants: { LANGUAGE: { SPOKEN_LANGUAGE_OPTIONS: { eng: "English", jpn: "Japanese", kor: "Korean", deu: "German", fra: "French" } } },
        serverName: "page-check",
        sdkUnityVersion: "2022.3.22f1",
        downloadUrls: {},
        events: {},
      }),
    },
    { method: "GET", pattern: /^auth$/u, reply: () => ({ ok: true, token: "page-check-token" }) },
    { method: "GET", pattern: /^auth\/user$/u, reply: () => data.currentUser },
    {
      method: "GET",
      pattern: /^auth\/user\/friends$/u,
      reply: (_match, query) => {
        const isOffline = query.get("offline") === "true";
        return page(
          data.friends.filter((friend) => (friend.state === "offline") === isOffline),
          query,
          50
        );
      },
    },
    { method: "GET", pattern: /^auth\/user\/(notifications|playermoderations|avatarmoderations)$/u, reply: () => [] },
    { method: "GET", pattern: /^notifications$/u, reply: () => [] },
    { method: "GET", pattern: /^visits$/u, reply: () => 48213 },
    { method: "GET", pattern: /^favorite\/groups$/u, reply: (_match, query) => page(data.favoriteGroups, query, 50) },
    {
      method: "GET",
      pattern: /^favorites$/u,
      reply: (_match, query) => {
        const type = query.get("type");
        return page(
          data.favorites.filter((favorite) => type === null || favorite.type === type),
          query,
          300
        );
      },
    },
    {
      method: "GET",
      pattern: /^auth\/user\/favoritelimits$|^favorite\/limits$/u,
      reply: () => ({
        defaultMaxFavoriteGroups: { avatar: 6, friend: 3, world: 4 },
        defaultMaxFavoritesPerGroup: { avatar: 50, friend: 150, world: 100 },
        maxFavoriteGroups: { avatar: 6, friend: 4, world: 4 },
        maxFavoritesPerGroup: { avatar: 50, friend: 150, world: 100 },
      }),
    },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)$/u, reply: (match) => userById.get(match[1] ?? "") ?? syntheticUser(match[1] ?? "") },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)\/groups$/u, reply: () => data.groups.slice(0, 12) },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)\/groups\/represented$/u, reply: () => ({}) },
    {
      method: "GET",
      pattern: /^worlds\/(wrld_[0-9a-f-]+)$/u,
      reply: (match) => worldById.get(match[1] ?? "") ?? { status: 404, body: { error: { message: "World not found", status_code: 404 } } },
    },
    { method: "GET", pattern: /^worlds$/u, reply: (_match, query) => page(data.worlds, query, 50) },
    {
      method: "GET",
      pattern: /^avatars\/(avtr_[0-9a-f-]+)$/u,
      reply: (match) => avatarById.get(match[1] ?? "") ?? { status: 404, body: { error: { message: "Avatar not found", status_code: 404 } } },
    },
    { method: "GET", pattern: /^avatars$/u, reply: (_match, query) => (query.get("user") === "me" ? page(data.avatars, query, 50) : []) },
    {
      method: "GET",
      pattern: /^groups\/(grp_[0-9a-f-]+)$/u,
      reply: (match) => groupById.get(match[1] ?? "") ?? { status: 404, body: { error: { message: "Group not found", status_code: 404 } } },
    },
    { method: "GET", pattern: /^instances\/(wrld_.+)$/u, reply: (match) => instanceFor(decodeURIComponent(match[1] ?? ""), data) },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)\/instances\/groups$/u, reply: () => ({ instances: [], fetchedAt: new Date().toISOString() }) },
    { method: "PUT", pattern: new RegExp(`^users/${currentUserId}$`, "u"), reply: () => data.currentUser },
    { method: "GET", pattern: /^profile\/(usr_[0-9a-f-]+)$/u, reply: (match) => publicProfile(userById.get(match[1] ?? "") ?? syntheticUser(match[1] ?? "")) },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)\/clientConfig$/u, reply: () => ({}) },
    { method: "GET", pattern: /^users\/(usr_[0-9a-f-]+)\/groups\/permissions$/u, reply: () => ({}) },
    { method: "GET", pattern: /^prints\/user\/(usr_[0-9a-f-]+)$/u, reply: () => [] },
    { method: "GET", pattern: /^inventory$/u, reply: () => ({ data: [], totalCount: 0 }) },
    { method: "GET", pattern: /^inventory\/global$/u, reply: () => [] },
    { method: "PUT", pattern: /^(?:auth\/user\/)?notifications\/([^/]+)\/see$/u, reply: (match) => ({ id: match[1] ?? "", seen: true }) },
    {
      method: "GET",
      pattern:
        /^(files|jams|userNotes|auth\/permissions|avatars\/favorites|worlds\/favorites|instanceCategories|instanceVibes|instances\/discover|instances\/active|economy\/purchases|economy\/store\/shelves|cosmetics\/index\/\w+)$/u,
      reply: () => [],
    },
    {
      method: "GET",
      pattern: /^api\/v2\/status\.json$/u,
      reply: () => ({ page: { updated_at: "2026-11-26T00:00:00.000Z" }, status: { description: "All Systems Operational", indicator: "none" } }),
    },
    { method: "GET", pattern: /^api\/v2\/summary\.json$/u, reply: () => ({ page: { updated_at: "2026-11-26T00:00:00.000Z" }, components: [], incidents: [] }) },
  ];
}

function defaultReply(method: string, path: string): ApiReply {
  if (method !== "GET") {
    return { status: 200, body: {} };
  }
  const last = path.split("/").at(-1) ?? "";
  if (ID_PATTERN.test(last) && last.startsWith("usr_")) {
    return { status: 200, body: syntheticUser(last) };
  }
  if (ID_PATTERN.test(last)) {
    return { status: 404, body: { error: { message: "Not found", status_code: 404 } } };
  }
  return { status: 200, body: [] };
}

function createVrchatApi(data: Dataset, onRequest: (endpoint: string, isKnown: boolean) => void) {
  const routes = createApiRoutes(data);
  return (options: unknown): ApiResult => {
    const url = typeof options === "object" && options !== null && "url" in options && typeof options.url === "string" ? options.url : "";
    const method = typeof options === "object" && options !== null && "method" in options && typeof options.method === "string" ? options.method : "GET";
    const parsed = new URL(url);
    const path = parsed.pathname.startsWith(API_ROOT) ? parsed.pathname.slice(API_ROOT.length) : parsed.pathname.slice(1);
    const endpoint = `${method} ${path.replace(/(usr|wrld|avtr|grp|file)_[0-9a-f-]+/gu, "$1_*")}`;
    for (const route of routes) {
      const match = route.method === method ? route.pattern.exec(path) : null;
      if (match) {
        onRequest(endpoint, true);
        const result = route.reply(match, parsed.searchParams);
        const reply = isApiReply(result) ? result : { status: 200, body: result };
        return { Item1: reply.status, Item2: JSON.stringify(reply.body) };
      }
    }
    onRequest(endpoint, false);
    const reply = defaultReply(method, path);
    return { Item1: reply.status, Item2: JSON.stringify(reply.body) };
  };
}

export { createVrchatApi };
