import { applyGroup } from "../coordinators/group-coordinator";
import { request } from "../services/request";
import type { Json, VrcxGroup } from "../types/vrcx";
import { requestAck, requestJson } from "./request-json";
import type {
  DeleteGroup,
  GetGroup,
  GetGroupTransferability,
  Group,
  GroupMember,
  GroupRoleIdList,
  GroupTransferable,
  LimitedGroup,
  LimitedUserGroups,
  RepresentedGroup,
  Success,
  TransferGroupRequest,
  UpdateGroupMemberRequest,
  UpdateGroupRepresentation,
  UserAllGroupPermissions,
} from "vrchat";
import { refetchActiveGroupScope } from "./group-request-scope";

export const groupManagementRequest = {
  setGroupRepresentation(groupId: string, params: UpdateGroupRepresentation["body"]) {
    return request(`groups/${groupId}/representation`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        groupId,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },

  cancelGroupRequest(params: { groupId: string }): Promise<{ json: unknown; params: { groupId: string } }> {
    return request(`groups/${params.groupId}/requests`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  deleteGroupPost(params: { groupId: string; postId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; postId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/posts/${params.postId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  getGroup(params: { groupId: string } & GetGroup["query"]): Promise<{ json: Json<Group>; params: { groupId: string } & GetGroup["query"]; ref: VrcxGroup }> {
    return requestJson<Json<Group>>(`groups/${params.groupId}`, {
      method: "GET",
      params: {
        includeRoles: params.includeRoles ?? false,
      },
    }).then((json) => {
      const args = {
        json,
        params,
        ref: applyGroup(json),
      };
      return args;
    });
  },
  getRepresentedGroup(params: { userId: string }): Promise<{ json: Json<RepresentedGroup>; params: { userId: string } }> {
    return requestJson<Json<RepresentedGroup>>(`users/${params.userId}/groups/represented`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  getGroups(params: { userId: string }): Promise<{ json: Json<LimitedUserGroups[]>; params: { userId: string } }> {
    return requestJson<Json<LimitedUserGroups[]>>(`users/${params.userId}/groups`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  checkTransferGroup(
    params: { groupId: string } & GetGroupTransferability["query"]
  ): Promise<{ json: Json<GroupTransferable>; params: { groupId: string } & GetGroupTransferability["query"] }> {
    return requestJson<Json<GroupTransferable>>(`groups/${params.groupId}/transfer`, {
      method: "GET",
      params: {
        transferTargetId: params.transferTargetId,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  transferGroup(
    params: { groupId: string } & TransferGroupRequest
  ): Promise<{ json: Json<Success> | undefined; params: { groupId: string } & TransferGroupRequest }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/transfer`, {
      method: "POST",
      params: {
        transferTargetId: params.transferTargetId,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },

  deleteGroup(
    params: { groupId: string } & DeleteGroup["query"]
  ): Promise<{ json: Json<Success> | undefined; params: { groupId: string } & DeleteGroup["query"] }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}`, {
      method: "DELETE",
      params: {
        hardDelete: params.hardDelete ?? false,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  joinGroup(params: { groupId: string }): Promise<{ json: Json<GroupMember>; params: { groupId: string } }> {
    return requestJson<Json<GroupMember>>(`groups/${params.groupId}/join`, {
      method: "POST",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  leaveGroup(params: { groupId: string }): Promise<{ json: unknown; params: { groupId: string } }> {
    return request(`groups/${params.groupId}/leave`, {
      method: "POST",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  groupStrictsearch(params: { query: string }): Promise<{ json: Json<LimitedGroup[]>; params: { query: string } }> {
    return requestJson<Json<LimitedGroup[]>>(`groups/strictsearch`, {
      method: "GET",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  setGroupMemberProps(
    userId: string,
    groupId: string,
    params: UpdateGroupMemberRequest
  ): Promise<{ json: Json<GroupMember>; userId: string; groupId: string; params: UpdateGroupMemberRequest }> {
    return requestJson<Json<GroupMember>>(`groups/${groupId}/members/${userId}`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        userId,
        groupId,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },
  addGroupMemberRole(params: {
    userId: string;
    groupId: string;
    roleId: string;
  }): Promise<{ json: Json<GroupRoleIdList>; params: { userId: string; groupId: string; roleId: string } }> {
    return requestJson<Json<GroupRoleIdList>>(`groups/${params.groupId}/members/${params.userId}/roles/${params.roleId}`, {
      method: "PUT",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  removeGroupMemberRole(params: {
    userId: string;
    groupId: string;
    roleId: string;
  }): Promise<{ json: Json<GroupRoleIdList>; params: { userId: string; groupId: string; roleId: string } }> {
    return requestJson<Json<GroupRoleIdList>>(`groups/${params.groupId}/members/${params.userId}/roles/${params.roleId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  getGroupPermissions(params: { userId: string }): Promise<{ json: Json<UserAllGroupPermissions>; params: { userId: string } }> {
    return requestJson<Json<UserAllGroupPermissions>>(`users/${params.userId}/groups/permissions`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
};
