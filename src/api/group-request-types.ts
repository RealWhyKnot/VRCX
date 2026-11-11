import type { Json } from "../types/vrcx";
import type { CreateCalendarEventRequest, CreateGroupPostRequest, CreateGroupRoleRequest, UpdateCalendarEventRequest, UpdateGroupRoleRequest } from "vrchat";

export type GroupPostRequest = Omit<CreateGroupPostRequest, "imageId"> & { imageId?: string | null | undefined };

export type GroupCalendarEventRequest = Omit<Json<CreateCalendarEventRequest>, "imageId"> & { imageId?: string | null | undefined };

export type GroupRoleFlags = {
  isAddedOnJoin?: boolean;
  requiresTwoFactor?: boolean;
  requiresPurchase?: boolean;
};

export type GroupRolePermissionNames = { permissions?: string[] | undefined };

export type GroupRoleCreateParams = { groupId: string } & Omit<CreateGroupRoleRequest, "permissions"> & GroupRolePermissionNames & GroupRoleFlags;

export type GroupRoleEditParams = { groupId: string; roleId: string } & Omit<UpdateGroupRoleRequest, "permissions"> & GroupRolePermissionNames & GroupRoleFlags;

export type GroupEventEditParams = { groupId: string; eventId: string } & Omit<Json<UpdateCalendarEventRequest>, "imageId"> & {
    accessType?: CreateCalendarEventRequest["accessType"];
    imageId?: string | null | undefined;
  };

export type GroupMembershipStatus = "invited" | "requested" | "userblocked";
