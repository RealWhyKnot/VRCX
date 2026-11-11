import type { File, LimitedWorld, SearchWorlds, UpdateWorldRequest, World } from "vrchat";
import type { Json, WorldRating, WorldRatingValue } from "../types/vrcx";
import { patchAndRefetchActiveQuery } from "../queries/entity-cache";
import { queryKeys } from "../queries/keys";
import { request } from "../services/request";
import { applyWorld } from "../coordinators/world-coordinator";

function isObjectJson<T>(value: unknown): value is Json<T> {
  return typeof value === "object" && value !== null;
}

function isListJson<T>(value: unknown): value is Json<T[]> {
  return Array.isArray(value);
}

function unexpectedResponse(endpoint: string) {
  return new Error(`Unexpected world response: ${endpoint}`);
}

const worldRequest = {
  getWorld(params: { worldId: string }): Promise<{ json: Json<World>; ref: ReturnType<typeof applyWorld>; params: { worldId: string } }> {
    const endpoint = `worlds/${params.worldId}`;
    return request(endpoint, {
      method: "GET",
    }).then((json) => {
      if (!isObjectJson<World>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return {
        json,
        params,
        ref: applyWorld(json),
      };
    });
  },

  getWorlds(
    params: SearchWorlds["query"],
    option?: string
  ): Promise<{ json: Json<LimitedWorld[]>; params: SearchWorlds["query"]; option?: string | undefined }> {
    let endpoint = "worlds";
    if (typeof option !== "undefined") {
      endpoint = `worlds/${option}`;
    }
    return request(endpoint, {
      method: "GET",
      params,
    }).then((json) => {
      if (!isListJson<LimitedWorld>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
        option,
      };
      for (const world of args.json) {
        applyWorld(world);
      }
      return args;
    });
  },

  deleteWorld(params: { worldId: string }): Promise<{ json: Json<World>; params: { worldId: string } }> {
    const endpoint = `worlds/${params.worldId}`;
    return request(endpoint, {
      method: "DELETE",
    }).then((json) => {
      if (!isObjectJson<World>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  saveWorld(
    params: UpdateWorldRequest & { id: string }
  ): Promise<{ json: Json<World>; params: UpdateWorldRequest & { id: string }; ref: ReturnType<typeof applyWorld> }> {
    const endpoint = `worlds/${params.id}`;
    return request(endpoint, {
      method: "PUT",
      params,
    }).then((json) => {
      if (!isObjectJson<World>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
        ref: applyWorld(json),
      };
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.world(args.ref.id),
        nextData: args,
      }).catch((error: unknown) => {
        console.error("Failed to refresh world query after mutation:", error);
      });
      return args;
    });
  },

  publishWorld(params: { worldId: string }): Promise<{ json: Json<World>; params: { worldId: string }; ref: ReturnType<typeof applyWorld> }> {
    const endpoint = `worlds/${params.worldId}/publish`;
    return request(endpoint, {
      method: "PUT",
      params,
    }).then((json) => {
      if (!isObjectJson<World>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
        ref: applyWorld(json),
      };
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.world(args.ref.id),
        nextData: args,
      }).catch((error: unknown) => {
        console.error("Failed to refresh world query after publish:", error);
      });
      return args;
    });
  },

  unpublishWorld(params: { worldId: string }): Promise<{ json: Json<World>; params: { worldId: string }; ref: ReturnType<typeof applyWorld> }> {
    const endpoint = `worlds/${params.worldId}/publish`;
    return request(endpoint, {
      method: "DELETE",
      params,
    }).then((json) => {
      if (!isObjectJson<World>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
        ref: applyWorld(json),
      };
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.world(args.ref.id),
        nextData: args,
      }).catch((error: unknown) => {
        console.error("Failed to refresh world query after unpublish:", error);
      });
      return args;
    });
  },

  uploadWorldImage(imageData: string): Promise<{ json: Json<File>; params: { tag: string } }> {
    const params = {
      tag: "worldimage",
    };
    return request("file/image", {
      uploadImage: true,
      matchingDimensions: false,
      postData: JSON.stringify(params),
      imageData,
    }).then((json) => {
      if (!isObjectJson<File>(json)) {
        throw unexpectedResponse("file/image");
      }
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getWorldRating(params: { worldId: string }): Promise<{ json: WorldRating | undefined; params: { worldId: string } }> {
    return request(`worlds/${params.worldId}/rating`, {
      method: "GET",
    }).then((json) => {
      return {
        json: isObjectJson<WorldRating>(json) ? json : undefined,
        params,
      };
    });
  },

  setWorldRating(params: {
    worldId: string;
    value: WorldRatingValue;
  }): Promise<{ json: WorldRating | undefined; params: { worldId: string; value: WorldRatingValue } }> {
    return request(`worlds/${params.worldId}/rating`, {
      method: "PUT",
      params: { value: params.value },
    }).then((json) => {
      return {
        json: isObjectJson<WorldRating>(json) ? json : undefined,
        params,
      };
    });
  },

  deleteWorldRating(params: { worldId: string }): Promise<{ json: WorldRating | undefined; params: { worldId: string } }> {
    return request(`worlds/${params.worldId}/rating`, {
      method: "DELETE",
    }).then((json) => {
      return {
        json: isObjectJson<WorldRating>(json) ? json : undefined,
        params,
      };
    });
  },
};

export { worldRequest };
