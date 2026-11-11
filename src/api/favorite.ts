import type {
  Avatar,
  Favorite,
  FavoriteGroup,
  FavoriteLimits,
  FavoritedWorld,
  GetFavoriteGroups,
  GetFavoritedAvatars,
  GetFavoritedWorlds,
  GetFavorites,
  Success,
  UpdateFavoriteGroupRequest,
  UpdateFavoriteGroupResponse,
} from "vrchat";
import type { Json } from "../types/vrcx";
import { useUserStore } from "../stores/user";
import { handleFavoriteAdd, handleFavoriteDelete, handleFavoriteGroupClear } from "../coordinators/favorite-coordinator";
import { queryClient } from "../queries/client";
import { request } from "../services/request";

type FavoriteParams = {
  type: string;
  favoriteId: string;
  tags: string;
};

function isObjectJson<T>(value: unknown): value is Json<T> {
  return typeof value === "object" && value !== null;
}

function isListJson<T>(value: unknown): value is Json<T[]> {
  return Array.isArray(value);
}

function unexpectedResponse(endpoint: string) {
  return new Error(`Unexpected favorite response: ${endpoint}`);
}

function getCurrentUserId() {
  return useUserStore().currentUser.id;
}

function refetchActiveFavoriteQueries() {
  queryClient
    .invalidateQueries({
      queryKey: ["favorite"],
      refetchType: "active",
    })
    .catch((err: unknown) => {
      console.error("Failed to refresh favorite queries:", err);
    });
}

const favoriteRequest = {
  getFavoriteLimits(): Promise<{ json: Json<FavoriteLimits> }> {
    const endpoint = "auth/user/favoritelimits";
    return request(endpoint, {
      method: "GET",
    }).then((json) => {
      if (!isObjectJson<FavoriteLimits>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return { json };
    });
  },

  getFavorites(params: GetFavorites["query"]): Promise<{ json: Json<Favorite[]>; params: GetFavorites["query"] }> {
    const endpoint = "favorites";
    return request(endpoint, {
      method: "GET",
      params,
    }).then((json) => {
      if (!isListJson<Favorite>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return { json, params };
    });
  },

  addFavorite(params: FavoriteParams): Promise<{ json: Json<Favorite>; params: FavoriteParams }> {
    const endpoint = "favorites";
    return request(endpoint, {
      method: "POST",
      params,
    }).then((json) => {
      if (!isObjectJson<Favorite>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
      };
      handleFavoriteAdd(args);
      refetchActiveFavoriteQueries();
      return args;
    });
  },

  deleteFavorite(params: { objectId: string }): Promise<{ json: Json<Success>; params: { objectId: string } }> {
    const endpoint = `favorites/${params.objectId}`;
    return request(endpoint, {
      method: "DELETE",
    }).then((json) => {
      if (!isObjectJson<Success>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
      };
      handleFavoriteDelete(params.objectId);
      refetchActiveFavoriteQueries();
      return args;
    });
  },

  getFavoriteGroups(params: GetFavoriteGroups["query"]): Promise<{ json: Json<FavoriteGroup[]>; params: GetFavoriteGroups["query"] }> {
    const endpoint = "favorite/groups";
    return request(endpoint, {
      method: "GET",
      params,
    }).then((json) => {
      if (!isListJson<FavoriteGroup>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return { json, params };
    });
  },

  saveFavoriteGroup(params: UpdateFavoriteGroupRequest & { type: string; group: string }): Promise<{
    json: Json<UpdateFavoriteGroupResponse>;
    params: UpdateFavoriteGroupRequest & { type: string; group: string };
  }> {
    const endpoint = `favorite/group/${params.type}/${params.group}/${getCurrentUserId()}`;
    return request(endpoint, {
      method: "PUT",
      params,
    }).then((json) => {
      if (!isObjectJson<UpdateFavoriteGroupResponse>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
      };
      refetchActiveFavoriteQueries();
      return args;
    });
  },

  clearFavoriteGroup(params: { type: string; group: string }): Promise<{ json: Json<Success>; params: { type: string; group: string } }> {
    const endpoint = `favorite/group/${params.type}/${params.group}/${getCurrentUserId()}`;
    return request(endpoint, {
      method: "DELETE",
      params,
    }).then((json) => {
      if (!isObjectJson<Success>(json)) {
        throw unexpectedResponse(endpoint);
      }
      const args = {
        json,
        params,
      };
      handleFavoriteGroupClear(args);
      refetchActiveFavoriteQueries();
      return args;
    });
  },

  getFavoriteWorlds(params: GetFavoritedWorlds["query"]): Promise<{ json: Json<FavoritedWorld[]>; params: GetFavoritedWorlds["query"] }> {
    const endpoint = "worlds/favorites";
    return request(endpoint, {
      method: "GET",
      params,
    }).then((json) => {
      if (!isListJson<FavoritedWorld>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return { json, params };
    });
  },

  getFavoriteAvatars(params: GetFavoritedAvatars["query"]): Promise<{ json: Json<Avatar[]>; params: GetFavoritedAvatars["query"] }> {
    const endpoint = "avatars/favorites";
    return request(endpoint, {
      method: "GET",
      params,
    }).then((json) => {
      if (!isListJson<Avatar>(json)) {
        throw unexpectedResponse(endpoint);
      }
      return { json, params };
    });
  },
};

export { favoriteRequest };
