import { nextTick, ref } from "vue";
import type { Ref } from "vue";
import { toast } from "vue-sonner";
import type { GroupUserVisibility } from "vrchat";

import { useOptionKeySelect } from "../../../composables/use-option-key-select";
import { leaveGroup, setGroupVisibility, updateInGameGroupOrder } from "../../../coordinators/group-membership-coordinator";
import type { useGroupStore } from "../../../stores/group";
import { logError } from "../../../stores/notification/errors";
import type { useUserStore } from "../../../stores/user";
import type { UserDialogGroup, UserSorting } from "../../../stores/user-state";
import { compareByMemberCount, compareByName } from "../../../shared/utils/compare";
import { userDialogGroupSortingOptions } from "../../../shared/constants/user";
import { moveGroupInOrder, normalizeGroupOrder } from "../../../shared/utils/group-order";
import type { VrcxGroup } from "../../../types/vrcx";

type UserDialogGroupEditingDeps = {
  userDialog: Ref<ReturnType<typeof useUserStore>["userDialog"]>;
  currentUser: Ref<ReturnType<typeof useUserStore>["currentUser"]>;
  currentUserGroups: Ref<ReturnType<typeof useGroupStore>["currentUserGroups"]>;
  inGameGroupOrder: Ref<ReturnType<typeof useGroupStore>["inGameGroupOrder"]>;
};

export function useUserDialogGroupEditing({ userDialog, currentUser, currentUserGroups, inGameGroupOrder }: UserDialogGroupEditingDeps) {
  const userDialogGroupEditMode = ref(false);
  const userDialogGroupEditGroups = ref<VrcxGroup[]>([]);
  const userDialogGroupAllSelected = ref(false);
  const userDialogGroupEditSelectedGroupIds = ref<string[]>([]);

  const { selectedKey: userDialogGroupSortingKey, selectByKey: setUserDialogGroupSortingByKey } = useOptionKeySelect(
    userDialogGroupSortingOptions,
    () => userDialog.value.groupSorting,
    setUserDialogGroupSorting
  );

  function selectUserDialogGroupSorting(value: unknown) {
    if (typeof value === "string") {
      setUserDialogGroupSortingByKey(value);
    }
  }

  function setUserDialogGroupSorting(sortOrder: UserSorting) {
    const D = userDialog.value;
    if (D.groupSorting.value === sortOrder.value) {
      return;
    }
    D.groupSorting = sortOrder;
    sortCurrentUserGroups().catch(logError);
  }

  const groupUserVisibilityValues = ["visible", "friends", "hidden"] as const satisfies readonly GroupUserVisibility[];

  function toGroupUserVisibility(value: unknown): GroupUserVisibility | undefined {
    return groupUserVisibilityValues.find((option) => option === value);
  }

  function sortGroupsByInGame(a: UserDialogGroup, b: UserDialogGroup) {
    const aIndex = inGameGroupOrder.value.indexOf(a.id ?? "");
    const bIndex = inGameGroupOrder.value.indexOf(b.id ?? "");
    if (aIndex === -1 && bIndex === -1) {
      return 0;
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  }

  async function sortCurrentUserGroups() {
    const D = userDialog.value;

    let sortMethod: (a: UserDialogGroup, b: UserDialogGroup) => number = () => 0;

    switch (D.groupSorting.value) {
      case "alphabetical":
        sortMethod = compareByName;
        break;
      case "members":
        sortMethod = compareByMemberCount;
        break;
      case "inGame":
        sortMethod = sortGroupsByInGame;
        await updateInGameGroupOrder();
        break;
    }

    userDialog.value.userGroups.ownGroups.sort(sortMethod);
    userDialog.value.userGroups.mutualGroups.sort(sortMethod);
    userDialog.value.userGroups.remainingGroups.sort(sortMethod);
  }

  async function exitEditModeCurrentUserGroups() {
    userDialogGroupEditMode.value = false;
    userDialogGroupEditGroups.value = [];
    userDialogGroupEditSelectedGroupIds.value = [];
    userDialogGroupAllSelected.value = false;
    await sortCurrentUserGroups();
  }

  async function editModeCurrentUserGroups() {
    await updateInGameGroupOrder();
    userDialogGroupEditGroups.value = Array.from(currentUserGroups.value.values());
    inGameGroupOrder.value = normalizeGroupOrder(
      inGameGroupOrder.value,
      userDialogGroupEditGroups.value.map((group) => group.id ?? "")
    );
    userDialogGroupEditGroups.value.sort(sortGroupsByInGame);
    userDialogGroupEditMode.value = true;
  }

  async function saveInGameGroupOrder() {
    userDialogGroupEditGroups.value.sort(sortGroupsByInGame);
    try {
      await window.AppApi.SetVRChatRegistryKey(`VRC_GROUP_ORDER_${currentUser.value.id}`, JSON.stringify(inGameGroupOrder.value), 3);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save in-game group order");
    }
  }

  function selectAllGroups() {
    const isAllSelected = userDialogGroupEditSelectedGroupIds.value.length === userDialogGroupEditGroups.value.length;

    userDialogGroupEditSelectedGroupIds.value = isAllSelected ? [] : userDialogGroupEditGroups.value.map((g) => g.id ?? "");
    userDialogGroupAllSelected.value = !isAllSelected;

    userDialogGroupEditMode.value = false;
    nextTick(() => {
      userDialogGroupEditMode.value = true;
    }).catch(logError);
  }

  const bulkGroupActionValue = ref("");

  function handleBulkGroupAction(value: unknown) {
    if (typeof value !== "string") {
      return;
    }
    bulkGroupActionValue.value = value;

    if (value === "leave") {
      bulkLeaveGroups();
    } else if (value.startsWith("visibility:")) {
      const newVisibility = toGroupUserVisibility(value.slice("visibility:".length));
      bulkSetVisibility(newVisibility);
    }

    nextTick(() => {
      bulkGroupActionValue.value = "";
    }).catch(logError);
  }

  function bulkSetVisibility(newVisibility: GroupUserVisibility | undefined) {
    if (!newVisibility) {
      return;
    }
    for (const groupId of userDialogGroupEditSelectedGroupIds.value) {
      setGroupVisibility(groupId, newVisibility).catch(logError);
    }
  }

  function selectGroupVisibility(groupId: string, value: unknown) {
    const visibility = toGroupUserVisibility(value);
    if (visibility) {
      setGroupVisibility(groupId, visibility).catch(logError);
    }
  }

  function bulkLeaveGroups() {
    for (const groupId of userDialogGroupEditSelectedGroupIds.value) {
      leaveGroup(groupId).catch(logError);
    }
  }

  function toggleGroupSelection(groupId: string) {
    const index = userDialogGroupEditSelectedGroupIds.value.indexOf(groupId);
    if (index === -1) {
      userDialogGroupEditSelectedGroupIds.value.push(groupId);
    } else {
      userDialogGroupEditSelectedGroupIds.value.splice(index, 1);
    }
  }

  function moveGroupUp(groupId: string) {
    const index = inGameGroupOrder.value.indexOf(groupId);
    if (moveGroupInOrder(inGameGroupOrder.value, groupId, index - 1)) {
      saveInGameGroupOrder().catch(logError);
    }
  }

  function moveGroupDown(groupId: string) {
    const index = inGameGroupOrder.value.indexOf(groupId);
    if (moveGroupInOrder(inGameGroupOrder.value, groupId, index + 1)) {
      saveInGameGroupOrder().catch(logError);
    }
  }

  function moveGroupTop(groupId: string) {
    if (moveGroupInOrder(inGameGroupOrder.value, groupId, 0)) {
      saveInGameGroupOrder().catch(logError);
    }
  }

  function moveGroupBottom(groupId: string) {
    if (moveGroupInOrder(inGameGroupOrder.value, groupId, inGameGroupOrder.value.length - 1)) {
      saveInGameGroupOrder().catch(logError);
    }
  }

  return {
    userDialogGroupEditMode,
    userDialogGroupEditGroups,
    userDialogGroupAllSelected,
    userDialogGroupEditSelectedGroupIds,
    userDialogGroupSortingKey,
    selectUserDialogGroupSorting,
    sortCurrentUserGroups,
    exitEditModeCurrentUserGroups,
    editModeCurrentUserGroups,
    selectAllGroups,
    bulkGroupActionValue,
    handleBulkGroupAction,
    selectGroupVisibility,
    toggleGroupSelection,
    moveGroupUp,
    moveGroupDown,
    moveGroupTop,
    moveGroupBottom,
  };
}
