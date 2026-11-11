import { ref } from "vue";
import type { Ref } from "vue";
import type { ModerateUserRequest, InviteMessage, PlayerModeration } from "vrchat";

import { favoriteRequest } from "../../../api/favorite";
import { notificationRequest } from "../../../api/notification";
import { queryRequest } from "../../../api/query-request";
import { copyToClipboard } from "../../../shared/utils/app-actions";
import { parseLocation } from "../../../shared/utils/location-parser";
import { recordRecentAction } from "../../../composables/use-recent-actions";
import type { Json, VrcxUser } from "../../../types/vrcx";
import type { CurrentUserState, UserDialogState } from "../../../stores/user-state";
import type { LastLocation } from "../../../stores/location";
import type { GroupInviteDialogState } from "../../../stores/group-types";
import type { FriendLogHistoryRow } from "../../../stores/friend-types";
import { logRejection } from "./user-dialog-command-errors";
import { buildUserDialogRelationshipCommands } from "./build-user-dialog-relationship-commands";
import type { CommandEntry, ConfirmDescriptor, ToastFn, Translate } from "./user-dialog-command-types";

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
    };
  }

  const commandMap = new Map<string, CommandEntry>([
    ...Object.entries(buildCommandMap()),
    ...Object.entries(
      buildUserDialogRelationshipCommands({
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
      })
    ),
  ]);

  let componentCallbacks: Partial<Record<string, () => void>> = {};

  function registerCallbacks(callbacks: Partial<Record<string, () => void>>) {
    componentCallbacks = callbacks;
  }

  function userDialogCommand(command: string) {
    const D = userDialog.value;
    if (!D.visible) {
      return;
    }

    const entry = commandMap.get(command);

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
