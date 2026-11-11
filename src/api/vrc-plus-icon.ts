import type { File, GetFiles } from "vrchat";
import type { Json } from "../types/vrcx";
import { queryClient } from "../queries/client";
import { request } from "../services/request";

function refetchActiveGalleryQueries() {
  queryClient
    .invalidateQueries({
      queryKey: ["gallery"],
      refetchType: "active",
    })
    .catch((err: unknown) => {
      console.error("Failed to refresh gallery queries:", err);
    });
}

function isFileList(value: unknown): value is Json<File[]> {
  return Array.isArray(value);
}

function isFile(value: unknown): value is Json<File> {
  return typeof value === "object" && value !== null;
}

const vrcPlusIconRequest = {
  getFileList(params: GetFiles["query"]): Promise<{ json: Json<File[]>; params: GetFiles["query"] }> {
    return request("files", {
      method: "GET",
      params,
    }).then((json) => {
      if (!isFileList(json)) {
        throw new Error("files response is not a list");
      }
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  deleteFile(fileId: string): Promise<{ json: Json<File>; fileId: string }> {
    return request(`file/${fileId}`, {
      method: "DELETE",
    }).then((json) => {
      if (!isFile(json)) {
        throw new Error("file response is not an object");
      }
      const args = {
        json,
        fileId,
      };
      refetchActiveGalleryQueries();
      return args;
    });
  },

  uploadVRCPlusIcon(imageData: string): Promise<{ json: Json<File>; params: { tag: string } }> {
    const params = {
      tag: "icon",
    };
    return request("file/image", {
      uploadImage: true,
      matchingDimensions: true,
      postData: JSON.stringify(params),
      imageData,
    }).then((json) => {
      if (!isFile(json)) {
        throw new Error("file response is not an object");
      }
      const args = {
        json,
        params,
      };
      refetchActiveGalleryQueries();
      return args;
    });
  },
};

export { vrcPlusIconRequest };
