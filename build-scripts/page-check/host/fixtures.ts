import type { DataProfile } from "../contract.ts";
import { createRandom, type Random } from "./random.ts";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = Record<string, Json>;
type Entity = JsonObject & { id: string };
type Named = Entity & { name: string };
type Friend = Entity & { displayName: string; state: string };
type Group = Named & { ownerId: string };
type Favorite = Entity & { type: string };
type Row = (string | number | null)[];

type Sizes = {
  friends: number;
  friendLog: number;
  feed: number;
  gameLog: number;
  notifications: number;
  notificationsV2: number;
  worlds: number;
  avatars: number;
  groups: number;
  mutualLinks: number;
  favorites: number;
  maxTableSize: number;
};

type Dataset = {
  sizes: Sizes;
  currentUser: Entity;
  friends: Friend[];
  worlds: Named[];
  avatars: Entity[];
  groups: Group[];
  friendLog: Row[];
  friendLogCurrent: Row[];
  feed: Row[];
  gameLog: Row[];
  notifications: Row[];
  notificationsV2: Row[];
  mutualLinks: Row[];
  favoriteGroups: JsonObject[];
  favorites: Favorite[];
  config: Map<string, string>;
};

const SIZES = {
  real: {
    friends: 393,
    friendLog: 583,
    feed: 3000,
    gameLog: 3000,
    notifications: 1400,
    notificationsV2: 1100,
    worlds: 200,
    avatars: 270,
    groups: 20,
    mutualLinks: 3600,
    favorites: 150,
    maxTableSize: 500,
  },
  stress: {
    friends: 1500,
    friendLog: 12000,
    feed: 12000,
    gameLog: 12000,
    notifications: 5000,
    notificationsV2: 3000,
    worlds: 800,
    avatars: 1000,
    groups: 60,
    mutualLinks: 15000,
    favorites: 400,
    maxTableSize: 10000,
  },
} as const satisfies Record<DataProfile, Sizes>;

const STATUSES = ["active", "join me", "ask me", "busy"] as const;
const PLATFORMS = ["standalonewindows", "android", "ios"] as const;
const TRUST_TAGS = [
  ["system_trust_basic"],
  ["system_trust_basic", "system_trust_known"],
  ["system_trust_basic", "system_trust_known", "system_trust_trusted"],
  ["system_trust_basic", "system_trust_known", "system_trust_trusted", "system_trust_veteran"],
] as const;
const TRUST_NAMES = ["Visitor", "New User", "User", "Known User", "Trusted User"] as const;
const FRIEND_LOG_TYPES = ["Friend", "Friend", "Friend", "Unfriend", "Unfriend", "DisplayName", "TrustLevel", "FriendRequest"] as const;
const FEED_TYPES = ["GPS", "GPS", "Online", "Offline", "Online", "Status", "Avatar", "Bio"] as const;
const GAME_LOG_TYPES = ["OnPlayerJoined", "OnPlayerLeft", "OnPlayerJoined", "OnPlayerLeft", "Location", "VideoPlay", "PortalSpawn", "Event"] as const;
const NOTIFICATION_TYPES = ["friendRequest", "invite", "requestInvite", "inviteResponse", "requestInviteResponse"] as const;
const NOTIFICATION_V2_TYPES = ["group.announcement", "group.informative", "group.invite", "group.joinRequest", "boop"] as const;
const REGIONS = ["us", "use", "eu", "jp"] as const;
const DAY_MS = 86400000;
const END_MS = Date.parse("2026-11-26T12:00:00.000Z");

function image(kind: string, id: string): string {
  return `https://assets.vrchat.test/${kind}/${id}.png`;
}

function name(random: Random): string {
  const first = random.word(random.int(3, 8));
  const tail = random.chance(0.3) ? `_${random.int(1, 999)}` : "";
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}${tail}`.slice(0, 20);
}

function isoAt(random: Random, spanDays: number): string {
  return new Date(END_MS - random.int(0, spanDays * DAY_MS)).toISOString();
}

function instanceOf(random: Random, worldId: string, ownerId: string): string {
  const number = random.int(10000, 99999);
  const access = random.pick(["", `~hidden(${ownerId})`, `~friends(${ownerId})`, `~private(${ownerId})~canRequestInvite`]);
  return `${worldId}:${number}${access}~region(${random.pick(REGIONS)})`;
}

function makeWorld(random: Random, index: number): Named {
  const id = random.id("wrld");
  const created = isoAt(random, 1500);
  return {
    id,
    name: `${name(random)} World ${index}`,
    description: `A synthetic world ${random.word(12)}`,
    authorId: random.id("usr"),
    authorName: name(random),
    capacity: random.pick([16, 32, 40, 64, 80]),
    recommendedCapacity: 16,
    occupants: random.int(0, 80),
    publicOccupants: random.int(0, 40),
    privateOccupants: random.int(0, 40),
    favorites: random.int(0, 90000),
    visits: random.int(0, 9000000),
    popularity: random.int(0, 10),
    heat: random.int(0, 10),
    imageUrl: image("world", id),
    thumbnailImageUrl: image("world-thumb", id),
    releaseStatus: "public",
    tags: ["system_approved", `author_tag_${random.word(5)}`],
    created_at: created,
    updated_at: created,
    labsPublicationDate: "none",
    publicationDate: created,
    version: random.int(1, 200),
    unityPackages: [{ platform: "standalonewindows", unityVersion: "2022.3.22f1", assetVersion: 4 }],
    instances: [],
  };
}

function makeAvatar(random: Random, ownerId: string): Entity {
  const id = random.id("avtr");
  const created = isoAt(random, 1200);
  return {
    id,
    name: `${name(random)} Avatar`,
    description: random.word(16),
    authorId: ownerId,
    authorName: name(random),
    imageUrl: image("avatar", id),
    thumbnailImageUrl: image("avatar-thumb", id),
    releaseStatus: random.pick(["public", "private"]),
    tags: [],
    version: random.int(1, 30),
    created_at: created,
    updated_at: created,
    unityPackages: [{ platform: "standalonewindows", unityVersion: "2022.3.22f1", assetVersion: 4 }],
  };
}

function makeGroup(random: Random): Group {
  const id = random.id("grp");
  return {
    id,
    name: `${name(random)} Group`,
    shortCode: random.word(5).toUpperCase(),
    discriminator: String(random.int(1000, 9999)),
    description: random.word(20),
    iconUrl: image("group-icon", id),
    bannerUrl: image("group-banner", id),
    ownerId: random.id("usr"),
    memberCount: random.int(5, 50000),
    onlineMemberCount: random.int(0, 500),
    privacy: "default",
    joinState: "open",
    tags: [],
    roles: [],
    isRepresenting: false,
    isVerified: random.chance(0.2),
    mutedUntil: null,
    memberVisibility: "visible",
    membershipStatus: "member",
    createdAt: isoAt(random, 900),
  };
}

function makeFriend(random: Random, worlds: Named[]): Friend {
  const id = random.id("usr");
  const tags = random.pick(TRUST_TAGS);
  const isOnline = random.chance(0.35);
  const isActive = !isOnline && random.chance(0.15);
  const world = random.pick(worlds);
  const location = isOnline ? (random.chance(0.4) ? "private" : instanceOf(random, world.id, id)) : "offline";
  const avatarId = random.id("file");
  return {
    id,
    displayName: name(random),
    username: random.word(10),
    bio: random.chance(0.6) ? `Synthetic bio ${random.word(30)}` : "",
    bioLinks: random.chance(0.3) ? [`https://example.test/${random.word(6)}`] : [],
    currentAvatarImageUrl: image("avatar", avatarId),
    currentAvatarThumbnailImageUrl: image("avatar-thumb", avatarId),
    currentAvatarTags: [],
    developerType: "none",
    friendKey: random.word(24),
    imageUrl: image("avatar", avatarId),
    isFriend: true,
    last_activity: isoAt(random, 30),
    last_login: isoAt(random, 30),
    last_platform: random.pick(PLATFORMS),
    location,
    platform: isOnline ? random.pick(PLATFORMS) : isActive ? "web" : "",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    status: isOnline || isActive ? random.pick(STATUSES) : "offline",
    statusDescription: random.chance(0.4) ? random.word(random.int(4, 30)) : "",
    tags: [...tags, ...(random.chance(0.2) ? ["system_supporter"] : []), ...(random.chance(0.1) ? ["language_eng", "language_jpn"] : [])],
    userIcon: "",
    pronouns: "",
    state: isOnline ? "online" : isActive ? "active" : "offline",
    travelingToLocation: "",
    date_joined: isoAt(random, 2500).slice(0, 10),
  };
}

function makeCurrentUser(random: Random, friends: Friend[], worlds: Named[]): Entity {
  const id = "usr_00000000-0000-4000-8000-000000000001";
  const avatarId = random.id("avtr");
  const homeWorld = random.pick(worlds);
  const pick = (state: string): Json[] => friends.filter((friend) => friend.state === state).map((friend) => friend.id);
  return {
    id,
    displayName: "PageCheckUser",
    username: "pagecheckuser",
    bio: "Synthetic account for the page check",
    bioLinks: [],
    currentAvatar: avatarId,
    currentAvatarAssetUrl: "",
    currentAvatarImageUrl: image("avatar", avatarId),
    currentAvatarThumbnailImageUrl: image("avatar-thumb", avatarId),
    currentAvatarTags: [],
    date_joined: "2019-03-14",
    developerType: "none",
    friendKey: random.word(24),
    friends: friends.map((friend) => friend.id),
    onlineFriends: pick("online"),
    activeFriends: pick("active"),
    offlineFriends: pick("offline"),
    homeLocation: homeWorld.id,
    isFriend: false,
    last_activity: new Date(END_MS).toISOString(),
    last_login: new Date(END_MS).toISOString(),
    last_platform: "standalonewindows",
    platform: "standalonewindows",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    pronouns: "",
    state: "online",
    status: "active",
    statusDescription: "Checking pages",
    statusFirstTime: false,
    statusHistory: ["Checking pages"],
    steamId: "",
    tags: ["system_trust_basic", "system_trust_known", "system_trust_trusted", "system_supporter"],
    userIcon: "",
    allowAvatarCopying: false,
    hasBirthday: false,
    hasEmail: true,
    hasLoggedInFromClient: true,
    hasPendingEmail: false,
    emailVerified: true,
    twoFactorAuthEnabled: true,
    acceptedTOSVersion: 10,
    acceptedPrivacyVersion: 1,
    obfuscatedEmail: "p***@example.test",
    obfuscatedPendingEmail: "",
    pastDisplayNames: [],
    badges: [],
    presence: {
      avatarThumbnail: image("avatar-thumb", avatarId),
      displayName: "PageCheckUser",
      groups: [],
      id,
      instance: "offline",
      instanceType: "",
      isRejoining: "0",
      platform: "standalonewindows",
      profilePicOverride: "",
      status: "active",
      travelingToInstance: "",
      travelingToWorld: "",
      world: "offline",
      currentAvatarTags: [],
      debugflag: "",
      userIcon: "",
    },
    queuedInstance: null,
    updated_at: new Date(END_MS).toISOString(),
    isBoopingEnabled: true,
  };
}

function makeFriendLog(random: Random, friends: Friend[], count: number): { history: Row[]; current: Row[] } {
  const history: Row[] = [];
  const ordered = Array.from({ length: count }, () => isoAt(random, 520)).sort();
  ordered.forEach((createdAt, index) => {
    const friend = random.pick(friends);
    const type = random.pick(FRIEND_LOG_TYPES);
    const displayName = friend.displayName;
    const isNameChange = type === "DisplayName";
    const isTrustChange = type === "TrustLevel";
    history.push([
      index + 1,
      createdAt,
      type,
      friend.id,
      displayName,
      isNameChange ? name(random) : null,
      isTrustChange ? random.pick(TRUST_NAMES) : null,
      isTrustChange ? random.pick(TRUST_NAMES) : null,
      type === "Friend" ? index + 1 : null,
    ]);
  });
  const current: Row[] = friends.map((friend, index) => [friend.id, friend.displayName, random.pick(TRUST_NAMES), index + 1]);
  return { history, current };
}

function makeFeed(random: Random, friends: Friend[], worlds: Named[], count: number): Row[] {
  const times = Array.from({ length: count }, () => isoAt(random, 120)).sort((left, right) => right.localeCompare(left));
  return times.map((createdAt, index) => {
    const friend = random.pick(friends);
    const world = random.pick(worlds);
    const type = random.pick(FEED_TYPES);
    const location = instanceOf(random, world.id, friend.id);
    const row: Row = Array.from({ length: 25 }, () => null);
    row[0] = count - index;
    row[1] = createdAt;
    row[2] = friend.id;
    row[3] = friend.displayName;
    row[4] = type;
    row[5] = location;
    row[6] = world.name;
    row[7] = type === "GPS" ? instanceOf(random, random.pick(worlds).id, friend.id) : null;
    row[8] = random.int(0, 7200000);
    row[9] = random.chance(0.1) ? "Synthetic Group" : "";
    row[10] = random.pick(STATUSES);
    row[11] = random.word(10);
    row[12] = random.pick(STATUSES);
    row[13] = random.word(10);
    row[14] = random.word(40);
    row[15] = random.word(40);
    row[16] = random.id("usr");
    row[17] = `${name(random)} Avatar`;
    row[18] = image("avatar", String(row[0]));
    row[19] = image("avatar-thumb", String(row[0]));
    row[20] = image("avatar", `${String(row[0])}p`);
    row[21] = image("avatar-thumb", `${String(row[0])}p`);
    row[22] = "[]";
    row[23] = "[]";
    row[24] = random.pick(PLATFORMS);
    return row;
  });
}

function makeGameLog(random: Random, friends: Friend[], worlds: Named[], count: number): Row[] {
  const times = Array.from({ length: count }, () => isoAt(random, 120)).sort((left, right) => right.localeCompare(left));
  return times.map((createdAt, index) => {
    const type = random.pick(GAME_LOG_TYPES);
    const isFriend = random.chance(0.3);
    const userId = isFriend ? random.pick(friends).id : random.id("usr");
    const world = random.pick(worlds);
    const row: Row = Array.from({ length: 18 }, () => null);
    row[0] = count - index;
    row[1] = createdAt;
    row[2] = type;
    row[3] = name(random);
    row[4] = instanceOf(random, world.id, userId);
    row[5] = userId;
    row[6] = random.int(0, 7200000);
    row[7] = world.id;
    row[8] = world.name;
    row[9] = "";
    row[10] = "";
    row[11] = `https://video.example.test/${random.word(11)}`;
    row[12] = `Video ${random.word(8)}`;
    row[13] = random.word(11);
    row[14] = `https://cdn.example.test/${random.word(12)}.txt`;
    row[16] = random.word(10);
    row[17] = random.word(16);
    return row;
  });
}

function makeNotifications(random: Random, friends: Friend[], worlds: Named[], ownerId: string, count: number): Row[] {
  return Array.from({ length: count }, (_value, index) => {
    const friend = random.pick(friends);
    const world = random.pick(worlds);
    return [
      `not_${String(index).padStart(8, "0")}-0000-4000-8000-${random.word(12)}`,
      isoAt(random, 365),
      random.pick(NOTIFICATION_TYPES),
      friend.id,
      friend.displayName,
      ownerId,
      random.word(20),
      world.id,
      world.name,
      "",
      random.word(12),
      "",
      "",
      random.chance(0.5) ? 1 : 0,
    ];
  });
}

function makeNotificationsV2(random: Random, groups: Group[], count: number): Row[] {
  return Array.from({ length: count }, (_value, index) => {
    const group = random.pick(groups);
    const createdAt = isoAt(random, 200);
    return [
      `ntf_${String(index).padStart(8, "0")}-0000-4000-8000-${random.word(12)}`,
      createdAt,
      createdAt,
      new Date(Date.parse(createdAt) + 30 * DAY_MS).toISOString(),
      random.pick(NOTIFICATION_V2_TYPES),
      `group:${group.id}`,
      group.name,
      random.word(30),
      group.name,
      image("group-icon", group.id),
      random.chance(0.5) ? 1 : 0,
      group.ownerId,
      group.name,
      "{}",
      "[]",
      "{}",
    ];
  });
}

function makeMutualLinks(random: Random, friends: Friend[], count: number): Row[] {
  return Array.from({ length: count }, () => [random.pick(friends).id, random.pick(friends).id]);
}

function makeFavorites(random: Random, friends: Friend[], worlds: Named[], avatars: Entity[], count: number) {
  const groups: JsonObject[] = [];
  const favorites: Favorite[] = [];
  const kinds = [
    ["friend", friends],
    ["world", worlds],
    ["avatar", avatars],
  ] as const;
  for (const [type, pool] of kinds) {
    for (let groupIndex = 0; groupIndex < 4; groupIndex += 1) {
      const groupName = `${type}s${groupIndex + 1}`;
      groups.push({
        id: random.id("fvgrp"),
        ownerId: "usr_00000000-0000-4000-8000-000000000001",
        name: groupName,
        displayName: `Group ${groupIndex + 1}`,
        type,
        visibility: "private",
        tags: [],
      });
      for (let index = 0; index < Math.ceil(count / 12); index += 1) {
        favorites.push({ id: random.id("fvrt"), type, favoriteId: random.pick(pool).id, tags: [groupName] });
      }
    }
  }
  return { groups, favorites };
}

function makeConfig(profile: DataProfile, currentUserId: string, sizes: Sizes, dashboardId: string): Map<string, string> {
  const entries: [string, string][] = [
    ["lastUserLoggedIn", currentUserId],
    ["VRCX_databaseVersion", "18"],
    ["VRCX_hideUnfriends", profile === "real" ? "true" : "false"],
    ["VRCX_tablePageSize", "25"],
    ["VRCX_friendLogTableFilters", "[]"],
    ["VRCX_maxTableSize_v2", String(sizes.maxTableSize)],
    ["VRCX_tableDensity", "standard"],
    ["VRCX_appLanguage", "en"],
    ["VRCX_ThemeMode", "midnight"],
    ["VRCX_autoLoginDelayEnabled", "false"],
    [
      "VRCX_dashboardConfigs",
      JSON.stringify({
        dashboards: [
          {
            id: dashboardId,
            name: "Page check",
            icon: "ri-dashboard-line",
            rows: [
              { panels: ["feed", "friend-log"], direction: "horizontal" },
              { panels: ["widget:game-log", "notification"], direction: "horizontal" },
            ],
          },
        ],
      }),
    ],
  ];
  return new Map(entries.map(([key, value]) => [`config:${key.toLowerCase()}`, value]));
}

function createDataset(profile: DataProfile, seed: number, dashboardId: string): Dataset {
  const random = createRandom(seed);
  const sizes = SIZES[profile];
  const worlds = Array.from({ length: sizes.worlds }, (_value, index) => makeWorld(random, index));
  const friends = Array.from({ length: sizes.friends }, () => makeFriend(random, worlds));
  const currentUser = makeCurrentUser(random, friends, worlds);
  const currentUserId = currentUser.id;
  const avatars = Array.from({ length: sizes.avatars }, () => makeAvatar(random, currentUserId));
  const groups = Array.from({ length: sizes.groups }, () => makeGroup(random));
  const friendLog = makeFriendLog(random, friends, sizes.friendLog);
  const favorites = makeFavorites(random, friends, worlds, avatars, sizes.favorites);
  return {
    sizes,
    currentUser,
    friends,
    worlds,
    avatars,
    groups,
    friendLog: friendLog.history,
    friendLogCurrent: friendLog.current,
    feed: makeFeed(random, friends, worlds, sizes.feed),
    gameLog: makeGameLog(random, friends, worlds, sizes.gameLog),
    notifications: makeNotifications(random, friends, worlds, currentUserId, sizes.notifications),
    notificationsV2: makeNotificationsV2(random, groups, sizes.notificationsV2),
    mutualLinks: makeMutualLinks(random, friends, sizes.mutualLinks),
    favoriteGroups: favorites.groups,
    favorites: favorites.favorites,
    config: makeConfig(profile, currentUserId, sizes, dashboardId),
  };
}

export { createDataset, image, instanceOf, name };
export type { Dataset, Entity, Friend, Json, JsonObject, Named, Row };
