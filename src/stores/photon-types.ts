import type { DeveloperType, UserStatus } from "vrchat";

export type PhotonId = number;

export type PhotonAvatarUnityPackage = {
  variant?: string | undefined;
  platform?: string | undefined;
  assetUrl?: string | undefined;
};

export type PhotonAvatar = {
  id?: string | undefined;
  authorId?: string | undefined;
  authorName?: string | undefined;
  updated_at?: string | undefined;
  description?: string | undefined;
  imageUrl?: string | undefined;
  thumbnailImageUrl?: string | undefined;
  name?: string | undefined;
  releaseStatus?: string | undefined;
  version?: number | undefined;
  tags?: string[] | undefined;
  assetUrl?: string | undefined;
  unityPackages?: PhotonAvatarUnityPackage[] | undefined;
};

export type PhotonUserInfo = {
  id: string;
  displayName: string;
  developerType?: DeveloperType | "" | undefined;
  profilePicOverride?: string | undefined;
  currentAvatarImageUrl?: string | undefined;
  currentAvatarThumbnailImageUrl?: string | undefined;
  userIcon?: string | undefined;
  last_platform?: string | undefined;
  allowAvatarCopying?: boolean | undefined;
  status?: UserStatus | "" | undefined;
  statusDescription?: string | undefined;
  bio?: string | undefined;
  tags?: string[] | undefined;
};

export type PhotonUserPayload = {
  user?: PhotonUserInfo | undefined;
  avatarDict?: PhotonAvatar | undefined;
  favatarDict?: PhotonAvatar | undefined;
  last_platform?: string | undefined;
  modTag?: string | undefined;
  isInvisible?: boolean | undefined;
  groupOnNameplate?: string | undefined;
  inVRMode?: boolean | undefined;
  avatarEyeHeight?: number | undefined;
  canModerateInstance?: boolean | undefined;
  showGroupBadgeToOthers?: boolean | undefined;
  showSocialRank?: boolean | undefined;
  useImpostorAsFallback?: boolean | undefined;
  platform?: string | undefined;
};

export type PhotonUserPayloadMap = Record<string, PhotonUserPayload | undefined>;

export type PhotonLobbyUser = {
  id: string;
  displayName: string;
  developerType?: DeveloperType | "" | undefined;
  profilePicOverride?: string | undefined;
  currentAvatarImageUrl?: string | undefined;
  currentAvatarThumbnailImageUrl?: string | undefined;
  userIcon?: string | undefined;
  last_platform?: string | undefined;
  allowAvatarCopying?: boolean | undefined;
  status?: UserStatus | "" | undefined;
  statusDescription?: string | undefined;
  bio?: string | undefined;
  tags?: string[] | undefined;
  isFriend?: boolean | undefined;
  hasInstantiated?: boolean | undefined;
  $location_at?: number | undefined;
  $online_for?: number | null | undefined;
};

export type PhotonLobbyEntry = Pick<PhotonLobbyUser, "displayName"> & Partial<PhotonLobbyUser>;

export type PhotonJointime = {
  joinTime?: number | undefined;
  hasInstantiated?: boolean | undefined;
  inVRMode?: boolean | undefined;
  avatarEyeHeight?: number | undefined;
  canModerateInstance?: boolean | undefined;
  groupOnNameplate?: string | undefined;
  showGroupBadgeToOthers?: boolean | undefined;
  showSocialRank?: boolean | undefined;
  useImpostorAsFallback?: boolean | undefined;
  platform?: string | undefined;
};

export type PhotonEventEntry = {
  photonId?: PhotonId | undefined;
  displayName?: string | undefined;
  userId?: string | undefined;
  isFavorite?: boolean | undefined;
  isFriend?: boolean | undefined;
  isMaster?: boolean | undefined;
  isModerator?: boolean | undefined;
  colour?: string | undefined;
  type: string;
  text?: string | undefined;
  color?: string | undefined;
  created_at?: string | number | undefined;
  imageUrl?: string | undefined;
  fileId?: string | undefined;
  avatar?: PhotonAvatar | undefined;
  inCache?: boolean | undefined;
  platform?: string | undefined;
  status?: string | undefined;
  previousStatus?: string | undefined;
  statusDescription?: string | undefined;
  previousStatusDescription?: string | undefined;
  shortName?: string | undefined;
  location?: string | undefined;
  worldName?: string | undefined;
  groupName?: string | undefined;
  groupId?: string | undefined;
  previousGroupId?: string | undefined;
  previousGroupName?: string | undefined;
};

export type PhotonEventTable = {
  data: PhotonEventEntry[];
  filters: [{ prop: string[]; value: string }, { prop: string; value: string[] }];
  pageSize: number;
  paginationProps: { layout: string };
};

export type PhotonGameLogEntry = {
  created_at: string;
  type: string;
  userId?: string;
  displayName?: string;
  location?: string;
  instanceId?: string;
  worldName?: string;
  groupName?: string;
  text?: string;
  data?: string;
};

export type PhotonHudTimeout = {
  userId: string;
  displayName: string;
  time: number;
  rawTime: number;
};

export type PhotonPortal = {
  userId: string;
  shortName: string;
  worldName: string;
  created_at: number;
  playerCount?: number | undefined;
  pendingLeave: number;
};

export type PhotonModerationRequest = {
  block: unknown;
  mute: unknown;
  gameLogDate: string;
};

export type PhotonModerationRow = {
  userId?: string | undefined;
  block?: boolean | undefined;
  mute?: boolean | undefined;
};

export type PhotonModerationDict = {
  "0"?: number | undefined;
  "1"?: number | undefined;
  "2"?: string | undefined;
  "10"?: unknown;
  "11"?: unknown;
  "14"?: Record<string, string | number> | undefined;
};

export type PhotonPortalParams = {
  0: number;
  1: number;
  2: string;
  3: number;
  5: string;
  8: { name: string };
};

export type PhotonEmojiParams = {
  0: number;
  1: string;
  2: number;
};

export type PhotonOperationResponse = {
  OperationCode: number;
  Parameters: {
    248?: { 248?: number } | undefined;
    249?: PhotonUserPayloadMap | undefined;
    252?: number[] | undefined;
    254?: number | undefined;
  };
};

export type PhotonEvent =
  | {
      Code: 253;
      Parameters: { 253: -1; 251: PhotonUserPayloadMap } | { 253?: number; 251?: PhotonUserPayload };
    }
  | { Code: 42; Parameters: { 254?: number; 245?: PhotonUserPayload } }
  | { Code: 255; Parameters: { 254?: number; 249?: PhotonUserPayload; 252?: number[] } }
  | { Code: 254; Parameters: { 254: number; 252?: number[]; 203?: number } }
  | { Code: 4; Parameters: { 254: number } }
  | { Code: 33; Parameters: { 245: PhotonModerationDict } }
  | { Code: 202; Parameters: { 254: number } }
  | { Code: 43; Parameters: { 254: number; 245: string } }
  | { Code: 70; Parameters: { 245: PhotonPortalParams } }
  | { Code: 71; Parameters: { 254: number; 245: PhotonEmojiParams } };

export type PhotonVrcEvent = {
  dt: string;
  VRCEventData: {
    Sender: number;
    EventName?: string | undefined;
    EventType: number;
    Data?: unknown[] | undefined;
  };
};

export type PhotonModerationAgainst = {
  created_at: string;
  userId: string;
  displayName: string;
  type: string;
};
