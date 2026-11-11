import type { Json } from "../types/vrcx";
import { requestAck, requestJson } from "./request-json";
import type {
  CalendarEvent,
  CreateGroupRequest,
  FollowCalendarEventRequest,
  GetCalendarEvents,
  GetFeaturedCalendarEvents,
  GetFollowedCalendarEvents,
  GetGroupCalendarEvents,
  GetGroupRoleTemplatesResponse,
  Group,
  PaginatedCalendarEventList,
  SearchCalendarEvents,
  Success,
  UpdateGroupRequest,
} from "vrchat";
import type { GroupCalendarEventRequest, GroupEventEditParams } from "./group-request-types";

export const groupCalendarRequest = {
  getGroupCalendar(
    groupId: string,
    query?: Json<GetGroupCalendarEvents["query"]>
  ): Promise<{ json: Json<PaginatedCalendarEventList>; params: { groupId: string } }> {
    return requestJson<Json<PaginatedCalendarEventList>>(`calendar/${groupId}`, {
      method: "GET",
      params: query,
    }).then((json) => {
      const args = {
        json,
        params: {
          groupId,
        },
      };
      return args;
    });
  },

  getGroupCalendarEvent(params: { groupId: string; eventId: string }): Promise<{ json: Json<CalendarEvent>; params: { groupId: string; eventId: string } }> {
    return requestJson<Json<CalendarEvent>>(`calendar/${params.groupId}/${params.eventId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
  getGroupCalendars(params: Json<GetCalendarEvents["query"]>): Promise<Json<PaginatedCalendarEventList>> {
    return requestJson<Json<PaginatedCalendarEventList>>("calendar", {
      method: "GET",
      params,
    });
  },

  getFollowingGroupCalendars(params: Json<GetFollowedCalendarEvents["query"]>): Promise<Json<PaginatedCalendarEventList>> {
    return requestJson<Json<PaginatedCalendarEventList>>("calendar/following", {
      method: "GET",
      params,
    });
  },

  getFeaturedGroupCalendars(params: Json<GetFeaturedCalendarEvents["query"]>): Promise<Json<PaginatedCalendarEventList>> {
    return requestJson<Json<PaginatedCalendarEventList>>("calendar/featured", {
      method: "GET",
      params,
    });
  },

  searchGroupCalendars(params: Json<SearchCalendarEvents["query"]>): Promise<Json<PaginatedCalendarEventList>> {
    return requestJson<Json<PaginatedCalendarEventList>>("calendar/search", {
      method: "GET",
      params,
    });
  },

  followGroupEvent(params: { groupId: string; eventId: string } & FollowCalendarEventRequest): Promise<{
    json: Json<CalendarEvent>;
    params: { groupId: string; eventId: string } & FollowCalendarEventRequest;
  }> {
    return requestJson<Json<CalendarEvent>>(`calendar/${params.groupId}/${params.eventId}/follow`, {
      method: "POST",
      params: {
        isFollowing: params.isFollowing,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  deleteGroupEvent(params: { groupId: string; eventId: string }): Promise<{ json: Json<Success> | undefined; params: { groupId: string; eventId: string } }> {
    return requestAck<Json<Success>>(`calendar/${params.groupId}/${params.eventId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  createGroupEvent(
    params: { groupId: string } & GroupCalendarEventRequest
  ): Promise<{ json: Json<CalendarEvent>; params: { groupId: string } & GroupCalendarEventRequest }> {
    return requestJson<Json<CalendarEvent>>(`calendar/${params.groupId}/event`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  editGroupEvent(params: GroupEventEditParams): Promise<{
    json: Json<CalendarEvent>;
    params: GroupEventEditParams;
  }> {
    return requestJson<Json<CalendarEvent>>(`calendar/${params.groupId}/${params.eventId}/event`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  createGroup(params: CreateGroupRequest): Promise<{ json: Json<Group>; params: CreateGroupRequest }> {
    return requestJson<Json<Group>>("groups", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  editGroup(params: { id: string } & UpdateGroupRequest & { allowGroupJoinPrompt?: boolean }): Promise<{
    json: Json<Group>;
    params: { id: string } & UpdateGroupRequest & { allowGroupJoinPrompt?: boolean };
  }> {
    return requestJson<Json<Group>>(`groups/${params.id}`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getRoleTemplates(): Promise<{ json: Json<GetGroupRoleTemplatesResponse> }> {
    return requestJson<Json<GetGroupRoleTemplatesResponse>>("groups/roleTemplates", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },
};
