import type {
  AccountDeletionLog,
  AgeVerificationStatus,
  BannerType,
  CurrentUser,
  DeveloperType,
  InventoryTemplate,
  LimitedWorld,
  ProductPurchase,
  PublicProfile,
  UserClientConfig,
  UserState,
  UserStatus,
  ProfileTheme,
} from "vrchat";

import type { Json, ParsedLocation, VrcxGroup, VrcxInstance, VrcxUser } from "../types/vrcx";
import type { AvatarRef } from "../shared/utils/avatar-transforms";

import type { FriendContext } from "./friend-types";

export type ConnectedAccountDetails = Record<string, unknown>;

export type CurrentUserPresence = {
  avatarThumbnail: string | null;
  currentAvatarTags: string;
  debugflag: string;
  displayName: string;
  groups: string[] | null;
  id: string;
  instance: string | null;
  instanceType: string | null;
  platform: string | null;
  profilePicOverride: string | null;
  status: string | null;
  travelingToInstance: string | null;
  travelingToWorld: string | null;
  userIcon: string | null;
  world: string | null;
};

export type LanguageEntry = { key: string; value: string };

export type CurrentUserState = {
  acceptedPrivacyVersion: number;
  acceptedTOSVersion: number;
  accountDeletionDate: string | null;
  accountDeletionLog: Json<AccountDeletionLog>[] | null;
  accountStanding: string;
  activeFriends: string[];
  ageVerificationStatus: AgeVerificationStatus;
  ageVerified: boolean;
  allowAvatarCopying: boolean;
  appleDetails: ConnectedAccountDetails;
  appleId: string;
  badges: Json<NonNullable<PublicProfile["badges"]>>;
  bannerColor: string;
  bannerType: BannerType;
  bannerUrl: string;
  bio: string;
  bioLinks: string[];
  completedTutorials: string[];
  currentAvatar: string;
  currentAvatarImageUrl: string;
  currentAvatarTags: string[];
  currentAvatarThumbnailImageUrl: string;
  date_joined: string;
  developerType: DeveloperType;
  discordDetails: { global_name: string; id: string };
  discordId: string;
  displayName: string;
  emailVerified: boolean;
  fallbackAvatar: string;
  friendGroupNames: string[];
  friendKey: string;
  friends: string[];
  googleDetails: ConnectedAccountDetails;
  googleId: string;
  hasAcceptedDiscordSocialSDKPerms: boolean;
  hasBirthday: boolean;
  hasDiscordFriendsOptOut: boolean;
  hasEmail: boolean;
  hasLoggedInFromClient: boolean;
  hasPendingEmail: boolean;
  hasSharedConnectionsOptOut: boolean;
  hideContentFilterSettings: boolean;
  homeLocation: string;
  id: string;
  isAdult: boolean;
  isBoopingEnabled: boolean;
  isEconomyCreator: boolean;
  isFriend: boolean;
  isTemporary: boolean;
  iconFrame: string;
  iconUrl: string;
  last_activity: string;
  last_login: string;
  last_mobile: string | null;
  last_platform: string;
  nameplateEffect: string;
  obfuscatedEmail: string;
  obfuscatedPendingEmail: string;
  oculusId: string;
  offlineFriends: string[];
  onlineFriends: string[];
  pastDisplayNames: Json<CurrentUser["pastDisplayNames"]>;
  picoId: string;
  platform_history: Json<NonNullable<CurrentUser["platform_history"]>>;
  presence: CurrentUserPresence;
  profileEffect: string;
  profilePicOverride: string;
  profilePicOverrideThumbnail: string;
  pronouns: string;
  pronounsHistory: string[];
  queuedInstance: string | null;
  receiveMobileInvitations: boolean;
  state: UserState;
  status: UserStatus;
  statusDescription: string;
  statusFirstTime: boolean;
  statusHistory: string[];
  steamDetails: ConnectedAccountDetails;
  steamId: string;
  tags: string[];
  temporaryExpiryDate: string | null;
  twitchDetails: { display_name: string; id: string; login: string; profile_image_url: string };
  twitchId: string;
  twoFactorAuthEnabled: boolean;
  twoFactorAuthEnabledDate: string | null;
  unsubscribe: boolean;
  updated_at: string;
  userIcon: string;
  userLanguage: string;
  userLanguageCode: string;
  username: string;
  usesGeneratedPassword: boolean;
  viveId: string;
  $online_for: number | null;
  $offline_for: number | null;
  $location_at: number;
  $travelingToTime: number;
  $previousAvatarSwapTime: number | null;
  $homeLocation: Partial<ParsedLocation>;
  $isVRCPlus: boolean;
  $isModerator: boolean;
  $isTroll: boolean;
  $isProbableTroll: boolean;
  $trustLevel: string;
  $trustClass: string;
  $userColour: string;
  $trustSortNum: number;
  $languages: LanguageEntry[];
  $locationTag: string;
  $travelingToLocation: string;
};

export type RepresentedGroupState = {
  bannerId: string;
  bannerUrl: string;
  description: string;
  discriminator: string;
  groupId: string;
  iconUrl: string;
  id: string;
  isRepresenting: boolean;
  memberCount: number;
  memberVisibility: string;
  name: string;
  ownerId: string;
  privacy: string;
  shortCode: string;
  $thumbnailUrl: string;
  $memberId: string;
};

export type UserSorting = { name: string; value: string };

export type UserDialogInstance = {
  id: string;
  tag: string;
  $location: Partial<ParsedLocation>;
  friendCount: number;
  users: VrcxUser[];
  shortName: string;
  ref: Partial<VrcxInstance>;
};

export type UserDialogState = {
  visible: boolean;
  loading: boolean;
  activeTab: string;
  lastActiveTab: string;
  id: string;
  ref: Partial<VrcxUser>;
  publicProfileRef: Partial<Json<PublicProfile>> | undefined;
  theme: { iconColor: string; buttonColor: string; subtextColor: string };
  friend: Partial<FriendContext> | undefined;
  isFriend: boolean;
  note: string;
  incomingRequest: boolean;
  outgoingRequest: boolean;
  isBlock: boolean;
  isMute: boolean;
  isHideAvatar: boolean;
  isShowAvatar: boolean;
  isInteractOff: boolean;
  isMuteChat: boolean;
  isFavorite: boolean;
  $location: Partial<ParsedLocation>;
  $homeLocationName: string;
  users: VrcxUser[];
  instance: UserDialogInstance;
  worlds: Json<LimitedWorld>[];
  avatars: AvatarRef[];
  licensedAvatars: AvatarRef[];
  isWorldsLoading: boolean;
  isFavoriteWorldsLoading: boolean;
  isAvatarsLoading: boolean;
  isGroupsLoading: boolean;
  userFavoriteWorlds: Json<LimitedWorld>[];
  userGroups: {
    groups: VrcxGroup[];
    ownGroups: VrcxGroup[];
    mutualGroups: VrcxGroup[];
    remainingGroups: VrcxGroup[];
  };
  worldSorting: UserSorting;
  worldOrder: UserSorting;
  groupSorting: UserSorting;
  mutualFriendSorting: UserSorting;
  avatarSorting: string;
  avatarReleaseStatus: string;
  activityPeriodDays: string;
  memo: string;
  $avatarInfo: { ownerId: string; avatarName: string; fileCreatedAt: string };
  representedGroup: RepresentedGroupState;
  isRepresentedGroupLoading: boolean;
  joinCount: number;
  timeSpent: number;
  lastSeen: string;
  avatarModeration: number;
  previousDisplayNames: { displayName: string | null; updated_at: string | null }[];
  dateFriended: string;
  unFriended: boolean;
  dateFriendedInfo: unknown[];
  mutualFriendCount: number;
  mutualGroupCount: number;
  mutualFriends: VrcxUser[];
  isMutualFriendsLoading: boolean;
};

export type EditProfileDialogState = {
  visible: boolean;
  loading: boolean;
  selfProfileRef: Partial<Json<PublicProfile>>;
  status: string;
  statusDescription: string;
  pronouns: string;
  bio: string;
  bioLinks: string[];
  socialStatusHistoryTable: { no: number; status: string }[];
  bannerColor: string;
  bannerUrl: string;
  bannerType: string;
  userIcon: string;
  iconUrl: string;
  themes: Json<ProfileTheme>[];
  themeId: string;
  themeName: string;
  themeButtonColor: string;
  themeIconColor: string;
  themeSubtextColor: string;
  backgroundType: string;
  backgroundTextureId: string;
  backgroundGradientBottom: string;
  backgroundGradientTop: string;
  nameplateEffect: string;
  profileEffect: string;
  iconFrame: string;
};

export type CustomUserTag = { tag: string; colour: string };

export type UserStoreNotesState = {
  instancePlayerCount: Map<string, number>;
  lastNoteCheck: Date | null;
  lastDbNoteDate: string | null;
  notes: Map<string, string>;
};

export type CachedProductPurchase = Json<ProductPurchase>;

export type CachedCosmetic = Json<InventoryTemplate>;

export type ClientConfigState = Json<UserClientConfig>;

export function createCurrentUserState(): CurrentUserState {
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
    $online_for: Date.now(),
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

export function createUserDialogState(): UserDialogState {
  return {
    visible: false,
    loading: false,
    activeTab: "Info",
    lastActiveTab: "Info",
    id: "",
    ref: {},
    publicProfileRef: {},
    theme: {
      iconColor: "",
      buttonColor: "",
      subtextColor: "",
    },
    friend: {},
    isFriend: false,
    note: "",
    incomingRequest: false,
    outgoingRequest: false,
    isBlock: false,
    isMute: false,
    isHideAvatar: false,
    isShowAvatar: false,
    isInteractOff: false,
    isMuteChat: false,
    isFavorite: false,
    $location: {},
    $homeLocationName: "",
    users: [],
    instance: {
      id: "",
      tag: "",
      $location: {},
      friendCount: 0,
      users: [],
      shortName: "",
      ref: {},
    },
    worlds: [],
    avatars: [],
    licensedAvatars: [],
    isWorldsLoading: false,
    isFavoriteWorldsLoading: false,
    isAvatarsLoading: false,
    isGroupsLoading: false,
    userFavoriteWorlds: [],
    userGroups: {
      groups: [],
      ownGroups: [],
      mutualGroups: [],
      remainingGroups: [],
    },
    worldSorting: {
      name: "dialog.user.worlds.sorting.updated",
      value: "updated",
    },
    worldOrder: {
      name: "dialog.user.worlds.order.descending",
      value: "descending",
    },
    groupSorting: {
      name: "dialog.user.groups.sorting.alphabetical",
      value: "alphabetical",
    },
    mutualFriendSorting: {
      name: "dialog.user.mutual_friends.sorting.alphabetical",
      value: "alphabetical",
    },
    avatarSorting: "update",
    avatarReleaseStatus: "all",
    activityPeriodDays: "30",
    memo: "",
    $avatarInfo: {
      ownerId: "",
      avatarName: "",
      fileCreatedAt: "",
    },
    representedGroup: {
      bannerId: "",
      bannerUrl: "",
      description: "",
      discriminator: "",
      groupId: "",
      iconUrl: "",
      id: "",
      isRepresenting: false,
      memberCount: 0,
      memberVisibility: "",
      name: "",
      ownerId: "",
      privacy: "",
      shortCode: "",
      $thumbnailUrl: "",
      $memberId: "",
    },
    isRepresentedGroupLoading: false,
    joinCount: 0,
    timeSpent: 0,
    lastSeen: "",
    avatarModeration: 0,
    previousDisplayNames: [],
    dateFriended: "",
    unFriended: false,
    dateFriendedInfo: [],
    mutualFriendCount: 0,
    mutualGroupCount: 0,
    mutualFriends: [],
    isMutualFriendsLoading: false,
  };
}

export function createEditProfileDialogState(): EditProfileDialogState {
  return {
    visible: false,
    loading: false,
    selfProfileRef: {},
    status: "",
    statusDescription: "",
    pronouns: "",
    bio: "",
    bioLinks: [],
    socialStatusHistoryTable: [],
    bannerColor: "",
    bannerUrl: "",
    bannerType: "",
    userIcon: "",
    iconUrl: "",
    themes: [],
    themeId: "",
    themeName: "",
    themeButtonColor: "",
    themeIconColor: "",
    themeSubtextColor: "",
    backgroundType: "default",
    backgroundTextureId: "",
    backgroundGradientBottom: "",
    backgroundGradientTop: "",
    nameplateEffect: "",
    profileEffect: "",
    iconFrame: "",
  };
}
