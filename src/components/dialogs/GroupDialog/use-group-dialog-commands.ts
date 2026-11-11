import { copyToClipboard } from "../../../shared/utils/app-actions";

export function useGroupDialogCommands(
  groupDialog,
  {
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
  }
) {
  function buildCommandMap() {
    const D = () => groupDialog.value;

    return {
      Share: () => {
        copyToClipboard(`https://vrc.group/${D().ref.shortCode}.${D().ref.discriminator}`);
      },
      "Copy Group Name": () => {
        copyToClipboard(D().ref.name);
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
        setGroupVisibility(D().id, "visible");
      },
      "Visibility Friends": () => {
        setGroupVisibility(D().id, "friends");
      },
      "Visibility Hidden": () => {
        setGroupVisibility(D().id, "hidden");
      },
      "Subscribe To Announcements": () => {
        setGroupSubscription(D().id, true);
      },
      "Unsubscribe To Announcements": () => {
        setGroupSubscription(D().id, false);
      },
      "Subscribe To Event Announcements": () => {
        setGroupEventAnnouncements(D().id, true);
      },
      "Unsubscribe To Event Announcements": () => {
        setGroupEventAnnouncements(D().id, false);
      },

      "Block Group": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.block_group"),
          destructive: true,
        }),
        handler: (id) => {
          groupRequest.blockGroup({ groupId: id }).then((args) => {
            if (groupDialog.value.visible && groupDialog.value.id === args.params.groupId) {
              showGroupDialog(args.params.groupId);
            }
          });
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
            });
        },
      },
    };
  }

  const commandMap = buildCommandMap();

  function groupDialogCommand(command) {
    const D = groupDialog.value;
    if (D.visible === false) {
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
        .catch(() => {});
    }
  }

  return {
    groupDialogCommand,
  };
}
