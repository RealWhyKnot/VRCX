import type { Moderations, ParsedLocation } from "../../types/vrcx";
import { removeEmojis, replaceBioSymbols } from "./base/string";

type Row = Record<string, unknown>;

export type UserJson = {
  statusDescription?: string;
  note?: string | null;
  currentAvatarImageUrl?: string;
  currentAvatarThumbnailImageUrl?: string;
};

export type UserRef = {
  acceptedPrivacyVersion: number;
  acceptedTOSVersion: number;
  accountDeletionDate: string | null;
  accountDeletionLog: unknown[] | null;
  ageVerificationStatus: string;
  ageVerified: boolean;
  allowAvatarCopying: boolean;
  appleDetails: Record<string, unknown>;
  badges: unknown[];
  bannerColor: string;
  bannerType: string;
  bannerUrl: string;
  bio: string;
  bioLinks: string[];
  currentAvatarImageUrl: string;
  currentAvatarTags: string[];
  currentAvatarThumbnailImageUrl: string;
  date_joined: string;
  developerType: string;
  discordId: string;
  displayName: string;
  friendKey: string;
  friendRequestStatus: string;
  iconFrame: string;
  iconUrl: string;
  id: string;
  instanceId: string;
  isEconomyCreator: boolean;
  isFriend: boolean;
  last_activity: string;
  last_login: string;
  last_mobile: string | null;
  last_platform: string;
  location: string;
  nameplateEffect: string;
  platform: string;
  note: string | null;
  profileEffect: string;
  profilePicOverride: string;
  profilePicOverrideThumbnail: string;
  pronouns: string;
  state: string;
  status: string;
  statusDescription: string;
  tags: string[];
  travelingToInstance: string;
  travelingToLocation: string;
  travelingToWorld: string;
  userIcon: string;
  worldId: string;
  fallbackAvatar: string;
  $location: Partial<ParsedLocation>;
  $location_at: number;
  $online_for: number;
  $travelingToTime: number;
  $offline_for: number | null;
  $active_for: number;
  $isVRCPlus: boolean;
  $isModerator: boolean;
  $isTroll: boolean;
  $isProbableTroll: boolean;
  $trustLevel: string;
  $trustClass: string;
  $userColour: string;
  $trustSortNum: number;
  $languages: string[];
  $joinCount: number;
  $timeSpent: number;
  $lastSeen: string;
  $mutualCount: number;
  $mutualOptedOut: boolean;
  $nickName: string;
  $memo: string;
  $previousLocation: string;
  $customTag: string;
  $customTagColour: string;
  $friendNumber: number;
  $platform: string;
  $moderations: Partial<Moderations>;
};

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function sanitizeUserJson(json: UserJson, robotUrl: string): void {
  if (json.statusDescription) {
    json.statusDescription = replaceBioSymbols(json.statusDescription);
    json.statusDescription = removeEmojis(json.statusDescription);
  }
  if (json.note) {
    json.note = replaceBioSymbols(json.note);
  }
  if (robotUrl && json.currentAvatarImageUrl === robotUrl) {
    delete json.currentAvatarImageUrl;
    delete json.currentAvatarThumbnailImageUrl;
  }
}

export function computeTrustLevel(tags: readonly string[], developerType: string | null | undefined) {
  let isModerator = Boolean(developerType) && developerType !== "none";
  let isTroll = false;
  let isProbableTroll = false;
  let trustLevel = "Visitor";
  let trustClass = "x-tag-untrusted";
  let trustColorKey = "untrusted";
  let trustSortNum = 1;

  if (tags.includes("admin_moderator")) {
    isModerator = true;
  }
  if (tags.includes("system_troll")) {
    isTroll = true;
  }
  if (tags.includes("system_probable_troll") && !isTroll) {
    isProbableTroll = true;
  }

  if (tags.includes("system_trust_veteran")) {
    trustLevel = "Trusted User";
    trustClass = "x-tag-veteran";
    trustColorKey = "veteran";
    trustSortNum = 5;
  } else if (tags.includes("system_trust_trusted")) {
    trustLevel = "Known User";
    trustClass = "x-tag-trusted";
    trustColorKey = "trusted";
    trustSortNum = 4;
  } else if (tags.includes("system_trust_known")) {
    trustLevel = "User";
    trustClass = "x-tag-known";
    trustColorKey = "known";
    trustSortNum = 3;
  } else if (tags.includes("system_trust_basic")) {
    trustLevel = "New User";
    trustClass = "x-tag-basic";
    trustColorKey = "basic";
    trustSortNum = 2;
  }

  if (isTroll || isProbableTroll) {
    trustColorKey = "troll";
    trustSortNum += 0.1;
  }
  if (isModerator) {
    trustColorKey = "vip";
    trustSortNum += 0.3;
  }

  return {
    trustLevel,
    trustClass,
    trustSortNum,
    isModerator,
    isTroll,
    isProbableTroll,
    trustColorKey,
  };
}

export function computeUserPlatform(platform: string | undefined, lastPlatform: string | null | undefined): string {
  if (platform && platform !== "offline" && platform !== "web") {
    return platform;
  }
  return lastPlatform ?? "";
}

export function diffObjectProps(ref: Row, json: Row, arraysMatchFn: (a: unknown[], b: unknown[]) => boolean) {
  const changes = new Map<string, true | [unknown, unknown]>();
  let hasPropChanged = false;

  for (const prop of Object.keys(ref)) {
    if (typeof json[prop] === "undefined") {
      continue;
    }
    if (ref[prop] === null || typeof ref[prop] !== "object") {
      changes.set(prop, true);
    }
  }

  for (const prop of Object.keys(json)) {
    if (typeof ref[prop] === "undefined") {
      continue;
    }
    const jsonValue = json[prop];
    const refValue = ref[prop];
    if (isUnknownArray(jsonValue) && isUnknownArray(refValue)) {
      if (!arraysMatchFn(jsonValue, refValue)) {
        changes.set(prop, true);
      }
    } else if (jsonValue === null || typeof jsonValue !== "object") {
      changes.set(prop, true);
    }
  }

  const changedEntries = new Map<string, true | [unknown, unknown]>();
  for (const prop of changes.keys()) {
    const asIs = ref[prop];
    const toBe = json[prop];
    if (asIs !== toBe) {
      hasPropChanged = true;
      changedEntries.set(prop, [toBe, asIs]);
    }
  }

  return { hasPropChanged, changedProps: Object.fromEntries(changedEntries) };
}

export function createDefaultUserRef(json: Partial<UserRef>): UserRef {
  return {
    acceptedPrivacyVersion: 0,
    acceptedTOSVersion: 0,
    accountDeletionDate: null,
    accountDeletionLog: null,
    ageVerificationStatus: "",
    ageVerified: false,
    allowAvatarCopying: false,
    appleDetails: {},
    badges: [],
    bannerColor: "",
    bannerType: "",
    bannerUrl: "",
    bio: "",
    bioLinks: [],
    currentAvatarImageUrl: "",
    currentAvatarTags: [],
    currentAvatarThumbnailImageUrl: "",
    date_joined: "",
    developerType: "",
    discordId: "",
    displayName: "",
    friendKey: "",
    friendRequestStatus: "",
    iconFrame: "",
    iconUrl: "",
    id: "",
    instanceId: "",
    isEconomyCreator: false,
    isFriend: false,
    last_activity: "",
    last_login: "",
    last_mobile: null,
    last_platform: "",
    location: "",
    nameplateEffect: "",
    platform: "",
    note: null,
    profileEffect: "",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    pronouns: "",
    state: "",
    status: "",
    statusDescription: "",
    tags: [],
    travelingToInstance: "",
    travelingToLocation: "",
    travelingToWorld: "",
    userIcon: "",
    worldId: "",

    fallbackAvatar: "",

    $location: {},
    $location_at: Date.now(),
    $online_for: Date.now(),
    $travelingToTime: Date.now(),
    $offline_for: null,
    $active_for: Date.now(),
    $isVRCPlus: false,
    $isModerator: false,
    $isTroll: false,
    $isProbableTroll: false,
    $trustLevel: "Visitor",
    $trustClass: "x-tag-untrusted",
    $userColour: "",
    $trustSortNum: 1,
    $languages: [],
    $joinCount: 0,
    $timeSpent: 0,
    $lastSeen: "",
    $mutualCount: 0,
    $mutualOptedOut: false,
    $nickName: "",
    $memo: "",
    $previousLocation: "",
    $customTag: "",
    $customTagColour: "",
    $friendNumber: 0,
    $platform: "",
    $moderations: {},

    ...json,
  };
}
