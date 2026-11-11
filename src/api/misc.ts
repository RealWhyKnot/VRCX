import type {
  BoopRequest,
  File,
  FileAnalysis,
  GetStore,
  InfoPush,
  Instance,
  Store,
  Success,
  UpdateUserBadgeRequest,
  UpdateUserNoteRequest,
  UpdateUserNoteResponse,
} from "vrchat";
import type { Json } from "../types/vrcx";
import { queryClient } from "../queries/client";
import { queryKeys } from "../queries/keys";
import { request } from "../services/request";
import { useUserStore } from "../stores/user";
import { requestJson } from "./request-json";

function getCurrentUserId() {
  return useUserStore().currentUser.id;
}

const miscRequest = {
  getFile(params: { fileId: string }): Promise<{ json: Json<File>; params: { fileId: string } }> {
    return requestJson<Json<File>>(`file/${params.fileId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  saveNote(params: UpdateUserNoteRequest): Promise<{ json: Json<UpdateUserNoteResponse>; params: UpdateUserNoteRequest }> {
    return requestJson<Json<UpdateUserNoteResponse>>("userNotes", {
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

  getFileAnalysis(params: {
    fileId: string;
    version: number;
    variant: string;
  }): Promise<{ json: Json<FileAnalysis>; params: { fileId: string; version: number; variant: string } }> {
    return requestJson<Json<FileAnalysis>>(`analysis/${params.fileId}/${params.version}/${params.variant}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getStore(params: GetStore["query"]): Promise<{ json: Json<Store>; params: GetStore["query"] }> {
    return requestJson<Json<Store>>("economy/store", {
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

  closeInstance(params: { location: string; hardClose?: boolean }): Promise<{ json: Json<Instance>; params: { location: string; hardClose?: boolean } }> {
    return requestJson<Json<Instance>>(`instances/${params.location}`, {
      method: "DELETE",
      params: {
        hardClose: params.hardClose ?? false,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  deleteWorldPersistData(params: { worldId: string }): Promise<{ json: unknown; params: { worldId: string } }> {
    return request(`users/${getCurrentUserId()}/${params.worldId}/persist`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  hasWorldPersistData(params: { worldId: string }): Promise<{ json: unknown; params: { worldId: string } }> {
    return request(`users/${getCurrentUserId()}/${params.worldId}/persist/exists`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  updateBadge(params: { badgeId: string } & UpdateUserBadgeRequest): Promise<{ json: unknown; params: { badgeId: string } & UpdateUserBadgeRequest }> {
    return request(`users/${getCurrentUserId()}/badges/${params.badgeId}`, {
      method: "PUT",
      params: {
        userId: getCurrentUserId(),
        badgeId: params.badgeId,
        hidden: params.hidden,
        showcased: params.showcased,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getVisits(): Promise<{ json: number }> {
    return request("visits", {
      method: "GET",
    }).then((json) => {
      if (typeof json !== "number") {
        throw new Error("API response is not a number: visits");
      }
      const args = {
        json,
      };
      return args;
    });
  },

  deleteFile(fileId: string): Promise<{ json: Json<File>; fileId: string }> {
    return requestJson<Json<File>>(`file/${fileId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        fileId,
      };
      queryClient.removeQueries({
        queryKey: queryKeys.file(fileId),
        exact: true,
      });
      return args;
    });
  },

  sendBoop(params: { userId: string } & BoopRequest): Promise<{ json: Json<Success>; params: { userId: string } & BoopRequest }> {
    return requestJson<Json<Success>>(`users/${params.userId}/boop`, {
      method: "POST",
      params: {
        emojiId: params.emojiId,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getInfoPush(params: { require?: string; include?: string[] }): Promise<{ json: Json<InfoPush[]>; params: { require?: string; include?: string[] } }> {
    const query = {
      require: params.require,
      include: params.include,
    };
    return requestJson<Json<InfoPush[]>>("infoPush", {
      method: "GET",
      params: query,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
};

export { miscRequest };
