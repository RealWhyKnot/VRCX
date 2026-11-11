import type { ModerateUserRequest, PlayerModeration, Success } from "vrchat";
import type { Json } from "../types/vrcx";
import { requestJson } from "./request-json";

const playerModerationRequest = {
  getPlayerModerations(): Promise<{ json: Json<PlayerModeration[]> }> {
    return requestJson<Json<PlayerModeration[]>>("auth/user/playermoderations", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  sendPlayerModeration(params: ModerateUserRequest): Promise<{ json: Json<PlayerModeration>; params: ModerateUserRequest }> {
    return requestJson<Json<PlayerModeration>>("auth/user/playermoderations", {
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

  deletePlayerModeration(params: ModerateUserRequest): Promise<{ json: Json<Success>; params: ModerateUserRequest }> {
    return requestJson<Json<Success>>("auth/user/unplayermoderate", {
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

  deletePlayerModerations(params: Pick<ModerateUserRequest, "type">): Promise<{ json: Json<Success>; params: Pick<ModerateUserRequest, "type"> }> {
    return requestJson<Json<Success>>("auth/user/unplayermoderate", {
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
};

export { playerModerationRequest };
