import type {
  AgeVerificationStatus,
  BannerType,
  CreateInstanceRequest,
  CurrentUser,
  DeveloperType,
  Favorite,
  Group,
  GroupAccessType,
  Instance,
  InstanceRegion,
  InstanceType,
  Notification,
  Region,
  UpdateInstanceRequest,
  User,
  UserState,
  UserStatus,
  World,
} from "vrchat";
import type { WorldRef } from "../shared/utils/world-transforms";

export type Json<T> = T extends Date
  ? string
  : T extends bigint
    ? number
    : T extends (infer U)[]
      ? Json<U>[]
      : T extends object
        ? { [K in keyof T]: Json<T[K]> }
        : T;

export type Moderations = {
  isBlocked: boolean;
  isMuted: boolean;
  isAvatarInteractionDisabled: boolean;
  isChatBoxMuted: boolean;
};

export type ParsedLocation = {
  tag: string;
  isOffline: boolean;
  isPrivate: boolean;
  isTraveling: boolean;
  isRealInstance: boolean;
  worldId: string;
  instanceId: string;
  instanceName: string;
  accessType: string;
  accessTypeName: string;
  region: string;
  shortName: string;
  userId: string | null;
  hiddenId: string | null;
  privateId: string | null;
  friendsId: string | null;
  groupId: string | null;
  groupAccessType: string | null;
  canRequestInvite: boolean;
  strict: boolean;
  ageGate: boolean;
};

type UserFallbacks = {
  ageVerificationStatus: AgeVerificationStatus | "";
  bannerType: BannerType | "";
  bio: string;
  bioLinks: string[];
  developerType: DeveloperType | "";
  instanceId: string;
  location: string;
  last_activity: string | null;
  last_login: string | null;
  note: string | null;
  profilePicOverride: string;
  profilePicOverrideThumbnail: string;
  state: UserState | "";
  status: UserStatus | "";
  travelingToInstance: string;
  travelingToLocation: string;
  travelingToWorld: string;
  userIcon: string;
  worldId: string;
};

export type VrcxUser = {
  $location: Partial<ParsedLocation>;
  $location_at: number;
  $online_for: number | null;
  $travelingToTime: number;
  $offline_for: number | null;
  $active_for: number | null;
  $isVRCPlus: boolean;
  $isModerator: boolean;
  $isTroll: boolean;
  $isProbableTroll: boolean;
  $trustLevel: string;
  $trustClass: string;
  $userColour: string;
  $trustSortNum: number;
  $languages: { key: string; value: string }[];
  $joinCount: number;
  $timeSpent: number;
  $lastSeen: string;
  $mutualCount: number;
  $mutualOptedOut: boolean;
  $nickName: string;
  $previousLocation: string;
  $customTag: string;
  $customTagColour: string;
  $friendNumber: number;
  $lastFetch?: number;
  $moderations: Moderations;
  $memo: string;
  $platform: string;
  fallbackAvatar?: string;
} & Omit<Json<User>, keyof UserFallbacks> &
  UserFallbacks &
  Partial<Omit<Json<CurrentUser>, keyof Json<User> | "fallbackAvatar">>;

export type VrcxGroup = {
  initialRoleIds: string[];
  $memberId: string;
  groupId: string;
  isRepresenting: boolean;
  memberVisibility: string | boolean;
  mutualGroup: boolean;
  $languages: { key: string; value: string }[];
} & Json<Group>;

export type VrcxInstanceWorld = Partial<Omit<WorldRef, "slimInstances">> & { slimInstances?: unknown[] | undefined };

export type VrcxInstance = {
  creationLanguages?: string[];
  languagesIso639?: string[];
  $fetchedAt: string;
  $disabledContentSettings: string[];
  type: InstanceType | "";
  region: InstanceRegion | "";
  photonRegion: Region | "";
  groupAccessType: GroupAccessType | null;
  platforms: Partial<Json<Instance>["platforms"]>;
  world: VrcxInstanceWorld;
  hypeTrain?: { current?: { startDate: string; endDate: string } | null } | null;
  clientNumber?: string;
} & Omit<Json<Instance>, "creationLanguages" | "type" | "region" | "photonRegion" | "groupAccessType" | "platforms" | "world" | "clientNumber">;

export type InstanceCount = {
  asOf: string;
  events: number;
  instances: number;
};

export type InstanceCategory = {
  deleted: boolean;
  iconUrl: string;
  id: string;
  name: string;
  order: number;
};

export type InstanceVibe = {
  deleted: boolean;
  id: string;
  title: string;
};

export type VrcxCreateInstanceRequest = {
  languages?: string[];
  minimumAvatarPerformance?: string;
} & Json<CreateInstanceRequest>;

export type VrcxUpdateInstanceRequest = {
  location: string;
  calendarEntryId?: UpdateInstanceRequest["calendarEntryId"];
  displayName?: string | null;
};

export type MarketplaceAvatarSearchParams = {
  n: number;
  offset: number;
  search: string;
  releaseStatus: string;
  order: string;
  marketplace: string;
  metadata: boolean;
  minPrice?: number;
  maxPrice?: number;
  performanceAtLeast?: string;
  platform?: string;
  minUnityVersion?: string;
  maxUnityVersion?: string;
  minAssetVersion?: number;
  maxAssetVersion?: number;
};

export type VrcxWorld = {
  $isLabs: boolean;
  slimInstances?: unknown[];
} & Omit<Json<World>, "slimInstances">;

export type WorldRatingValue = "like" | "dislike";

export type WorldRating = {
  value: WorldRatingValue | null;
};

export type VrcxNotification = Json<Notification> & {
  $isExpired: boolean;
};

export type VrcxFavorite = {
  $groupKey: string;
} & Json<Favorite>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  params?: unknown;
  customMsg?: string | undefined;
  inviteId?: string;
  uploadImage?: boolean;
  uploadImageLegacy?: boolean;
  uploadImagePrint?: boolean;
  uploadFilePUT?: boolean;
  imageData?: string;
  postData?: string;
  matchingDimensions?: boolean;
  cropWhiteBorder?: boolean;
  fileData?: string;
  fileMIME?: string;
  fileMD5?: string;
};

export type WebApiOptions = {
  url: string;
} & RequestOptions;

export type TableFilter<Row = unknown, Value = unknown> = {
  prop: string | string[];
  value: Value;
  filterFn?: (row: Row, filter: TableFilter<Row, Value>) => boolean;
};
