import type {
  AccountStanding,
  ChangeUserTagsRequest,
  CurrentUser,
  Feedback,
  GetMutualFriends,
  GetMutualGroups,
  GetUserNotes,
  LimitedUserGroups,
  LimitedUserSearch,
  MutualFriend,
  Mutuals,
  PrivateProfile,
  PublicProfile,
  SearchUsers,
  UpdateProfileRequest,
  UpdateUserClientConfigRequest,
  UpdateUserRequest,
  User,
  UserClientConfig,
  UserNote,
} from "vrchat";
import type { Json, VrcxUser } from "../types/vrcx";
import type { CurrentUserState } from "../stores/user-state";
import { patchAndRefetchActiveQuery } from "../queries/entity-cache";
import { queryKeys } from "../queries/keys";
import { request } from "../services/request";
import { useUserStore } from "../stores/user";
import { applyCurrentUser } from "../coordinators/current-user-apply";
import { applyUser, applyPublicProfile } from "../coordinators/user-profile-apply";
import { requestJson } from "./request-json";

type UserResponse = Json<User> & { $lastFetch?: number };

function getCurrentUserId(): string {
  return useUserStore().currentUser.id;
}

function hasProfileId<T extends { id?: string }>(profile: T): profile is T & { id: string } {
  return Boolean(profile.id);
}

function isUserResponse(value: unknown): value is UserResponse {
  return typeof value === "object" && value !== null;
}

const userRequest = {
  getUser(params: { userId: string }): Promise<{ json: Json<User>; ref: VrcxUser; params: { userId: string } }> {
    return request(`users/${params.userId}`, {
      method: "GET",
    }).then((response) => {
      if (!isUserResponse(response)) {
        throw new Error(`getUser missing user data for: ${params.userId}`);
      }
      const json = response;
      json.$lastFetch = Date.now();
      const args = {
        json,
        params,
        ref: applyUser(json),
      };
      return args;
    });
  },

  getUsers(params: SearchUsers["query"]): Promise<{ json: Json<LimitedUserSearch[]>; params: SearchUsers["query"] }> {
    return requestJson<Json<LimitedUserSearch[]>>("users", {
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

  addUserTags(params: ChangeUserTagsRequest): Promise<{ json: Json<CurrentUser>; params: ChangeUserTagsRequest }> {
    return requestJson<Json<CurrentUser>>(`users/${getCurrentUserId()}/addTags`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      applyCurrentUser(json);
      return args;
    });
  },

  removeUserTags(params: ChangeUserTagsRequest): Promise<{ json: Json<CurrentUser>; params: ChangeUserTagsRequest }> {
    return requestJson<Json<CurrentUser>>(`users/${getCurrentUserId()}/removeTags`, {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      applyCurrentUser(json);
      return args;
    });
  },

  getUserFeedback(params: { userId: string }): Promise<{ json: Json<Feedback[]>; params: { userId: string } }> {
    return requestJson<Json<Feedback[]>>(`users/${params.userId}/feedback`, {
      method: "GET",
      params: {
        n: 100,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  saveCurrentUser(params: UpdateUserRequest): Promise<{ json: Json<CurrentUser>; ref: CurrentUserState; params: UpdateUserRequest }> {
    return requestJson<Json<CurrentUser>>(`users/${getCurrentUserId()}`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
        ref: applyCurrentUser(json),
      };
      patchAndRefetchActiveQuery({
        queryKey: queryKeys.user(args.ref.id),
        nextData: args,
      }).catch((err: unknown) => {
        console.error("Failed to refresh user query after mutation:", err);
      });
      return args;
    });
  },

  getUserNotes(params: GetUserNotes["query"]): Promise<{ json: Json<UserNote[]>; params: GetUserNotes["query"] }> {
    return requestJson<Json<UserNote[]>>(`userNotes`, {
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

  getMutualCounts(params: { userId: string }): Promise<{ json: Json<Mutuals>; params: { userId: string } }> {
    return requestJson<Json<Mutuals>>(`users/${params.userId}/mutuals`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getMutualFriends(
    params: GetMutualFriends["path"] & GetMutualFriends["query"]
  ): Promise<{ json: Json<MutualFriend[]>; params: GetMutualFriends["path"] & GetMutualFriends["query"] }> {
    return requestJson<Json<MutualFriend[]>>(`users/${params.userId}/mutuals/friends`, {
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

  getMutualGroups(
    params: GetMutualGroups["path"] & GetMutualGroups["query"]
  ): Promise<{ json: Json<LimitedUserGroups[]>; params: GetMutualGroups["path"] & GetMutualGroups["query"] }> {
    return requestJson<Json<LimitedUserGroups[]>>(`users/${params.userId}/mutuals/groups`, {
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

  getPublicProfile(params: { userId: string }): Promise<{
    json: Json<PublicProfile>;
    params: { userId: string };
    ref: Json<PublicProfile> & { $lastFetch?: number };
  }> {
    return requestJson<Json<PublicProfile> & { $lastFetch?: number }>(`profile/${params.userId}`, {
      method: "GET",
    }).then((json) => {
      if (!hasProfileId(json)) {
        throw new Error(`getPublicProfile missing user id for: ${params.userId}`);
      }
      json.$lastFetch = Date.now();
      const args = {
        json,
        params,
        ref: applyPublicProfile(json),
      };
      return args;
    });
  },

  getPrivateProfile(params: { userId: string }): Promise<{ json: Json<PrivateProfile>; params: { userId: string } }> {
    return requestJson<Json<PrivateProfile>>(`profile/${params.userId}/private`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getClientConfig(): Promise<{ json: Json<UserClientConfig> }> {
    return requestJson<Json<UserClientConfig>>(`users/${getCurrentUserId()}/clientConfig`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  saveClientConfig(params: UpdateUserClientConfigRequest): Promise<{ json: Json<UserClientConfig>; params: UpdateUserClientConfigRequest }> {
    return requestJson<Json<UserClientConfig>>(`users/${getCurrentUserId()}/clientConfig`, {
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

  getAccountStanding(): Promise<{ json: AccountStanding }> {
    return requestJson<AccountStanding>("auth/user/accountStanding", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  getSelfProfile(): Promise<{ json: Json<PublicProfile>; params: Record<string, never> }> {
    return requestJson<Json<PublicProfile>>(`profile/${getCurrentUserId()}`, {
      method: "GET",
      params: {
        asSelf: true,
      },
    }).then((json) => {
      const args = {
        json,
        params: {},
      };
      return args;
    });
  },

  saveProfile(params: UpdateProfileRequest): Promise<{ json: Json<PublicProfile>; params: UpdateProfileRequest }> {
    return requestJson<Json<PublicProfile>>(`profile/${getCurrentUserId()}`, {
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

  saveProfileTheme(params: { buttonColor: string; iconColor: string; themeId: string; name: string; subtextColor: string }) {
    return request(`profile/theme/${params.themeId}`, {
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

  createProfileTheme(params: { buttonColor?: string; iconColor?: string; name: string; subtextColor?: string }) {
    return request(`profile/theme`, {
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

  deleteProfileTheme(params: { id: string }) {
    return request(`profile/theme/${params.id}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
};

export { userRequest };
