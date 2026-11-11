import type { Ref } from "vue";
import { toast } from "vue-sonner";
import { groupRequest } from "../../../api/group";
import { getGroupDialogGroup } from "../../../coordinators/group-dialog-coordinator";
import { queryKeys } from "../../../queries/keys";
import { refetchActiveEntityQuery } from "../../../queries/entity-cache";
import type { GroupDialogState } from "../../../stores/group-types";

type GroupMembershipActionsDeps = {
  t: (key: string) => string;
  groupDialog: Ref<GroupDialogState>;
  currentUser: Ref<{ id: string }>;
};

export function useGroupMembershipActions({ t, groupDialog, currentUser }: GroupMembershipActionsDeps) {
  function updateGroupDialogData(obj: Partial<GroupDialogState>) {
    groupDialog.value = {
      ...groupDialog.value,
      ...obj,
    };
  }

  function setGroupRepresentation(groupId: string) {
    handleGroupRepresentationChange(groupId, true);
  }

  function clearGroupRepresentation(groupId: string) {
    handleGroupRepresentationChange(groupId, false);
  }

  function handleGroupRepresentationChange(groupId: string, isSet: boolean) {
    groupRequest
      .setGroupRepresentation(groupId, {
        isRepresenting: isSet,
      })
      .then((args) => {
        if (groupDialog.value.visible && groupDialog.value.id === args.groupId) {
          updateGroupDialogData({
            ...groupDialog.value,
            ref: { ...groupDialog.value.ref, isRepresenting: args.params.isRepresenting },
          });
        }
        refetchActiveEntityQuery(queryKeys.representedGroup(currentUser.value.id)).catch(console.error);
      })
      .catch(console.error);
  }

  function cancelGroupRequest(id: string) {
    groupRequest
      .cancelGroupRequest({
        groupId: id,
      })
      .then(() => {
        if (groupDialog.value.visible && groupDialog.value.id === id) {
          getGroupDialogGroup(id).catch(console.error);
        }
      })
      .catch(console.error);
  }

  function joinGroup(id: string) {
    if (!id) {
      return null;
    }
    return groupRequest
      .joinGroup({
        groupId: id,
      })
      .then((args) => {
        if (groupDialog.value.visible && groupDialog.value.id === id) {
          updateGroupDialogData({
            ...groupDialog.value,
            inGroup: args.json.membershipStatus === "member",
          });
          getGroupDialogGroup(id).catch(console.error);
        }
        if (args.json.membershipStatus === "member") {
          toast.success(t("message.group.joined"));
        } else if (args.json.membershipStatus === "requested") {
          toast.success(t("message.group.join_request_sent"));
        }
        return args;
      });
  }

  return { setGroupRepresentation, clearGroupRepresentation, cancelGroupRequest, joinGroup };
}
