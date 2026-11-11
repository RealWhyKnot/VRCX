import type { Ref } from "vue";
import type { ModerateUserRequest, Notification, PlayerModeration } from "vrchat";

import { friendRequest } from "../../../api/friend";
import { notificationRequest } from "../../../api/notification";
import { playerModerationRequest } from "../../../api/player-moderation";
import { recordRecentAction } from "../../../composables/use-recent-actions";
import { database } from "../../../services/database";
import type { FriendLogHistoryRow } from "../../../stores/friend-types";
import type { CurrentUserState, UserDialogState } from "../../../stores/user-state";
import type { Json, VrcxUser } from "../../../types/vrcx";
import { isNotFoundError, logRejection } from "./user-dialog-command-errors";
import type { CommandEntry, ToastFn, Translate } from "./user-dialog-command-types";

type RelationshipDeps = {
  t: Translate;
  toast: ToastFn;
  userDialog: Ref<UserDialogState>;
  currentUser: Ref<CurrentUserState>;
  cachedUsers: Map<string, VrcxUser>;
  friendLogTable: Ref<{ data: Partial<FriendLogHistoryRow>[] }>;
  applyPlayerModeration: (json: Json<PlayerModeration>) => { targetUserId: string; sourceUserId: string; type: string };
  getFriendRequest: (userId: string) => string | undefined;
  handleFriendDelete: (args: { params: { userId: string } }) => void;
  handlePlayerModerationDelete: (args: { params: Pick<ModerateUserRequest, "type" | "moderated"> }) => void;
  useNotificationStore: () => {
    handleNotificationAccept: (args: { params: { notificationId: string } }) => void;
    handleNotificationHide: (notificationId: string) => void;
  };
};

function isSuccessResponse(json: object): boolean {
  return "success" in json && Boolean(json.success);
}

export function buildUserDialogRelationshipCommands({
  t,
  toast,
  userDialog,
  currentUser,
  cachedUsers,
  friendLogTable,
  applyPlayerModeration,
  getFriendRequest,
  handleFriendDelete,
  handlePlayerModerationDelete,
  useNotificationStore,
}: RelationshipDeps): Record<string, CommandEntry> {
  const D = () => userDialog.value;

  function handleSendFriendRequest(args: { json: Json<Notification>; params: { userId: string } }) {
    const cachedUser = cachedUsers.get(args.params.userId);
    if (typeof cachedUser === "undefined") {
      return;
    }
    const friendLogHistory = {
      created_at: new Date().toJSON(),
      type: "FriendRequest",
      userId: cachedUser.id,
      displayName: cachedUser.displayName,
    };
    friendLogTable.value.data.push(friendLogHistory);
    database.addFriendLogHistory(friendLogHistory);

    const D = userDialog.value;
    if (!D.visible || D.id !== args.params.userId) {
      return;
    }
    if (isSuccessResponse(args.json)) {
      D.isFriend = true;
    } else {
      D.outgoingRequest = true;
    }
  }

  function handleCancelFriendRequest(args: { params: { userId: string } }) {
    const cachedUser = cachedUsers.get(args.params.userId);
    if (typeof cachedUser === "undefined") {
      return;
    }
    const friendLogHistory = {
      created_at: new Date().toJSON(),
      type: "CancelFriendRequest",
      userId: cachedUser.id,
      displayName: cachedUser.displayName,
    };
    friendLogTable.value.data.push(friendLogHistory);
    database.addFriendLogHistory(friendLogHistory);
    const D = userDialog.value;
    if (!D.visible || D.id !== args.params.userId) {
      return;
    }
    D.outgoingRequest = false;
  }

  function handleSendPlayerModeration(args: { json: Json<PlayerModeration> }) {
    const moderation = applyPlayerModeration(args.json);
    const D = userDialog.value;
    if (!D.visible || (moderation.targetUserId !== D.id && moderation.sourceUserId !== currentUser.value.id)) {
      return;
    }
    if (moderation.type === "block") {
      D.isBlock = true;
    } else if (moderation.type === "mute") {
      D.isMute = true;
    } else if (moderation.type === "interactOff") {
      D.isInteractOff = true;
    } else if (moderation.type === "muteChat") {
      D.isMuteChat = true;
    }
    toast.success(t("message.user.moderated"));
  }

  function setPlayerModeration(userId: string, type: number) {
    const D = userDialog.value;
    void AppApi.SetVRChatUserModeration(currentUser.value.id, userId, type)
      .then((isUpdated) => {
        if (isUpdated) {
          if (type === 4) {
            D.isShowAvatar = false;
            D.isHideAvatar = true;
          } else if (type === 5) {
            D.isShowAvatar = true;
            D.isHideAvatar = false;
          } else {
            D.isShowAvatar = false;
            D.isHideAvatar = false;
          }
        } else {
          toast.error(t("message.avatar.change_moderation_failed"));
        }
      })
      .catch(logRejection("Failed to set player moderation:"));
  }

  return {
    "Hide Avatar": () => {
      if (D().isHideAvatar) {
        setPlayerModeration(D().id, 0);
      } else {
        setPlayerModeration(D().id, 4);
      }
    },
    "Show Avatar": () => {
      if (D().isShowAvatar) {
        setPlayerModeration(D().id, 0);
      } else {
        setPlayerModeration(D().id, 5);
      }
    },
    "Accept Friend Request": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.accept_friend_request"),
        }),
      }),
      handler: async (userId) => {
        const key = getFriendRequest(userId);
        if (key === "") {
          const args = await friendRequest.sendFriendRequest({
            userId,
          });
          handleSendFriendRequest(args);
        } else if (typeof key === "string") {
          void notificationRequest
            .acceptFriendRequestNotification({
              notificationId: key,
            })
            .then((args) => {
              useNotificationStore().handleNotificationAccept(args);
            })
            .catch((err: unknown) => {
              if (isNotFoundError(err)) {
                useNotificationStore().handleNotificationHide(key);
              }
            });
        }
      },
    },
    "Decline Friend Request": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.decline_friend_request"),
        }),
      }),
      handler: async (userId) => {
        const key = getFriendRequest(userId);
        if (key === "") {
          const args = await friendRequest.cancelFriendRequest({
            userId,
          });
          handleCancelFriendRequest(args);
        } else if (typeof key === "string") {
          void notificationRequest
            .hideNotification({
              notificationId: key,
            })
            .then(() => {
              useNotificationStore().handleNotificationHide(key);
            })
            .catch(logRejection("Failed to decline friend request:"));
        }
      },
    },
    "Cancel Friend Request": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.cancel_friend_request"),
        }),
      }),
      handler: async (userId) => {
        const args = await friendRequest.cancelFriendRequest({
          userId,
        });
        handleCancelFriendRequest(args);
      },
    },
    "Send Friend Request": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.send_friend_request"),
        }),
      }),
      handler: async (userId) => {
        const args = await friendRequest.sendFriendRequest({
          userId,
        });
        handleSendFriendRequest(args);
        recordRecentAction(userId, "Send Friend Request");
      },
    },
    "Moderation Unblock": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_unblock"),
        }),
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.deletePlayerModeration({
          moderated: userId,
          type: "block",
        });
        handlePlayerModerationDelete(args);
      },
    },
    "Moderation Block": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_block"),
        }),
        destructive: true,
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.sendPlayerModeration({
          moderated: userId,
          type: "block",
        });
        handleSendPlayerModeration(args);
      },
    },
    "Moderation Unmute": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_unmute"),
        }),
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.deletePlayerModeration({
          moderated: userId,
          type: "mute",
        });
        handlePlayerModerationDelete(args);
      },
    },
    "Moderation Mute": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_mute"),
        }),
        destructive: true,
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.sendPlayerModeration({
          moderated: userId,
          type: "mute",
        });
        handleSendPlayerModeration(args);
      },
    },
    "Moderation Enable Avatar Interaction": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_enable_avatar_interaction"),
        }),
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.deletePlayerModeration({
          moderated: userId,
          type: "interactOff",
        });
        handlePlayerModerationDelete(args);
      },
    },
    "Moderation Disable Avatar Interaction": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_disable_avatar_interaction"),
        }),
        destructive: true,
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.sendPlayerModeration({
          moderated: userId,
          type: "interactOff",
        });
        handleSendPlayerModeration(args);
      },
    },
    "Moderation Enable Chatbox": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_enable_chatbox"),
        }),
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.deletePlayerModeration({
          moderated: userId,
          type: "muteChat",
        });
        handlePlayerModerationDelete(args);
      },
    },
    "Moderation Disable Chatbox": {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.moderation_disable_chatbox"),
        }),
        destructive: true,
      }),
      handler: async (userId) => {
        const args = await playerModerationRequest.sendPlayerModeration({
          moderated: userId,
          type: "muteChat",
        });
        handleSendPlayerModeration(args);
      },
    },
    Unfriend: {
      confirm: () => ({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t("dialog.user.actions.unfriend"),
        }),
        destructive: true,
      }),
      handler: async (userId) => {
        const args = await friendRequest.deleteFriend(
          {
            userId,
          },
          t("dialog.user.actions.unfriend_success_msg")
        );
        handleFriendDelete(args);
      },
    },
  };
}
