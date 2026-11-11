import type {
  Avatar,
  AvatarStyle,
  CurrentUser,
  File,
  GetLicensedAvatars,
  GroupGalleryFileOrder,
  GroupGalleryFileOrderRequest,
  SearchAvatars,
  ServiceQueueStats,
  ServiceStatus,
  UpdateAvatarRequest,
} from "vrchat";
import type { Json } from "../types/vrcx";
import { patchAndRefetchActiveQuery } from "../queries/entity-cache";
import { queryKeys } from "../queries/keys";
import { request } from "../services/request";
import { requestJson } from "./request-json";
import { applyCurrentUser } from "../coordinators/current-user-apply";

const avatarRequest = {
  getAvatar(params: { avatarId: string }): Promise<{ json: Json<Avatar>; params: { avatarId: string } }> {
    return requestJson<Json<Avatar>>(`avatars/${params.avatarId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getAvatars(params: SearchAvatars["query"]): Promise<{ json: Json<Avatar[]>; params: SearchAvatars["query"] }> {
    return requestJson<Json<Avatar[]>>("avatars", {
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

  saveAvatar(params: UpdateAvatarRequest): Promise<{ json: Json<Avatar>; params: UpdateAvatarRequest }> {
    return requestJson<Json<Avatar>>(`avatars/${params.id}`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.avatar(params.id ?? ""),
        nextData: args,
      }).catch((err: unknown) => {
        console.error("Failed to refresh avatar query after mutation:", err);
      });
      return args;
    });
  },

  selectAvatar(params: { avatarId: string }): Promise<{ json: Json<CurrentUser>; params: { avatarId: string } }> {
    return requestJson<Json<CurrentUser>>(`avatars/${params.avatarId}/select`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      const ref = applyCurrentUser(json);
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.user(ref.id),
        nextData: {
          json,
          params: { userId: ref.id },
          ref,
        },
      }).catch((err: unknown) => {
        console.error("Failed to refresh current user query after avatar select:", err);
      });
      return args;
    });
  },

  selectFallbackAvatar(params: { avatarId: string }): Promise<{ json: Json<CurrentUser>; params: { avatarId: string } }> {
    return requestJson<Json<CurrentUser>>(`avatars/${params.avatarId}/selectfallback`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      const ref = applyCurrentUser(json);
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.user(ref.id),
        nextData: {
          json,
          params: { userId: ref.id },
          ref,
        },
      }).catch((err: unknown) => {
        console.error("Failed to refresh current user query after fallback avatar select:", err);
      });
      return args;
    });
  },

  deleteAvatar(params: { avatarId: string }): Promise<{ json: Json<Avatar>; params: { avatarId: string } }> {
    return requestJson<Json<Avatar>>(`avatars/${params.avatarId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  createImposter(params: { avatarId: string }): Promise<{ json: Json<ServiceStatus>; params: { avatarId: string } }> {
    return requestJson<Json<ServiceStatus>>(`avatars/${params.avatarId}/impostor/enqueue`, {
      method: "POST",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getImpostorQueueStats(): Promise<Json<ServiceQueueStats>> {
    return requestJson<Json<ServiceQueueStats>>("avatars/impostor/queue/stats", {
      method: "GET",
    });
  },

  deleteImposter(params: { avatarId: string }): Promise<{ json: unknown; params: { avatarId: string } }> {
    return request(`avatars/${params.avatarId}/impostor`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getAvailableAvatarStyles(): Promise<{ json: Json<AvatarStyle[]> }> {
    return requestJson<Json<AvatarStyle[]>>("avatarStyles", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  getAvatarGallery(avatarId: string): Promise<{ json: Json<File[]>; params: { tag: string; galleryId: string; n: number; offset: number } }> {
    const params = {
      tag: "avatargallery",
      galleryId: avatarId,
      n: 100,
      offset: 0,
    };
    return requestJson<Json<File[]>>(`files`, {
      params,
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  uploadAvatarImage(imageData: string): Promise<{ json: Json<File>; params: { tag: string } }> {
    const params = {
      tag: "avatarimage",
    };
    return requestJson<Json<File>>("file/image", {
      uploadImage: true,
      matchingDimensions: false,
      postData: JSON.stringify(params),
      imageData,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  uploadAvatarGalleryImage(imageData: string, avatarId: string): Promise<{ json: Json<File>; params: { tag: string; galleryId: string } }> {
    const params = {
      tag: "avatargallery",
      galleryId: avatarId,
    };
    return requestJson<Json<File>>("file/image", {
      uploadImage: true,
      matchingDimensions: false,
      postData: JSON.stringify(params),
      imageData,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  setAvatarGalleryOrder(order: string[], galleryId: string): Promise<{ json: Json<GroupGalleryFileOrder>; params: GroupGalleryFileOrderRequest }> {
    const params = {
      ids: order,
      galleryId,
    };
    return requestJson<Json<GroupGalleryFileOrder>>("files/order", {
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

  getLicensedAvatars(params: GetLicensedAvatars["query"]): Promise<{ json: Json<Avatar[]>; params: GetLicensedAvatars["query"] }> {
    return requestJson<Json<Avatar[]>>("avatars/licensed", {
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
};

export { avatarRequest };
