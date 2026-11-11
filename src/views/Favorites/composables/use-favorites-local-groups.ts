import { nextTick, ref } from "vue";

import { isFocusTarget, resolveElementTarget } from "./element-target.ts";

type LocalGroupsOptions = {
  createGroup?: (name: string) => void;
  selectGroup?: (type: string, key: string, options: { userInitiated: boolean }) => unknown;
};

function focusLocalGroupInput(value: unknown) {
  const element = resolveElementTarget(value);
  if (isFocusTarget(element)) {
    element.focus();
  }
}

export function useFavoritesLocalGroups(options: LocalGroupsOptions = {}) {
  const { createGroup, selectGroup = () => true } = options;

  const isCreatingLocalGroup = ref(false);
  const newLocalGroupName = ref("");
  const newLocalGroupInput = ref<unknown>(null);

  function startLocalGroupCreation() {
    if (isCreatingLocalGroup.value) {
      return;
    }
    isCreatingLocalGroup.value = true;
    newLocalGroupName.value = "";
    void nextTick(() => {
      focusLocalGroupInput(newLocalGroupInput.value);
    }).catch((error: unknown) => console.error(error));
  }

  function cancelLocalGroupCreation() {
    isCreatingLocalGroup.value = false;
    newLocalGroupName.value = "";
  }

  function handleLocalGroupCreationConfirm() {
    const name = newLocalGroupName.value.trim();
    if (!name) {
      cancelLocalGroupCreation();
      return;
    }
    createGroup?.(name);
    cancelLocalGroupCreation();
    void nextTick(() => {
      selectGroup("local", name, { userInitiated: true });
    }).catch((error: unknown) => console.error(error));
  }

  return {
    isCreatingLocalGroup,
    newLocalGroupName,
    newLocalGroupInput,
    startLocalGroupCreation,
    cancelLocalGroupCreation,
    handleLocalGroupCreationConfirm,
  };
}
