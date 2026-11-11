import type { Json } from "../types/vrcx";
import { requestAck, requestJson } from "./request-json";
import type {
  AddGroupGalleryImageRequest,
  CreateGroupGalleryRequest,
  GetGroupBans,
  GetGroupGalleryImages,
  GetGroupGalleryImagesResponse,
  GetGroupInvites,
  GetGroupRequests,
  GetUserGroupInstancesForGroupResponse,
  GetUserGroupInstancesResponse,
  GroupAuditLogEntryType,
  GroupGallery,
  GroupGalleryImage,
  GroupMember,
  GroupPermission,
  GroupRole,
  LimitedGroup,
  PaginatedGroupAuditLogEntryList,
  SearchGroups,
  Success,
  UpdateGroupGalleryRequest,
} from "vrchat";
import type { GroupRoleCreateParams, GroupRoleEditParams } from "./group-request-types";
import { getCurrentUserId, refetchActiveGroupScope } from "./group-request-scope";

export const groupRolesGalleryRequest = {
  getGroupBans(
    params: { groupId: string } & GetGroupBans["query"]
  ): Promise<{ json: Json<GroupMember[]>; params: { groupId: string } & GetGroupBans["query"] }> {
    return requestJson<Json<GroupMember[]>>(`groups/${params.groupId}/bans`, {
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
  getGroupAuditLogTypes(params: { groupId: string }): Promise<{ json: Json<GroupAuditLogEntryType[]>; params: { groupId: string } }> {
    return requestJson<Json<GroupAuditLogEntryType[]>>(`groups/${params.groupId}/auditLogTypes`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  getGroupLogs(params: { groupId: string; n: number; offset: number; eventTypes?: string[] }): Promise<{
    json: Json<PaginatedGroupAuditLogEntryList>;
    params: { groupId: string; n: number; offset: number; eventTypes?: string[] };
  }> {
    return requestJson<Json<PaginatedGroupAuditLogEntryList>>(`groups/${params.groupId}/auditLogs`, {
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
  getGroupInvites(
    params: { groupId: string } & GetGroupInvites["query"]
  ): Promise<{ json: Json<GroupMember[]>; params: { groupId: string } & GetGroupInvites["query"] }> {
    return requestJson<Json<GroupMember[]>>(`groups/${params.groupId}/invites`, {
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
  getGroupJoinRequests(
    params: { groupId: string } & GetGroupRequests["query"]
  ): Promise<{ json: Json<GroupMember[]>; params: { groupId: string } & GetGroupRequests["query"] }> {
    return requestJson<Json<GroupMember[]>>(`groups/${params.groupId}/requests`, {
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
  getGroupInstances(params: { groupId: string }): Promise<{ json: Json<GetUserGroupInstancesForGroupResponse>; params: { groupId: string } }> {
    return requestJson<Json<GetUserGroupInstancesForGroupResponse>>(`users/${getCurrentUserId()}/instances/groups/${params.groupId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  getGroupRoles(params: { groupId: string }): Promise<{ json: Json<GroupRole[]>; params: { groupId: string } }> {
    return requestJson<Json<GroupRole[]>>(`groups/${params.groupId}/roles`, {
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

  createGroupRole(params: GroupRoleCreateParams): Promise<{
    json: Json<GroupRole>;
    params: GroupRoleCreateParams;
  }> {
    const { groupId, ...body } = params;
    return requestJson<Json<GroupRole>>(`groups/${groupId}/roles`, {
      method: "POST",
      params: body,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },

  editGroupRole(params: GroupRoleEditParams): Promise<{
    json: Json<GroupRole[]>;
    params: GroupRoleEditParams;
  }> {
    const { groupId, roleId, ...body } = params;
    return requestJson<Json<GroupRole[]>>(`groups/${groupId}/roles/${roleId}`, {
      method: "PUT",
      params: body,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },

  deleteGroupRole(params: { groupId: string; roleId: string }): Promise<{ json: Json<GroupRole[]>; params: { groupId: string; roleId: string } }> {
    return requestJson<Json<GroupRole[]>>(`groups/${params.groupId}/roles/${params.roleId}`, {
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

  getGroupPermissionList(params: { groupId: string }): Promise<{ json: Json<GroupPermission[]>; params: { groupId: string } }> {
    return requestJson<Json<GroupPermission[]>>(`groups/${params.groupId}/permissions`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getUsersGroupInstances(): Promise<{ json: Json<GetUserGroupInstancesResponse> }> {
    return requestJson<Json<GetUserGroupInstancesResponse>>(`users/${getCurrentUserId()}/instances/groups`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  groupSearch(params: SearchGroups["query"]): Promise<{ json: Json<LimitedGroup[]>; params: SearchGroups["query"] }> {
    return requestJson<Json<LimitedGroup[]>>(`groups`, {
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
  getGroupGallery(params: { groupId: string; galleryId: string } & GetGroupGalleryImages["query"]): Promise<{
    json: Json<GetGroupGalleryImagesResponse>;
    params: { groupId: string; galleryId: string } & GetGroupGalleryImages["query"];
  }> {
    return requestJson<Json<GetGroupGalleryImagesResponse>>(`groups/${params.groupId}/galleries/${params.galleryId}`, {
      method: "GET",
      params: {
        n: params.n,
        offset: params.offset,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  createGroupGallery(params: { groupId: string } & CreateGroupGalleryRequest): Promise<{
    json: Json<GroupGallery>;
    params: { groupId: string } & CreateGroupGalleryRequest;
  }> {
    const { groupId, ...body } = params;
    return requestJson<Json<GroupGallery>>(`groups/${groupId}/galleries`, {
      method: "POST",
      params: body,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },

  deleteGroupGallery(params: {
    groupId: string;
    galleryId: string;
  }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; galleryId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/galleries/${params.galleryId}`, {
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

  editGroupGallery(params: { groupId: string; galleryId: string } & UpdateGroupGalleryRequest): Promise<{
    json: Json<GroupGallery>;
    params: { groupId: string; galleryId: string } & UpdateGroupGalleryRequest;
  }> {
    const { groupId, galleryId, ...body } = params;
    return requestJson<Json<GroupGallery>>(`groups/${groupId}/galleries/${galleryId}`, {
      method: "PUT",
      params: body,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveGroupScope(groupId);
      return args;
    });
  },

  addGroupGalleryImage(params: { groupId: string; galleryId: string } & AddGroupGalleryImageRequest): Promise<{
    json: Json<GroupGalleryImage>;
    params: { groupId: string; galleryId: string } & AddGroupGalleryImageRequest;
  }> {
    return requestJson<Json<GroupGalleryImage>>(`groups/${params.groupId}/galleries/${params.galleryId}/images`, {
      method: "POST",
      params: {
        fileId: params.fileId,
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

  deleteGroupGalleryImage(params: {
    groupId: string;
    galleryId: string;
    imageId: string;
  }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; galleryId: string; imageId: string } }> {
    return requestAck<Json<Success>>(`groups/${params.groupId}/galleries/${params.galleryId}/images/${params.imageId}`, {
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
};
