import { removeEmojis, replaceBioSymbols } from "./base/string";

export function sanitizeUserJson(json, robotUrl) {
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
  return json;
}

export function computeTrustLevel(tags, developerType) {
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

export function computeUserPlatform(platform, lastPlatform) {
  if (platform && platform !== "offline" && platform !== "web") {
    return platform;
  }
  return lastPlatform || "";
}

export function diffObjectProps(ref, json, arraysMatchFn) {
  const changedProps = {};
  let hasPropChanged = false;

  for (const prop in ref) {
    if (typeof json[prop] === "undefined") {
      continue;
    }
    if (ref[prop] === null || typeof ref[prop] !== "object") {
      changedProps[prop] = true;
    }
  }

  for (const prop in json) {
    if (typeof ref[prop] === "undefined") {
      continue;
    }
    if (Array.isArray(json[prop]) && Array.isArray(ref[prop])) {
      if (!arraysMatchFn(json[prop], ref[prop])) {
        changedProps[prop] = true;
      }
    } else if (json[prop] === null || typeof json[prop] !== "object") {
      changedProps[prop] = true;
    }
  }

  for (const prop in changedProps) {
    const asIs = ref[prop];
    const toBe = json[prop];
    if (asIs === toBe) {
      delete changedProps[prop];
    } else {
      hasPropChanged = true;
      changedProps[prop] = [toBe, asIs];
    }
  }

  return { hasPropChanged, changedProps };
}

export function createDefaultUserRef(json) {
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
