import type { Avatar, CreateFileVersionRequest, File, FileUploadUrl, UpdateAvatarRequest, UpdateWorldRequest, World } from "vrchat";
import type { Json, RequestOptions } from "../types/vrcx";
import { useAvatarStore } from "../stores/avatar";
import { useWorldStore } from "../stores/world";
import { applyWorld } from "../coordinators/world-coordinator";
import { request } from "../services/request";

function requestObject<T extends object>(endpoint: string, options: RequestOptions): Promise<T> {
  const isResponseObject = (value: unknown): value is T => typeof value === "object" && value !== null;
  return request(endpoint, options).then((response) => {
    if (!isResponseObject(response)) {
      throw new Error(`Image response is not an object: ${endpoint}`);
    }
    return response;
  });
}

async function finishPendingUpload(id: string): Promise<void> {
  const json = await requestObject<Json<File>>(`file/${id}`, {
    method: "GET",
  });
  const fileId = json.id;
  const latestVersion = json.versions[json.versions.length - 1];
  if (latestVersion === undefined) {
    throw new Error(`File has no versions: ${id}`);
  }
  const fileVersion = latestVersion.version;
  void request(`file/${fileId}/${fileVersion}/signature/finish`, {
    method: "PUT",
  }).catch((err: unknown) => console.error("Failed to finish signature:", err));
  void request(`file/${fileId}/${fileVersion}/file/finish`, {
    method: "PUT",
  }).catch((err: unknown) => console.error("Failed to finish file:", err));
}

const imageRequest = {
  async uploadAvatarFailCleanup(id: string) {
    const avatarStore = useAvatarStore();
    try {
      await finishPendingUpload(id);
    } catch (error: unknown) {
      console.error("Failed to cleanup avatar upload:", error);
    }
    avatarStore.setAvatarDialogLoading(false);
  },

  async uploadAvatarImage(params: CreateFileVersionRequest, fileId: string): Promise<{ json: Json<File>; params: CreateFileVersionRequest; fileId: string }> {
    try {
      return await requestObject<Json<File>>(`file/${fileId}`, {
        method: "POST",
        params,
      }).then((json) => {
        const args = {
          json,
          params,
          fileId,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadAvatarFailCleanup(fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
      throw err;
    }
  },

  async uploadAvatarImageFileStart(params: {
    fileId: string;
    fileVersion: number;
  }): Promise<{ json: Json<FileUploadUrl>; params: { fileId: string; fileVersion: number } } | undefined> {
    try {
      return await requestObject<Json<FileUploadUrl>>(`file/${params.fileId}/${params.fileVersion}/file/start`, {
        method: "PUT",
      }).then((json) => {
        const args = {
          json,
          params,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadAvatarFailCleanup(params.fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
      return undefined;
    }
  },

  uploadAvatarImageFileFinish(params: { fileId: string; fileVersion: number }): Promise<{ json: Json<File>; params: { fileId: string; fileVersion: number } }> {
    return requestObject<Json<File>>(`file/${params.fileId}/${params.fileVersion}/file/finish`, {
      method: "PUT",
      params: {
        maxParts: 0,
        nextPartNumber: 0,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  async uploadAvatarImageSigStart(params: {
    fileId: string;
    fileVersion: number;
  }): Promise<{ json: Json<FileUploadUrl>; params: { fileId: string; fileVersion: number } } | undefined> {
    try {
      return await requestObject<Json<FileUploadUrl>>(`file/${params.fileId}/${params.fileVersion}/signature/start`, {
        method: "PUT",
      }).then((json) => {
        const args = {
          json,
          params,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadAvatarFailCleanup(params.fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
      return undefined;
    }
  },

  uploadAvatarImageSigFinish(params: { fileId: string; fileVersion: number }): Promise<{ json: Json<File>; params: { fileId: string; fileVersion: number } }> {
    return requestObject<Json<File>>(`file/${params.fileId}/${params.fileVersion}/signature/finish`, {
      method: "PUT",
      params: {
        maxParts: 0,
        nextPartNumber: 0,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  setAvatarImage(params: { id: string } & UpdateAvatarRequest): Promise<{ json: Json<Avatar>; params: { id: string } & UpdateAvatarRequest }> {
    return requestObject<Json<Avatar>>(`avatars/${params.id}`, {
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

  async uploadWorldFailCleanup(id: string) {
    const worldStore = useWorldStore();
    try {
      await finishPendingUpload(id);
    } catch (error: unknown) {
      console.error("Failed to cleanup world upload:", error);
    }
    worldStore.setWorldDialogLoading(false);
  },

  async uploadWorldImage(
    params: CreateFileVersionRequest,
    fileId: string
  ): Promise<{ json: Json<File>; params: CreateFileVersionRequest; fileId: string } | undefined> {
    try {
      return await requestObject<Json<File>>(`file/${fileId}`, {
        method: "POST",
        params,
      }).then((json) => {
        const args = {
          json,
          params,
          fileId,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadWorldFailCleanup(fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
    }
    return undefined;
  },

  async uploadWorldImageFileStart(params: {
    fileId: string;
    fileVersion: number;
  }): Promise<{ json: Json<FileUploadUrl>; params: { fileId: string; fileVersion: number } } | undefined> {
    try {
      return await requestObject<Json<FileUploadUrl>>(`file/${params.fileId}/${params.fileVersion}/file/start`, {
        method: "PUT",
      }).then((json) => {
        const args = {
          json,
          params,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadWorldFailCleanup(params.fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
    }
    return undefined;
  },

  uploadWorldImageFileFinish(params: { fileId: string; fileVersion: number }): Promise<{ json: Json<File>; params: { fileId: string; fileVersion: number } }> {
    return requestObject<Json<File>>(`file/${params.fileId}/${params.fileVersion}/file/finish`, {
      method: "PUT",
      params: {
        maxParts: 0,
        nextPartNumber: 0,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  async uploadWorldImageSigStart(params: {
    fileId: string;
    fileVersion: number;
  }): Promise<{ json: Json<FileUploadUrl>; params: { fileId: string; fileVersion: number } } | undefined> {
    try {
      return await requestObject<Json<FileUploadUrl>>(`file/${params.fileId}/${params.fileVersion}/signature/start`, {
        method: "PUT",
      }).then((json) => {
        const args = {
          json,
          params,
        };
        return args;
      });
    } catch (err: unknown) {
      console.error(err);
      imageRequest.uploadWorldFailCleanup(params.fileId).catch((cleanupErr: unknown) => console.error(cleanupErr));
    }
    return undefined;
  },

  uploadWorldImageSigFinish(params: { fileId: string; fileVersion: number }): Promise<{ json: Json<File>; params: { fileId: string; fileVersion: number } }> {
    return requestObject<Json<File>>(`file/${params.fileId}/${params.fileVersion}/signature/finish`, {
      method: "PUT",
      params: {
        maxParts: 0,
        nextPartNumber: 0,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  setWorldImage(
    params: { id: string } & UpdateWorldRequest
  ): Promise<{ json: Json<World>; params: { id: string } & UpdateWorldRequest; ref: ReturnType<typeof applyWorld> }> {
    return requestObject<Json<World>>(`worlds/${params.id}`, {
      method: "PUT",
      params,
    }).then((json) => {
      return {
        json,
        params,
        ref: applyWorld(json),
      };
    });
  },

  getAvatarImages(params: { fileId: string }): Promise<{ json: Json<File>; params: { fileId: string } }> {
    return requestObject<Json<File>>(`file/${params.fileId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getWorldImages(params: { fileId: string }): Promise<{ json: Json<File>; params: { fileId: string } }> {
    return requestObject<Json<File>>(`file/${params.fileId}`, {
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

export { imageRequest };
