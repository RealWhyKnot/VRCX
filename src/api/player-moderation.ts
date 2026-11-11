import type { ModerateUserRequest, PlayerModeration, Success } from "vrchat";
import type { Json } from "../types/vrcx";
import { request } from "../services/request";
import { requestJson, requestAck } from "./request-json";

export type InstanceModerationType = "warn" | "kick";

const playerModerationRequest = {
  moderateInstanceUser(params: { userId: string; type: InstanceModerationType; reason: string; worldId: string; instanceId: string }): Promise<unknown> {
    const { userId, ...body } = params;
    return request(`user/${userId}/moderations`, {
      method: "POST",
      params: body,
    });
  },

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

  deletePlayerModeration(params: ModerateUserRequest): Promise<{ json: Json<Success> | undefined; params: ModerateUserRequest }> {
    return requestAck<Json<Success>>("auth/user/unplayermoderate", {
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

  deletePlayerModerations(params: Pick<ModerateUserRequest, "type">): Promise<{ json: Json<Success> | undefined; params: Pick<ModerateUserRequest, "type"> }> {
    return requestAck<Json<Success>>("auth/user/unplayermoderate", {
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
