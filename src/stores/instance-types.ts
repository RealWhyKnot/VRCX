import type { Moderations, ParsedLocation, VrcxInstance, VrcxUser } from "../types/vrcx";
import type { WorldRef } from "../shared/utils/world-transforms";

export type PreviousInstancesVariant = "user" | "world" | "group";

export type UserRefTarget = {
  id: string;
  displayName: string;
};

export type NamedRefTarget = {
  id: string;
  name: string;
};

export type InstanceEntry = VrcxInstance & {
  $location: ParsedLocation;
};

export type RoomLocation = ParsedLocation & {
  user: Partial<VrcxUser>;
};

export type RoomRef = {
  [Key in keyof InstanceEntry]?: InstanceEntry[Key] | undefined;
};

export type InstanceRoom = {
  id: string;
  tag: string;
  location?: string;
  $location: Partial<RoomLocation>;
  friendCount: number;
  users: PlayerRef[];
  shortName: string;
  ref: RoomRef;
};

export type PlayerRef = {
  id?: string;
  displayName: string;
  isFriend?: boolean;
  ageVerificationStatus?: string;
  iconFrame?: string;
  iconUrl?: string;
  thumbnailUrl?: string;
  currentAvatarThumbnailImageUrl?: string;
  currentAvatarImageUrl?: string;
  profilePicOverride?: string;
  location?: string;
  $userColour?: string;
  $travelingToTime?: number;
  $location_at?: number;
  $online_for?: number | null;
  $trustSortNum?: number;
  $trustClass?: string | undefined;
  $trustLevel?: string | undefined;
  $platform?: string | undefined;
  $languages?: { key: string; value: string }[] | undefined;
  status?: string | undefined;
  $moderations?: Moderations;
};

export type CurrentInstanceWorld = {
  ref: Partial<WorldRef>;
  instance: Partial<VrcxInstance>;
  isPC: boolean;
  isQuest: boolean;
  isIos: boolean;
  avatarScalingDisabled: boolean;
  focusViewDisabled: boolean;
  inCache: boolean;
  cacheSize: string;
  fileAnalysis: Record<string, unknown>;
};

export type QueuedInstance = {
  $msgBox: string | number | null;
  $groupName: string;
  $worldName: string;
  location: string;
  position: number;
  queueSize: number;
  updatedAt: number;
};

export type SortEntry = {
  id: string;
  desc: boolean;
};

export type PreviousInstancesTableState = {
  sortBy: SortEntry[];
  search: string;
  pageSize: number;
  pageIndex: number;
};

export type InstanceUserEntry = {
  ref: PlayerRef;
  profileRef: unknown;
  displayName: string;
  timer: number | undefined;
  $trustSortNum: number;
  photonId: number;
  isMaster: boolean;
  isModerator: boolean;
  inVRMode: boolean | null;
  groupOnNameplate: string;
  isFriend: boolean;
  timeoutTime: number;
  isBlocked: boolean;
  isMuted: boolean;
  isAvatarInteractionDisabled: boolean;
  isChatBoxMuted: boolean;
  ageVerified: boolean;
};

export type GroupInstanceInput = {
  location: string;
  instanceId: string;
  shortName?: string | null | undefined;
};

export type WorldDialogView = {
  visible: boolean;
  id: string;
  ref: {
    slimInstances?: unknown[];
    capacity?: number;
  };
  $location: {
    tag?: string;
    instanceId?: string;
    shortName?: string;
  };
  rooms: InstanceRoom[];
};

export type GroupInstanceEntry = {
  instance: { id: string };
};

export type GroupDialogView = {
  visible: boolean;
  id: string;
  instances: InstanceRoom[];
};

export type CreateInstanceDialogOptions = {
  loading: boolean;
  accessType: string;
  region: string;
  worldId: string;
  groupId: string;
  groupAccessType: string;
  ageGate: boolean;
  queueEnabled: boolean;
  roleIds: string[];
  groupRef: Record<string, unknown>;
  displayName?: string;
  description?: string;
  languages?: string[];
  categoryId?: string;
  vibeIds?: string[];
  minimumAvatarPerformance?: string;
};
