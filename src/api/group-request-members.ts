import type { applyGroupMember } from "../coordinators/group-coordinator";
import { request } from "../services/request";
import type { Json } from "../types/vrcx";
import { requestAck, requestJson } from "./request-json";
import type {
  BanGroupMemberRequest,
  CreateGroupInviteRequest,
  GetGroupMemberResponse,
  GetGroupMembers,
  GetGroupPosts,
  GetGroupPostsResponse,
  Group,
  GroupMember,
  GroupPost,
  SearchGroupMembers,
  SearchGroupMembersResponse,
  Success,
} from "vrchat";
import type { GroupMembershipStatus, GroupPostRequest } from "./group-request-types";
import { getCurrentUserId, refetchActiveGroupScope } from "./group-request-scope";

export const groupMembersRequest = {
  getGroupPosts(
    params: { groupId: string } & GetGroupPosts["query"]
  ): Promise<{ json: Json<GetGroupPostsResponse>; params: { groupId: string } & GetGroupPosts["query"] }> {
    return requestJson<Json<GetGroupPostsResponse>>(`groups/${params.groupId}/posts`, {
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
  editGroupPost(params: { groupId: string; postId: string } & Partial<GroupPostRequest>): Promise<{
    json: Json<GroupPost>;
    params: { groupId: string; postId: string } & Partial<GroupPostRequest>;
  }> {
    return requestJson<Json<GroupPost>>(`groups/${params.groupId}/posts/${params.postId}`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  createGroupPost(params: { groupId: string } & GroupPostRequest): Promise<{ json: Json<GroupPost>; params: { groupId: string } & GroupPostRequest }> {
    return requestJson<Json<GroupPost>>(`groups/${params.groupId}/posts`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(params.groupId);
      return args;
    });
  },
  getGroupMember(params: { groupId: string; userId: string }): Promise<{
    json: Json<GetGroupMemberResponse>;
    params: { groupId: string; userId: string };
    ref?: ReturnType<typeof applyGroupMember>;
  }> {
    return requestJson<Json<GetGroupMemberResponse>>(`groups/${params.groupId}/members/${params.userId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  getGroupMembers(
    params: { groupId: string } & GetGroupMembers["query"]
  ): Promise<{ json: Json<GroupMember[]>; params: { groupId: string } & GetGroupMembers["query"] }> {
    return requestJson<Json<GroupMember[]>>(`groups/${params.groupId}/members`, {
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
  getGroupMembersSearch(
    params: { groupId: string } & SearchGroupMembers["query"]
  ): Promise<{ json: Json<SearchGroupMembersResponse>; params: { groupId: string } & SearchGroupMembers["query"] }> {
    return requestJson<Json<SearchGroupMembersResponse>>(`groups/${params.groupId}/members/search`, {
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

  getMyGroupsByStatus(params: {
    membershipStatus: GroupMembershipStatus;
  }): Promise<{ json: Json<Group[]>; params: { membershipStatus: GroupMembershipStatus } }> {
    return requestJson<Json<Group[]>>(`users/${getCurrentUserId()}/groups/${params.membershipStatus}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  blockGroup(params: { groupId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/block`, {
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
  unblockGroup(params: { groupId: string; userId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; userId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/members/${params.userId}`, {
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
  declineGroupInvite(params: { groupId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/members/${getCurrentUserId()}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  sendGroupInvite(
    params: { groupId: string } & CreateGroupInviteRequest
  ): Promise<{ json: Json<Success> | undefined; params: { groupId: string } & CreateGroupInviteRequest }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/invites`, {
      method: "POST",
      params: {
        userId: params.userId,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  kickGroupMember(params: { groupId: string; userId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; userId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/members/${params.userId}`, {
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
  banGroupMember(
    params: { groupId: string } & BanGroupMemberRequest
  ): Promise<{ json: Json<GroupMember>; params: { groupId: string } & BanGroupMemberRequest }> {
    return requestJson<Json<GroupMember>>(`groups/${params.groupId}/bans`, {
      method: "POST",
      params: {
        userId: params.userId,
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
  unbanGroupMember(params: { groupId: string; userId: string }): Promise<{ json: Json<GroupMember>; params: { groupId: string; userId: string } }> {
    return requestJson<Json<GroupMember>>(`groups/${params.groupId}/bans/${params.userId}`, {
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
  deleteSentGroupInvite(params: {
    groupId: string;
    userId: string;
  }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; userId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/invites/${params.userId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  deleteBlockedGroupRequest(params: {
    groupId: string;
    userId: string;
  }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; userId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/members/${params.userId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  acceptGroupInviteRequest(params: { groupId: string; userId: string }): Promise<{ json: unknown; params: { groupId: string; userId: string } }> {
    return request(`groups/${params.groupId}/requests/${params.userId}`, {
      method: "PUT",
      params: {
        action: "accept",
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
  rejectGroupInviteRequest(params: { groupId: string; userId: string }): Promise<{ json: unknown; params: { groupId: string; userId: string } }> {
    return request(`groups/${params.groupId}/requests/${params.userId}`, {
      method: "PUT",
      params: {
        action: "reject",
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
  blockGroupInviteRequest(params: { groupId: string; userId: string }): Promise<{ json: unknown; params: { groupId: string; userId: string } }> {
    return request(`groups/${params.groupId}/requests/${params.userId}`, {
      method: "PUT",
      params: {
        action: "reject",
        block: true,
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
};
