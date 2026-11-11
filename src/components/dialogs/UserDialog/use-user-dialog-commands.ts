import { ref } from "vue";
import type { Ref } from "vue";
import type { ModerateUserRequest, InviteMessage, Notification, PlayerModeration } from "vrchat";

import { favoriteRequest } from "../../../api/favorite";
import { friendRequest } from "../../../api/friend";
import { notificationRequest } from "../../../api/notification";
import { playerModerationRequest } from "../../../api/player-moderation";
import { queryRequest } from "../../../api/query-request";
import { copyToClipboard } from "../../../shared/utils/app-actions";
import { parseLocation } from "../../../shared/utils/location-parser";
import { database } from "../../../services/database";
import { recordRecentAction } from "../../../composables/use-recent-actions";
import type { Json, VrcxUser } from "../../../types/vrcx";
import type { CurrentUserState, UserDialogState } from "../../../stores/user-state";
import type { LastLocation } from "../../../stores/location";
import type { GroupInviteDialogState } from "../../../stores/group-types";
import type { FriendLogHistoryRow } from "../../../stores/friend-types";

export type SendInviteParams = {
  instanceId?: string;
  worldId?: string;
  worldName?: string;
  platform?: string;
  messageSlot?: number;
  requestSlot?: number;
};

export type SendInviteDialogState = {
  messageSlot?: Partial<Json<InviteMessage>>;
  userId: string;
  params: SendInviteParams;
};

type Translate = (key: string, named?: Record<string, string>) => string;

type ToastFn = {
  (message: string): unknown;
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

type ConfirmDescriptor = {
  title: string;
  description: string;
  destructive?: boolean;
};

type ConfirmedCommand = {
  confirm: () => ConfirmDescriptor;
  handler: (userId: string) => void | Promise<void>;
};

type CommandEntry = string | (() => void) | ConfirmedCommand;

type UserDialogCommandsDeps = {
  t: Translate;
  toast: ToastFn;
  modalStore: {
    confirm: (options: ConfirmDescriptor) => Promise<{ ok: boolean }>;
  };
  currentUser: Ref<CurrentUserState>;
  cachedUsers: Map<string, VrcxUser>;
  friendLogTable: Ref<{ data: Partial<FriendLogHistoryRow>[] }>;
  lastLocation: Ref<LastLocation>;
  lastLocationDestination: Ref<string>;
  inviteGroupDialog: Ref<GroupInviteDialogState>;
  showUserDialog: (userId: string) => void;
  showFavoriteDialog: (type: string, objectId: string) => void;
  showAvatarDialog: (avatarId: string) => void;
  showAvatarAuthorDialog: (refUserId: string, ownerUserId: string, currentAvatarImageUrl: string) => Promise<void>;
  showModerateGroupDialog: (userId: string) => void;
  showSendBoopDialog: (userId: string) => void;
  showModerationReportDialog: (report: { type: "user"; contentId: string; contentName?: string }) => void;
  showGalleryPage: (tab?: unknown) => void;
  getFriendRequest: (userId: string) => string | undefined;
  handleFriendDelete: (args: { params: { userId: string } }) => void;
  applyPlayerModeration: (json: Json<PlayerModeration>) => { targetUserId: string; sourceUserId: string; type: string };
  handlePlayerModerationDelete: (args: { params: Pick<ModerateUserRequest, "type" | "moderated"> }) => void;
  refreshInviteMessageTableData: (mode: "message" | "request") => void;
  clearInviteImageUpload: () => void;
  instanceStore: {
    showPreviousInstancesListDialog: (variant: "user", targetRef: Partial<VrcxUser>) => Promise<void>;
  };
  useNotificationStore: () => {
    handleNotificationAccept: (args: { params: { notificationId: string } }) => void;
    handleNotificationHide: (notificationId: string) => void;
  };
  showEditProfileDialog: () => void;
};

function isSuccessResponse(json: object): boolean {
  return "success" in json && Boolean(json.success);
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 404;
}

function logRejection(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

export function useUserDialogCommands(userDialog: Ref<UserDialogState>, deps: UserDialogCommandsDeps) {
  const {
    t,
    toast,
    modalStore,
    currentUser,
    cachedUsers,
    friendLogTable,
    lastLocation,
    lastLocationDestination,
    inviteGroupDialog,
    showUserDialog,
    showFavoriteDialog,
    showAvatarDialog,
    showAvatarAuthorDialog,
    showModerateGroupDialog,
    showSendBoopDialog,
    showModerationReportDialog,
    showGalleryPage,
    getFriendRequest,
    handleFriendDelete,
    applyPlayerModeration,
    handlePlayerModerationDelete,
    refreshInviteMessageTableData,
    clearInviteImageUpload,
    instanceStore,
    useNotificationStore,
    showEditProfileDialog,
  } = deps;

  const sendInviteDialogVisible = ref(false);
  const sendInviteDialog = ref<SendInviteDialogState>({
    messageSlot: {},
    userId: "",
    params: {},
  });
  const sendInviteRequestDialogVisible = ref(false);

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

  function showSendInviteDialogFn(params: SendInviteParams, userId: string) {
    sendInviteDialog.value = {
      params,
      userId,
      messageSlot: {},
    };
    refreshInviteMessageTableData("message");
    clearInviteImageUpload();
    sendInviteDialogVisible.value = true;
  }

  function showSendInviteRequestDialogFn(params: SendInviteParams, userId: string) {
    sendInviteDialog.value = {
      params,
      userId,
      messageSlot: {},
    };
    refreshInviteMessageTableData("request");
    clearInviteImageUpload();
    sendInviteRequestDialogVisible.value = true;
  }

  function buildCommandMap(): Record<string, CommandEntry> {
    const D = () => userDialog.value;

    return {
      Refresh: () => {
        const userId = D().id;
        D().id = "";
        showUserDialog(userId);
      },
      "Copy Profile URL": () => {
        copyToClipboard(`https://vrchat.com/home/user/${D().id}`, t("message.user.url_copied"));
      },
      "Copy DisplayName": () => {
        copyToClipboard(D().ref.displayName ?? "", t("message.user.display_name_copied"));
      },
      "Copy UserId": () => {
        copyToClipboard(D().id, t("message.user.id_copied"));
      },
      "Add Favorite": () => {
        showFavoriteDialog("friend", D().id);
      },
      "Edit Profile": () => {
        showEditProfileDialog();
      },
      "Request Invite": () => {
        void notificationRequest
          .sendRequestInvite(
            {
              platform: "standalonewindows",
            },
            D().id
          )
          .then((args) => {
            toast(t("message.user.request_invite_sent"));
            recordRecentAction(D().id, "Request Invite");
            return args;
          })
          .catch(logRejection("Failed to request invite:"));
      },
      "Invite Message": () => {
        const L = parseLocation(lastLocation.value.location);
        void queryRequest
          .fetch("world", {
            worldId: L.worldId,
          })
          .then((args) => {
            showSendInviteDialogFn(
              {
                instanceId: lastLocation.value.location,
                worldId: lastLocation.value.location,
                worldName: args.ref.name,
              },
              D().id
            );
          })
          .catch(logRejection("Failed to load world for invite message:"));
      },
      "Request Invite Message": () => {
        showSendInviteRequestDialogFn(
          {
            platform: "standalonewindows",
          },
          D().id
        );
      },
      Invite: () => {
        let currentLocation = lastLocation.value.location;
        if (lastLocation.value.location === "traveling") {
          currentLocation = lastLocationDestination.value;
        }
        const L = parseLocation(currentLocation);
        void queryRequest
          .fetch("world", {
            worldId: L.worldId,
          })
          .then((args) => {
            void notificationRequest
              .sendInvite(
                {
                  instanceId: L.tag,
                  worldId: L.tag,
                  worldName: args.ref.name,
                },
                D().id
              )
              .then((_args) => {
                toast(t("message.invite.sent"));
                recordRecentAction(D().id, "Invite");
                return _args;
              })
              .catch(logRejection("Failed to send invite:"));
          })
          .catch(logRejection("Failed to load world for invite:"));
      },
      "Show Avatar Author": () => {
        const currentAvatarImageUrl = D().ref.currentAvatarImageUrl ?? "";
        void showAvatarAuthorDialog(D().id, D().$avatarInfo.ownerId, currentAvatarImageUrl).catch(logRejection("Failed to show avatar author:"));
      },
      "Show Fallback Avatar Details": () => {
        const { fallbackAvatar } = D().ref;
        if (fallbackAvatar) {
          showAvatarDialog(fallbackAvatar);
        } else {
          toast.error(t("message.user.no_fallback_avatar"));
        }
      },
      "Previous Instances": () => {
        void instanceStore.showPreviousInstancesListDialog("user", D().ref).catch(logRejection("Failed to show previous instances:"));
      },
      "Manage Gallery": () => {
        userDialog.value.visible = false;
        showGalleryPage();
      },
      "Invite To Group": () => {
        inviteGroupDialog.value.groupId = "";
        inviteGroupDialog.value.userId = D().id;
        inviteGroupDialog.value.visible = true;
      },
      "Send Boop": () => {
        showSendBoopDialog(D().id);
      },
      "Report User": () => {
        showModerationReportDialog({
          type: "user",
          contentId: D().id,
          contentName: D().ref.displayName ?? "",
        });
      },
      "Group Moderation": () => {
        showModerateGroupDialog(D().id);
      },
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
      "Edit Note Memo": "showEditNoteAndMemoDialog",

      "Delete Favorite": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.user.actions.delete_favorite"),
          }),
        }),
        handler: (userId) => {
          void favoriteRequest
            .deleteFavorite({
              objectId: userId,
            })
            .catch(logRejection("Failed to delete favorite:"));
        },
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

  const commandMap = buildCommandMap();

  let componentCallbacks: Partial<Record<string, () => void>> = {};

  function registerCallbacks(callbacks: Partial<Record<string, () => void>>) {
    componentCallbacks = callbacks;
  }

  function userDialogCommand(command: string) {
    const D = userDialog.value;
    if (!D.visible) {
      return;
    }

    const entry = commandMap[command];

    if (!entry) {
      return;
    }

    if (typeof entry === "string") {
      const cb = componentCallbacks[entry];
      if (cb) {
        cb();
      }
      return;
    }

    if (typeof entry === "function") {
      entry();
      return;
    }

    void modalStore
      .confirm(entry.confirm())
      .then(({ ok }) => (ok ? entry.handler(D.id) : undefined))
      .catch(logRejection("Failed to run user dialog command:"));
  }

  return {
    sendInviteDialogVisible,
    sendInviteDialog,
    sendInviteRequestDialogVisible,
    userDialogCommand,
    registerCallbacks,
  };
}
