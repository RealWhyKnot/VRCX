import { ref, type Ref } from "vue";
import { toast } from "vue-sonner";

import type { GroupMemberModerationState, GroupMemberSelection } from "../../../stores/group-types";
import type { GroupRequest } from "./group-moderation-types";

export type GroupRoleChangeArgs = Awaited<ReturnType<GroupRequest["removeGroupMemberRole"]>>;
export type GroupMemberPropsArgs = Awaited<ReturnType<GroupRequest["setGroupMemberProps"]>>;

export type GroupBatchCallbacks = {
  onComplete?: (() => void) | undefined;
};

export type GroupBatchOperationsDeps = {
  groupMemberModeration: Ref<Pick<GroupMemberModerationState, "id" | "selectedUsersArray">>;
  currentUser: Ref<{ id: string }>;
  deselectedUsers: (userId: string | null, isAll?: boolean) => void;
  groupRequest: GroupRequest;
  handleGroupMemberRoleChange: (args: GroupRoleChangeArgs) => void;
  handleGroupMemberProps: (args: GroupMemberPropsArgs) => void;
};

type BatchAction = (user: GroupMemberSelection, groupId: string) => Promise<unknown>;

type RunBatchOperationOptions = {
  action: BatchAction;
  logPrefix: string;
  successMessage: string;
  errorMessage: string;
  skipSelf?: boolean;
  onComplete?: (() => void) | undefined;
};

export function useGroupBatchOperations(deps: GroupBatchOperationsDeps) {
  const progressCurrent = ref(0);
  const progressTotal = ref(0);

  async function runBatchOperation({ action, logPrefix, successMessage, errorMessage, skipSelf = true, onComplete }: RunBatchOperationOptions) {
    const users = [...deps.groupMemberModeration.value.selectedUsersArray];
    const memberCount = users.length;
    const groupId = deps.groupMemberModeration.value.id;
    progressTotal.value = memberCount;
    let isAllSuccess = true;

    for (const [i, user] of users.entries()) {
      if (!progressTotal.value) break;
      progressCurrent.value = i + 1;

      if (skipSelf && user.userId === deps.currentUser.value.id) continue;

      console.log(`${logPrefix} ${user.userId} ${i + 1}/${memberCount}`);
      try {
        await action(user, groupId);
      } catch (err: unknown) {
        console.error(err);
        toast.error(`${errorMessage}: ${String(err)}`);
        isAllSuccess = false;
      }
    }

    if (isAllSuccess) {
      toast.success(successMessage.replace("{count}", String(memberCount)));
    }
    progressCurrent.value = 0;
    progressTotal.value = 0;
    deps.deselectedUsers(null, true);
    if (onComplete) onComplete();
  }

  async function groupMembersBan(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.banGroupMember({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Banning",
      successMessage: "Banned {count} group members",
      errorMessage: "Failed to ban group member",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersUnban(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.unbanGroupMember({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Unbanning",
      successMessage: "Unbanned {count} group members",
      errorMessage: "Failed to unban group member",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersKick(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.kickGroupMember({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Kicking",
      successMessage: "Kicked {count} group members",
      errorMessage: "Failed to kick group member",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersSaveNote(noteValue: string, callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: async (user, groupId) => {
        if (user.managerNotes === noteValue) return;
        const args = await deps.groupRequest.setGroupMemberProps(user.userId, groupId, {
          managerNotes: noteValue,
        });
        deps.handleGroupMemberProps(args);
      },
      logPrefix: "Setting note for",
      successMessage: "Saved notes for {count} group members",
      errorMessage: "Failed to set group member note for",
      skipSelf: false,
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersRemoveRoles(roleIds: string[], callbacks?: GroupBatchCallbacks) {
    const rolesToRemoveSet = new Set(roleIds);
    await runBatchOperation({
      action: async (user, groupId) => {
        const currentRoles = new Set(user.roleIds);
        const rolesToRemoveForUser: string[] = [];
        rolesToRemoveSet.forEach((roleId) => {
          if (currentRoles.has(roleId)) {
            rolesToRemoveForUser.push(roleId);
          }
        });
        if (!rolesToRemoveForUser.length) return;
        for (const roleId of rolesToRemoveForUser) {
          const args = await deps.groupRequest.removeGroupMemberRole({
            groupId,
            userId: user.userId,
            roleId,
          });
          deps.handleGroupMemberRoleChange(args);
        }
      },
      logPrefix: "Removing roles from",
      successMessage: "Roles removed",
      errorMessage: "Failed to remove group member roles",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersAddRoles(roleIds: string[], callbacks?: GroupBatchCallbacks) {
    const rolesToAddSet = new Set(roleIds);
    await runBatchOperation({
      action: async (user, groupId) => {
        const currentRoles = new Set(user.roleIds);
        const rolesToAddForUser: string[] = [];
        rolesToAddSet.forEach((roleId) => {
          if (!currentRoles.has(roleId)) {
            rolesToAddForUser.push(roleId);
          }
        });
        if (!rolesToAddForUser.length) return;
        for (const roleId of rolesToAddForUser) {
          const args = await deps.groupRequest.addGroupMemberRole({
            groupId,
            userId: user.userId,
            roleId,
          });
          deps.handleGroupMemberRoleChange(args);
        }
      },
      logPrefix: "Adding roles to",
      successMessage: "Added group member roles",
      errorMessage: "Failed to add group member roles",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersDeleteSentInvite(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.deleteSentGroupInvite({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Deleting group invite",
      successMessage: "Deleted {count} group invites",
      errorMessage: "Failed to delete group invites",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersAcceptInviteRequest(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.acceptGroupInviteRequest({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Accepting group join request from",
      successMessage: "Accepted {count} group join requests",
      errorMessage: "Failed to accept group join requests",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersRejectInviteRequest(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.rejectGroupInviteRequest({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Rejecting group join request from",
      successMessage: "Rejected {count} group join requests",
      errorMessage: "Failed to reject group join requests",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersBlockJoinRequest(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.blockGroupInviteRequest({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Blocking group join request from",
      successMessage: "Blocked {count} group join requests",
      errorMessage: "Failed to block group join requests",
      onComplete: callbacks?.onComplete,
    });
  }

  async function groupMembersDeleteBlockedRequest(callbacks?: GroupBatchCallbacks) {
    await runBatchOperation({
      action: (user, groupId) =>
        deps.groupRequest.deleteBlockedGroupRequest({
          groupId,
          userId: user.userId,
        }),
      logPrefix: "Deleting blocked group request for",
      successMessage: "Deleted {count} blocked group requests",
      errorMessage: "Failed to delete blocked group requests",
      onComplete: callbacks?.onComplete,
    });
  }

  return {
    progressCurrent,
    progressTotal,
    groupMembersBan,
    groupMembersUnban,
    groupMembersKick,
    groupMembersSaveNote,
    groupMembersRemoveRoles,
    groupMembersAddRoles,
    groupMembersDeleteSentInvite,
    groupMembersAcceptInviteRequest,
    groupMembersRejectInviteRequest,
    groupMembersBlockJoinRequest,
    groupMembersDeleteBlockedRequest,
  };
}
