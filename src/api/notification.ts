import type {
  GetNotifications,
  InviteRequest,
  InviteResponse,
  Notification,
  NotificationV2,
  RequestInviteRequest,
  RespondNotificationV2Request,
  SentNotification,
  Success,
} from "vrchat";
import type { Json } from "../types/vrcx";
import { request } from "../services/request";
import { requestJson, requestAck } from "./request-json";
import { useGalleryStore } from "../stores/gallery";

type InviteParams = InviteRequest & { worldId?: string; worldName?: string; rsvp?: boolean };
type RequestInviteParams = RequestInviteRequest & { platform?: string };
type NotificationListParams = GetNotifications["query"];
type NotificationV2ListParams = { n?: number; offset?: number; type?: string };
type NotificationIdParams = { notificationId: string };

const notificationRequest = {
  getNotifications(params: NotificationListParams): Promise<{ json: Json<Notification[]>; params: NotificationListParams }> {
    return requestJson<Json<Notification[]>>("auth/user/notifications", {
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

  getHiddenFriendRequests(params: NotificationListParams): Promise<{ json: Json<Notification[]>; params: NotificationListParams }> {
    return requestJson<Json<Notification[]>>("auth/user/notifications", {
      method: "GET",
      params: {
        type: "friendRequest",
        hidden: true,
        ...params,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getNotificationsV2(params: NotificationV2ListParams): Promise<{ json: Json<NotificationV2[]>; params: NotificationV2ListParams }> {
    return requestJson<Json<NotificationV2[]>>("notifications", {
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

  sendInvite(
    params: InviteParams,
    receiverUserId: string
  ): Promise<{
    json: Json<SentNotification>;
    params: InviteParams;
    receiverUserId: string;
  }> {
    return requestJson<Json<SentNotification>>(`invite/${receiverUserId}`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
        receiverUserId,
      };
      return args;
    });
  },
  sendInvitePhoto(
    params: InviteParams,
    receiverUserId: string
  ): Promise<{
    json: Json<SentNotification>;
    params: InviteParams;
    receiverUserId: string;
  }> {
    return requestJson<Json<SentNotification>>(`invite/${receiverUserId}/photo`, {
      uploadImageLegacy: true,
      postData: JSON.stringify(params),
      imageData: useGalleryStore().uploadImage,
    }).then((json) => {
      const args = {
        json,
        params,
        receiverUserId,
      };
      return args;
    });
  },

  sendRequestInvite(
    params: RequestInviteParams,
    receiverUserId: string
  ): Promise<{
    json: Json<Notification>;
    params: RequestInviteParams;
    receiverUserId: string;
  }> {
    return requestJson<Json<Notification>>(`requestInvite/${receiverUserId}`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
        receiverUserId,
      };
      return args;
    });
  },

  sendRequestInvitePhoto(
    params: RequestInviteParams,
    receiverUserId: string
  ): Promise<{
    json: Json<Notification>;
    params: RequestInviteParams;
    receiverUserId: string;
  }> {
    return requestJson<Json<Notification>>(`requestInvite/${receiverUserId}/photo`, {
      uploadImageLegacy: true,
      postData: JSON.stringify(params),
      imageData: useGalleryStore().uploadImage,
    }).then((json) => {
      const args = {
        json,
        params,
        receiverUserId,
      };
      return args;
    });
  },

  sendInviteResponse(params: InviteResponse, inviteId: string): Promise<{ json: Json<Notification>; params: InviteResponse; inviteId: string }> {
    return requestJson<Json<Notification>>(`invite/${inviteId}/response`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
        inviteId,
      };
      return args;
    });
  },

  sendInviteResponsePhoto(params: InviteResponse, inviteId: string): Promise<{ json: Json<Notification>; params: InviteResponse; inviteId: string }> {
    return requestJson<Json<Notification>>(`invite/${inviteId}/response/photo`, {
      uploadImageLegacy: true,
      postData: JSON.stringify(params),
      imageData: useGalleryStore().uploadImage,
      inviteId,
    }).then((json) => {
      const args = {
        json,
        params,
        inviteId,
      };
      return args;
    });
  },

  acceptFriendRequestNotification(params: NotificationIdParams): Promise<{ json: Json<Success> | undefined; params: NotificationIdParams }> {
    return requestAck<Json<Success>>(`auth/user/notifications/${params.notificationId}/accept`, {
      method: "PUT",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  hideNotification(params: NotificationIdParams): Promise<{ json: Json<Success> | undefined; params: NotificationIdParams }> {
    return requestAck<Json<Success>>(`auth/user/notifications/${params.notificationId}/hide`, {
      method: "PUT",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  seeNotification(params: NotificationIdParams): Promise<{ json: Json<Notification>; params: NotificationIdParams }> {
    return requestJson<Json<Notification>>(`auth/user/notifications/${params.notificationId}/see`, {
      method: "PUT",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  seeNotificationV2(params: NotificationIdParams): Promise<{ json: Json<NotificationV2>; params: NotificationIdParams }> {
    return requestJson<Json<NotificationV2>>(`notifications/${params.notificationId}/see`, {
      method: "POST",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  sendNotificationResponse(
    params: NotificationIdParams & RespondNotificationV2Request
  ): Promise<{ json: string; params: NotificationIdParams & RespondNotificationV2Request }> {
    return request(`notifications/${params.notificationId}/respond`, {
      method: "POST",
      params,
    }).then((json) => {
      if (typeof json !== "string") {
        throw new Error(`API response is not text: notifications/${params.notificationId}/respond`);
      }
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  hideNotificationV2(notificationId: string): Promise<{ json: Json<Success> | undefined; params: NotificationIdParams }> {
    return requestAck<Json<Success>>(`notifications/${notificationId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params: {
          notificationId,
        },
      };
      return args;
    });
  },
};

export { notificationRequest };
