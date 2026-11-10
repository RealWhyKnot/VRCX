import { nextTick, ref } from "vue";

export function useFavoritesLocalGroups(options = {}) {
  const { createGroup, selectGroup = () => true } = options;

  const isCreatingLocalGroup = ref(false);
  const newLocalGroupName = ref("");
  const newLocalGroupInput = ref(null);

  function startLocalGroupCreation() {
    if (isCreatingLocalGroup.value) {
      return;
    }
    isCreatingLocalGroup.value = true;
    newLocalGroupName.value = "";
    nextTick(() => {
      const el = newLocalGroupInput.value?.$el ?? newLocalGroupInput.value;
      el?.focus?.();
    });
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
    nextTick(() => {
      selectGroup("local", name, { userInitiated: true });
    });
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
