import type { FriendStatus, GetFriends, LimitedUserFriend, Notification, Success, UserState } from "vrchat";
import type { Json } from "../types/vrcx";
import { queryClient } from "../queries/client";
import { request } from "../services/request";
import { useUserStore } from "../stores/user";
import { applyUser } from "../coordinators/user-coordinator";
import { watchState } from "../services/watch-state";

type FriendApiEntry = Json<LimitedUserFriend> & { state?: UserState };

function refetchActiveFriendListQueries() {
  queryClient
    .invalidateQueries({
      queryKey: ["friends"],
      refetchType: "active",
    })
    .catch((err: unknown) => {
      console.error("Failed to refresh friend list queries:", err);
    });
}

function isJsonObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isFriendApiEntries(value: unknown): value is FriendApiEntry[] {
  return Array.isArray(value) && value.every(isJsonObject);
}

function isSuccessBody(value: unknown): value is Json<Success> {
  return isJsonObject(value);
}

function isNotificationBody(value: unknown): value is Json<Notification> {
  return isJsonObject(value);
}

function isFriendStatusBody(value: unknown): value is Json<FriendStatus> {
  return isJsonObject(value);
}

function expectBody<T>(value: unknown, isBody: (candidate: unknown) => candidate is T, endpoint: string): T {
  if (!isBody(value)) {
    throw new TypeError(`${endpoint} returned a body that is not a JSON object`);
  }
  return value;
}

const friendRequest = {
  getFriends(params: GetFriends["query"]): Promise<{ json: FriendApiEntry[]; params: GetFriends["query"] }> {
    const userStore = useUserStore();
    return request("auth/user/friends", {
      method: "GET",
      params,
    }).then((body) => {
      const args = {
        json: expectBody(body, isFriendApiEntries, "auth/user/friends"),
        params,
      };
      for (const user of args.json) {
        if (!user.displayName) {
          console.error("/friends gave us garbage", user);
          continue;
        }

        if (!watchState.isFriendsLoaded) {
          for (const item of args.json) {
            if (userStore.currentUser.activeFriends.includes(item.id)) {
              item.state = "active";
            } else if (userStore.currentUser.onlineFriends.includes(item.id)) {
              item.state = "online";
            } else {
              item.state = "offline";
            }
          }
        }
        applyUser(user);
      }
      return args;
    });
  },

  sendFriendRequest(params: { userId: string }): Promise<{ json: Json<Notification>; params: { userId: string } }> {
    return request(`user/${params.userId}/friendRequest`, {
      method: "POST",
    }).then((body) => {
      const args = {
        json: expectBody(body, isNotificationBody, `user/${params.userId}/friendRequest`),
        params,
      };
      refetchActiveFriendListQueries();
      return args;
    });
  },

  cancelFriendRequest(params: { userId: string }): Promise<{ json: Json<Success>; params: { userId: string } }> {
    return request(`user/${params.userId}/friendRequest`, {
      method: "DELETE",
    }).then((body) => {
      const args = {
        json: expectBody(body, isSuccessBody, `user/${params.userId}/friendRequest`),
        params,
      };
      refetchActiveFriendListQueries();
      return args;
    });
  },

  deleteFriend(params: { userId: string }, customMsg?: string): Promise<{ json: Json<Success>; params: { userId: string } }> {
    return request(`auth/user/friends/${params.userId}`, {
      method: "DELETE",
      customMsg,
    }).then((body) => {
      const args = {
        json: expectBody(body, isSuccessBody, `auth/user/friends/${params.userId}`),
        params,
      };
      refetchActiveFriendListQueries();
      return args;
    });
  },

  getFriendStatus(params: { userId: string; currentUserId: string }): Promise<{ json: Json<FriendStatus>; params: { userId: string; currentUserId: string } }> {
    return request(`user/${params.userId}/friendStatus`, {
      method: "GET",
    }).then((body) => {
      const args = {
        json: expectBody(body, isFriendStatusBody, `user/${params.userId}/friendStatus`),
        params,
      };
      console.log("getFriendStatus", args);
      return args;
    });
  },

  deleteHiddenFriendRequest(
    params: { notificationId: string },
    userId: string
  ): Promise<{ json: Json<Success>; params: { notificationId: string }; userId: string }> {
    return request(`user/${userId}/friendRequest`, {
      method: "DELETE",
      params,
    }).then((body) => {
      const args = {
        json: expectBody(body, isSuccessBody, `user/${userId}/friendRequest`),
        params,
        userId,
      };
      return args;
    });
  },
};

export { friendRequest };
