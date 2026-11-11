import type {
  CalendarEvent,
  GroupAuditLogEntry,
  GroupAuditLogEntryType,
  GroupGalleryImage,
  GroupMember,
  GroupPermission,
  GroupPost,
  GroupRole,
  GroupRoleTemplateValues,
  ProductListing,
} from "vrchat";
import type { Json, TableFilter, VrcxGroup, VrcxUser } from "../types/vrcx";
import type { InstanceEntry, InstanceRoom } from "./instance-types";

export type GroupPostEntry = Json<GroupPost>;

export type GroupRoleTemplate = Json<GroupRoleTemplateValues> & { value?: string };

export type GroupEditSource = VrcxGroup & {
  roleTemplate?: string;
  roleTemplates?: GroupRoleTemplate[];
};

export type GroupInstanceEntry = {
  group: VrcxGroup;
  instance: InstanceEntry;
};

export type GroupMemberModerationTable<Row> = {
  data: Row[];
  pageSize: number;
  pageIndex: number;
  filters?: TableFilter[];
};

export type GroupDialogState = {
  visible: boolean;
  loading: boolean;
  activeTab: string;
  lastActiveTab: string;
  isGetGroupDialogGroupLoading: boolean;
  id: string;
  inGroup: boolean;
  ownerDisplayName: string;
  ref: Partial<VrcxGroup>;
  announcement: Partial<GroupPostEntry>;
  posts: GroupPostEntry[];
  postsFiltered: GroupPostEntry[];
  calendar: Json<CalendarEvent>[];
  members: Json<GroupMember>[];
  memberSearch: string;
  memberSearchResults: Json<GroupMember>[];
  instances: InstanceRoom[];
  memberRoles: Json<GroupRole>[];
  lastVisit: string;
  joinCount: number;
  memberFilter: { name: string; id: string | null };
  memberSortOrder: { name: string; value: string };
  postsSearch: string;
  galleries: Record<string, Json<GroupGalleryImage>[]>;
  listings: Json<ProductListing>[];
};

export type GroupEditDialogState = {
  visible: boolean;
  loading: boolean;
  roleTemplatesLoading: boolean;
  mode: "create" | "edit";
  groupId: string;
  name: string | undefined;
  shortCode: string | undefined;
  description: string | undefined;
  joinState: string;
  privacy: string;
  roleTemplate: string;
  roleTemplates: GroupRoleTemplate[];
  languages: string[];
  rules: string | null | undefined;
  links: string[];
  bannerId: string | null | undefined;
  bannerUrl: string | null | undefined;
  iconId: string | null | undefined;
  iconUrl: string | null | undefined;
  allowGroupJoinPrompt: boolean;
};

export type GroupEventEditDialogState = {
  visible: boolean;
  loading: boolean;
  mode: "create" | "edit";
  groupId: string;
  eventId: string;
  groupRef: Partial<VrcxGroup>;
  startsAt: string;
  endsAt: string;
  title: string;
  accessType: string;
  description: string;
  category: string;
  tags: string[];
  imageId: string;
  imageUrl: string;
  roleIds: string[];
  parentId: string | null;
  platforms: string[];
  languages: string[];
  sendCreationNotification: boolean;
  hostEarlyJoinMinutes: number;
  guestEarlyJoinMinutes: number;
  closeInstanceAfterEndMinutes: number;
  seriesId: Json<CalendarEvent>["seriesId"];
  recurrence: Json<CalendarEvent>["recurrence"];
};

export type GroupInviteDialogState = {
  visible: boolean;
  loading: boolean;
  groupId: string;
  groupName: string;
  userId: string;
  userIds: string[];
  userObject: Partial<VrcxUser>;
};

export type GroupModerateDialogState = {
  visible: boolean;
  groupId: string;
  groupName: string;
  userId: string;
  userObject: Partial<VrcxUser>;
};

export type GroupMemberSelection = Json<GroupMember> & { $displayName?: string };

export type GroupMemberModerationState = {
  visible: boolean;
  loading: boolean;
  id: string;
  groupRef: Partial<VrcxGroup>;
  auditLogTypes: Json<GroupAuditLogEntryType>[];
  openWithUserId: string;
  activeTab: string;
  activeInviteTab: string;
  selectedUsers: Record<string, GroupMemberSelection>;
  selectedUsersArray: GroupMemberSelection[];
  tables: {
    members: GroupMemberModerationTable<GroupMemberSelection>;
    bans: GroupMemberModerationTable<GroupMemberSelection>;
    invites: GroupMemberModerationTable<GroupMemberSelection>;
    joinRequests: GroupMemberModerationTable<GroupMemberSelection>;
    blocked: GroupMemberModerationTable<GroupMemberSelection>;
    logs: GroupMemberModerationTable<Json<GroupAuditLogEntry>>;
  };
};

export type GroupPermissionEntry = Json<GroupPermission> & { allowedToAdd?: boolean };

export type GroupRolesDialogState = {
  visible: boolean;
  loading: boolean;
  id: string;
  groupRef: Partial<VrcxGroup>;
  roles: Json<GroupRole>[];
  permissions: GroupPermissionEntry[];
  selectedRoleId: string;
};
