import type { GroupAuditLogEntry } from "vrchat";
import type { RowData } from "@tanstack/vue-table";
import type { MaybeRef } from "vue";
import type { GroupMemberModerationTable } from "../../../stores/group-types";
import type { GroupMemberRecord } from "../../../coordinators/group-coordinator";
import type { groupRequest } from "../../../api/group";
import type { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";
import type { useUserDisplay } from "../../../composables/use-user-display";
import type { Json } from "../../../types/vrcx";

export type GroupRequest = typeof groupRequest;

export type ModerationUser = {
  id?: string | undefined;
  displayName?: string | null | undefined;
  $userColour?: string | undefined;
  iconUrl?: string;
  thumbnailUrl?: string;
  currentAvatarThumbnailImageUrl?: string;
  currentAvatarImageUrl?: string;
  profilePicOverride?: string;
};

export type ModerationRow = Omit<GroupMemberRecord, "user"> & {
  user?: ModerationUser | null | undefined;
  $selected?: boolean | undefined;
};

export type SelectedRow = Partial<ModerationRow> & { displayName?: string | undefined };

type AuditLogEntry = Json<GroupAuditLogEntry>;

export type ModerationLogRow = Omit<AuditLogEntry, "targetId" | "description" | "data"> & {
  targetId?: AuditLogEntry["targetId"] | null | undefined;
  description?: AuditLogEntry["description"] | null | undefined;
  data?: AuditLogEntry["data"] | null | undefined;
};

export type ModerationTables = {
  members: GroupMemberModerationTable<ModerationRow>;
  bans: GroupMemberModerationTable<ModerationRow>;
  invites: GroupMemberModerationTable<ModerationRow>;
  joinRequests: GroupMemberModerationTable<ModerationRow>;
  blocked: GroupMemberModerationTable<ModerationRow>;
  logs: GroupMemberModerationTable<ModerationLogRow>;
};

export type ModerationSelection = {
  selectedUsers: Record<string, SelectedRow>;
  selectedUsersArray: SelectedRow[];
  tables: ModerationTables;
};

export type ModerationColumn<TData extends RowData> = Extract<Parameters<typeof useVrcxVueTable<TData>>[0]["columns"], unknown[]>[number];

type UserDisplay = ReturnType<typeof useUserDisplay>;

export type RolesTextFn = (roleIds: string[] | null | undefined) => string;

export type GroupSortOption = { name: string; value: string };

export type GroupFilterOption = { name: string; id: string | null };

export type ModerationUserColumnContext = {
  randomUserColours: MaybeRef<boolean>;
  userImage: UserDisplay["userImage"];
  userImageFull: UserDisplay["userImageFull"];
  onShowFullscreenImage: (url: string) => void;
  onShowUser: (userId: string) => void;
  onSelectionChange: (row: ModerationRow) => void;
};
