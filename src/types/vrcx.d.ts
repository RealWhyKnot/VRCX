import type { CreateInstanceRequest, CurrentUser, Favorite, Group, Instance, Notification, UpdateInstanceRequest, User, World } from "vrchat";

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

export type VrcxUser = {
  $location: Partial<ParsedLocation>;
  $location_at: number;
  $online_for: number;
  $travelingToTime: number;
  $offline_for: number;
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
  $previousLocation: string;
  $customTag: string;
  $customTagColour: string;
  $friendNumber: number;
  $lastFetch: number;
  $moderations: Moderations;
  $memo: string;
  $platform: string;
} & Json<User>;

export type VrcxCurrentUser = {
  $online_for?: number;
  $offline_for?: number | null;
  $location_at?: number;
  $travelingToTime?: number;
  $previousAvatarSwapTime?: number | null;
  $homeLocation?: Partial<ParsedLocation>;
  $isVRCPlus?: boolean;
  $isModerator?: boolean;
  $isTroll?: boolean;
  $isProbableTroll?: boolean;
  $trustLevel?: string;
  $trustClass?: string;
  $userColour?: string;
  $trustSortNum?: number;
  $languages?: string[];
  $locationTag?: string;
  $travelingToLocation?: string;
} & Json<CurrentUser>;

export type VrcxGroup = {
  initialRoleIds: string[];
  $memberId: string;
  groupId: string;
  isRepresenting: boolean;
  memberVisibility: string | boolean;
  mutualGroup: boolean;
  $languages: { key: string; value: string }[];
} & Json<Group>;

export type VrcxInstance = {
  creationLanguages?: string[];
  languagesIso639?: string[];
  $fetchedAt: string;
  $disabledContentSettings: string[];
} & Json<Instance>;

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
} & Json<World>;

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
  customMsg?: string;
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
