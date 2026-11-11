import type { Ref } from "vue";
import { copyToClipboard } from "../../../shared/utils/app-actions";
import type { GroupDialogState, GroupPostEntry } from "../../../stores/group-types";

type GroupVisibility = "friends" | "hidden" | "visible";

type ConfirmOptions = { title: string; description: string; destructive?: boolean };

type CommandEntry =
  | (() => void)
  | {
      confirm?: () => ConfirmOptions;
      handler: (id: string) => void;
    };

type GroupDialogCommandsDeps = {
  t: (key: string) => string;
  modalStore: { confirm: (options: ConfirmOptions) => Promise<{ ok: boolean }> };
  currentUser: Ref<{ id: string }>;
  showGroupDialog: (groupId: string, options?: { forceRefresh?: boolean }) => void;
  leaveGroupPrompt: (groupId: string) => void;
  setGroupVisibility: (groupId: string, visibility: GroupVisibility) => Promise<unknown>;
  setGroupSubscription: (groupId: string, isSubscribed: boolean) => Promise<unknown>;
  setGroupEventAnnouncements: (groupId: string, isSubscribed: boolean) => Promise<unknown>;
  showPreviousInstancesListDialog: (groupRef: GroupDialogState["ref"]) => void;
  showGroupMemberModerationDialog: (groupId: string) => void;
  showGroupRolesDialog: (groupId: string) => void;
  showInviteGroupDialog: (groupId: string, userId: string) => void;
  showGroupTransferDialog: (groupId: string, groupName: string | undefined, ownerId: string | undefined) => void;
  showGroupPostEditDialog: (groupId: string, post: GroupPostEntry | null) => void;
  groupRequest: {
    blockGroup: (params: { groupId: string }) => Promise<{ params: { groupId: string } }>;
    unblockGroup: (params: { groupId: string; userId: string }) => Promise<{ params: { groupId: string } }>;
  };
};

export function useGroupDialogCommands(groupDialog: Ref<Pick<GroupDialogState, "visible" | "id" | "ref">>, deps: GroupDialogCommandsDeps) {
  const {
    t,
    modalStore,
    currentUser,
    showGroupDialog,
    leaveGroupPrompt,
    setGroupVisibility,
    setGroupSubscription,
    setGroupEventAnnouncements,
    showPreviousInstancesListDialog,
    showGroupMemberModerationDialog,
    showGroupRolesDialog,
    showInviteGroupDialog,
    showGroupTransferDialog,
    showGroupPostEditDialog,
    groupRequest,
  } = deps;

  function buildCommandMap(): Record<string, CommandEntry> {
    const D = () => groupDialog.value;

    return {
      Share: () => {
        copyToClipboard(`https://vrc.group/${D().ref.shortCode}.${D().ref.discriminator}`);
      },
      "Copy Group Name": () => {
        copyToClipboard(D().ref.name ?? "");
      },
      "Copy Group ID": () => {
        copyToClipboard(D().id);
      },
      "Create Post": () => {
        showGroupPostEditDialog(D().id, null);
      },
      "Moderation Tools": () => {
        showGroupMemberModerationDialog(D().id);
      },
      "Manage Roles": () => {
        showGroupRolesDialog(D().id);
      },
      "Invite To Group": () => {
        showInviteGroupDialog(D().id, "");
      },
      "Transfer Group": () => {
        showGroupTransferDialog(D().id, D().ref.name, D().ref.ownerId);
      },
      Refresh: () => {
        showGroupDialog(D().id, { forceRefresh: true });
      },
      "Previous Instances": () => {
        showPreviousInstancesListDialog(D().ref);
      },
      "Leave Group": () => {
        leaveGroupPrompt(D().id);
      },
      "Visibility Everyone": () => {
        setGroupVisibility(D().id, "visible").catch(console.error);
      },
      "Visibility Friends": () => {
        setGroupVisibility(D().id, "friends").catch(console.error);
      },
      "Visibility Hidden": () => {
        setGroupVisibility(D().id, "hidden").catch(console.error);
      },
      "Subscribe To Announcements": () => {
        setGroupSubscription(D().id, true).catch(console.error);
      },
      "Unsubscribe To Announcements": () => {
        setGroupSubscription(D().id, false).catch(console.error);
      },
      "Subscribe To Event Announcements": () => {
        setGroupEventAnnouncements(D().id, true).catch(console.error);
      },
      "Unsubscribe To Event Announcements": () => {
        setGroupEventAnnouncements(D().id, false).catch(console.error);
      },

      "Block Group": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.block_group"),
          destructive: true,
        }),
        handler: (id) => {
          groupRequest
            .blockGroup({ groupId: id })
            .then((args) => {
              if (groupDialog.value.visible && groupDialog.value.id === args.params.groupId) {
                showGroupDialog(args.params.groupId);
              }
            })
            .catch(console.error);
        },
      },
      "Unblock Group": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.unblock_group"),
        }),
        handler: (id) => {
          groupRequest
            .unblockGroup({
              groupId: id,
              userId: currentUser.value.id,
            })
            .then((args) => {
              if (groupDialog.value.visible && groupDialog.value.id === args.params.groupId) {
                showGroupDialog(args.params.groupId);
              }
            })
            .catch(console.error);
        },
      },
    };
  }

  const commandMap = buildCommandMap();

  function groupDialogCommand(command: string) {
    const D = groupDialog.value;
    if (!D.visible) {
      return;
    }

    const entry = commandMap[command];

    if (!entry) {
      return;
    }

    if (typeof entry === "function") {
      entry();
      return;
    }

    if (entry.confirm) {
      modalStore
        .confirm(entry.confirm())
        .then(({ ok }) => {
          if (ok) {
            entry.handler(D.id);
          }
        })
        .catch(console.error);
    }
  }

  return {
    groupDialogCommand,
  };
}
