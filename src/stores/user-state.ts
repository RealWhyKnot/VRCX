import type {
  AccountDeletionLog,
  AgeVerificationStatus,
  BannerType,
  CurrentUser,
  DeveloperType,
  InventoryTemplate,
  ProductPurchase,
  PublicProfile,
  UserClientConfig,
  UserState,
  UserStatus,
  ProfileTheme,
} from "vrchat";
import type { Json, ParsedLocation, VrcxInstance, VrcxUser } from "../types/vrcx";
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

export type UserFavoriteWorld = UserDialogWorld & {
  favoriteId?: string | undefined;
};

export type UserFavoriteWorldList = [name: string | undefined, visibility: string | undefined, worlds: UserFavoriteWorld[]];

export type UserDialogAvatar = {
  id: string;
  name: string;
  authorId: string;
  releaseStatus: string;
  thumbnailImageUrl: string;
};

export type UserDialogInstance = {
  id: string;
  tag: string;
  $location: Partial<ParsedLocation>;
  friendCount: number;
  users: VrcxUser[];
  shortName: string;
  ref: Partial<VrcxInstance>;
};

export type UserDialogWorld = {
  id: string;
  name?: string | undefined;
  thumbnailImageUrl?: string | undefined;
  occupants?: number | undefined;
};

export type UserDialogGroup = {
  id?: string | undefined;
  name?: string | undefined;
  iconUrl?: string | null | undefined;
  isRepresenting?: boolean | undefined;
  memberCount?: number | undefined;
  memberVisibility?: string | boolean | undefined;
  myMember?: { visibility?: string | undefined } | null | undefined;
};

export type UserDialogFriendedInfo = {
  type: string | null;
  created_at?: string | null | undefined;
};

export type UserDialogFriend = {
  id: string;
  displayName?: string | undefined;
  iconUrl?: string | undefined;
  iconFrame?: string | undefined;
  $userColour?: string | undefined;
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
  $location: Partial<ParsedLocation> & { user?: Partial<VrcxUser> | undefined };
  $homeLocationName: string;
  users: VrcxUser[];
  instance: UserDialogInstance;
  worlds: UserDialogWorld[];
  avatars: UserDialogAvatar[];
  licensedAvatars: UserDialogAvatar[];
  isWorldsLoading: boolean;
  isFavoriteWorldsLoading: boolean;
  isAvatarsLoading: boolean;
  isGroupsLoading: boolean;
  userFavoriteWorlds: UserFavoriteWorldList[];
  userGroups: {
    groups: UserDialogGroup[];
    ownGroups: UserDialogGroup[];
    mutualGroups: UserDialogGroup[];
    remainingGroups: UserDialogGroup[];
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
  dateFriendedInfo: UserDialogFriendedInfo[];
  mutualFriendCount: number;
  mutualGroupCount: number;
  mutualFriends: UserDialogFriend[];
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
