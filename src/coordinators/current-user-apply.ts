import type { ApiConfig, CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";
import type { CurrentUserState } from "../stores/user-state";
import { assignDefinedProps } from "../shared/utils/user-transforms";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { watchState } from "../services/watch-state";
import { runAvatarSwapFlow, runFirstLoginFlow, runHomeLocationSyncFlow, runPostApplySyncFlow } from "./user-session-coordinator";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useAuthStore } from "../stores/auth";
import { useGameStore } from "../stores/game";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { applyUser } from "./user-profile-apply";
import { logError } from "./user-coordinator";

export function handleConfig(args: { json: Json<ApiConfig>; ref?: Json<ApiConfig> }) {
  const authStore = useAuthStore();
  const userStore = useUserStore();

  const ref = {
    ...args.json,
  };
  args.ref = ref;
  authStore.setCachedConfig(ref);
  if (typeof ref.whiteListedAssetUrls !== "object") {
    console.error("Invalid config whiteListedAssetUrls");
  }
  void AppApi.PopulateImageHosts(JSON.stringify(ref.whiteListedAssetUrls)).catch(logError);
  const languages = ref.constants.LANGUAGE.SPOKEN_LANGUAGE_OPTIONS;
  if (!languages) {
    return;
  }
  userStore.setSubsetOfLanguages(languages);
}

function createFallbackCurrentUser(json: Json<CurrentUser>): CurrentUserState {
  return {
    acceptedPrivacyVersion: 0,
    acceptedTOSVersion: 0,
    accountDeletionDate: null,
    accountDeletionLog: null,
    accountStanding: "",
    activeFriends: [],
    ageVerificationStatus: "hidden",
    ageVerified: false,
    allowAvatarCopying: false,
    appleDetails: {},
    appleId: "",
    badges: [],
    bannerColor: "",
    bannerType: "color",
    bannerUrl: "",
    bio: "",
    bioLinks: [],
    completedTutorials: [],
    currentAvatar: "",
    currentAvatarImageUrl: "",
    currentAvatarTags: [],
    currentAvatarThumbnailImageUrl: "",
    date_joined: "",
    developerType: "none",
    discordDetails: {
      global_name: "",
      id: "",
    },
    discordId: "",
    displayName: "",
    emailVerified: false,
    fallbackAvatar: "",
    friendGroupNames: [],
    friendKey: "",
    friends: [],
    googleDetails: {},
    googleId: "",
    hasAcceptedDiscordSocialSDKPerms: false,
    hasBirthday: false,
    hasDiscordFriendsOptOut: false,
    hasEmail: false,
    hasLoggedInFromClient: false,
    hasPendingEmail: false,
    hasSharedConnectionsOptOut: false,
    hideContentFilterSettings: false,
    homeLocation: "",
    id: "",
    isAdult: true,
    isBoopingEnabled: false,
    isEconomyCreator: false,
    isFriend: false,
    isTemporary: false,
    iconFrame: "",
    iconUrl: "",
    last_activity: "",
    last_login: "",
    last_mobile: null,
    last_platform: "",
    nameplateEffect: "",
    obfuscatedEmail: "",
    obfuscatedPendingEmail: "",
    oculusId: "",
    offlineFriends: [],
    onlineFriends: [],
    pastDisplayNames: [],
    picoId: "",
    platform_history: [],
    presence: {
      avatarThumbnail: "",
      currentAvatarTags: "",
      debugflag: "",
      displayName: "",
      groups: [],
      id: "",
      instance: "",
      instanceType: "",
      platform: "",
      profilePicOverride: "",
      status: "",
      travelingToInstance: "",
      travelingToWorld: "",
      userIcon: "",
      world: "",
      ...json.presence,
    },
    profileEffect: "",
    profilePicOverride: "",
    profilePicOverrideThumbnail: "",
    pronouns: "",
    pronounsHistory: [],
    queuedInstance: "",
    receiveMobileInvitations: false,
    state: "offline",
    status: "offline",
    statusDescription: "",
    statusFirstTime: false,
    statusHistory: [],
    steamDetails: {},
    steamId: "",
    tags: [],
    temporaryExpiryDate: null,
    twitchDetails: {
      display_name: "",
      id: "",
      login: "",
      profile_image_url: "",
    },
    twitchId: "",
    twoFactorAuthEnabled: false,
    twoFactorAuthEnabledDate: null,
    unsubscribe: false,
    updated_at: "",
    userIcon: "",
    userLanguage: "",
    userLanguageCode: "",
    username: "",
    usesGeneratedPassword: false,
    viveId: "",

    $online_for: null,
    $offline_for: null,
    $location_at: Date.now(),
    $travelingToTime: Date.now(),
    $previousAvatarSwapTime: null,
    $homeLocation: {},
    $isVRCPlus: false,
    $isModerator: false,
    $isTroll: false,
    $isProbableTroll: false,
    $trustLevel: "Visitor",
    $trustClass: "x-tag-untrusted",
    $userColour: "",
    $trustSortNum: 1,
    $languages: [],
    $locationTag: "",
    $travelingToLocation: "",
  };
}

export function applyCurrentUser(json: Json<CurrentUser>) {
  const userStore = useUserStore();
  const appearanceSettingsStore = useAppearanceSettingsStore();
  const authStore = useAuthStore();
  const gameStore = useGameStore();
  const locationStore = useLocationStore();

  authStore.setAttemptingAutoLogin(false);
  let ref: CurrentUserState = userStore.currentUser;
  runAvatarSwapFlow({
    json,
    ref,
    isLoggedIn: watchState.isLoggedIn,
  });
  if (watchState.isLoggedIn) {
    assignDefinedProps(ref, json);
  } else {
    ref = createFallbackCurrentUser(json);
    assignDefinedProps(ref, json);
    runFirstLoginFlow(ref);
  }

  ref.$isVRCPlus = ref.tags.includes("system_supporter");
  appearanceSettingsStore.applyUserTrustLevel(ref);
  userStore.applyUserLanguage(ref);
  userStore.applyPresenceLocation(ref);
  runPostApplySyncFlow(ref);
  runHomeLocationSyncFlow(ref);

  const $location = parseLocation(locationStore.lastLocation.location);
  const $travelingLocation = parseLocation(locationStore.lastLocationDestination);
  let location = locationStore.lastLocation.location;
  let instanceId = $location.instanceId;
  let worldId = $location.worldId;
  let travelingToLocation = locationStore.lastLocationDestination;
  let travelingToWorld = $travelingLocation.worldId;
  let travelingToInstance = $travelingLocation.instanceId;
  if (!gameStore.isGameRunning && json.presence) {
    if (isRealInstance(json.presence.world)) {
      location = `${json.presence.world}:${json.presence.instance}`;
    } else {
      location = json.presence.world ?? "";
    }
    if (isRealInstance(json.presence.travelingToWorld)) {
      travelingToLocation = `${json.presence.travelingToWorld}:${json.presence.travelingToInstance}`;
    } else {
      travelingToLocation = json.presence.travelingToWorld ?? "";
    }
    instanceId = json.presence.instance ?? "";
    worldId = json.presence.world ?? "";
    travelingToInstance = json.presence.travelingToInstance ?? "";
    travelingToWorld = json.presence.travelingToWorld ?? "";
  }
  const userRef = applyUser({
    ageVerificationStatus: json.ageVerificationStatus,
    ageVerified: json.ageVerified,
    allowAvatarCopying: json.allowAvatarCopying,
    bannerColor: json.bannerColor,
    bannerType: json.bannerType,
    bannerUrl: json.bannerUrl,
    date_joined: json.date_joined,
    developerType: json.developerType,
    discordId: json.discordId,
    displayName: json.displayName,
    friendKey: json.friendKey,
    iconFrame: json.iconFrame,
    iconUrl: json.iconUrl,
    id: json.id,
    isEconomyCreator: json.isEconomyCreator,
    isFriend: json.isFriend,
    last_activity: json.last_activity,
    last_login: json.last_login,
    last_mobile: json.last_mobile,
    last_platform: json.last_platform,
    nameplateEffect: json.nameplateEffect,
    platform: json.platform,
    profileEffect: json.profileEffect,
    pronouns: json.pronouns,
    state: json.state,
    status: json.status,
    statusDescription: json.statusDescription,
    tags: json.tags,
    location,
    instanceId,
    worldId,
    travelingToLocation,
    travelingToInstance,
    travelingToWorld,
  });

  userRef.$online_for = userStore.currentUser.$online_for;
  userRef.$offline_for = userStore.currentUser.$offline_for;
  userRef.$active_for = null;
  userRef.$location_at = userStore.currentUser.$location_at;
  userRef.$travelingToTime = userStore.currentUser.$travelingToTime;
  if (json.presence?.platform) {
    userRef.platform = json.presence.platform;
  }

  return ref;
}
