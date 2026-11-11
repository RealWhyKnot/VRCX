import { nextTick } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useFavoriteStore } from "../../../stores/favorite";
import { useModalStore } from "../../../stores/modal";
import { logFailure } from "../../../stores/log-failure";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import type { WorldGroupVisibility } from "../world-favorite-entries";
import { favoriteRequest } from "../../../api/favorite";
import { refreshFavorites, renameLocalWorldFavoriteGroup } from "../../../coordinators/favorite-coordinator";

export function useWorldGroupActions({
  logLabel,
  handleGroupMenuVisible,
  selectGroup,
  localWorldFavoriteGroups,
  remoteGroupMenuKey,
  localGroupMenuKey,
}: {
  logLabel: string;
  handleGroupMenuVisible: (key: string, isVisible: boolean) => void;
  selectGroup: (type: string, key: string, opts?: { userInitiated?: boolean }) => void;
  localWorldFavoriteGroups: { value: string[] };
  remoteGroupMenuKey: (key: string) => string;
  localGroupMenuKey: (group: string) => string;
}) {
  const { t } = useI18n();
  const modalStore = useModalStore();
  const { handleFavoriteGroup, deleteLocalWorldFavoriteGroup } = useFavoriteStore();

  function changeFavoriteGroupName(group: FavoriteGroupSlot) {
    const currentName = group.displayName || group.name;
    modalStore
      .prompt({
        title: t("prompt.change_favorite_group_name.header"),
        description: t("prompt.change_favorite_group_name.description"),
        confirmText: t("prompt.change_favorite_group_name.change"),
        cancelText: t("prompt.change_favorite_group_name.cancel"),
        pattern: /\S+/,
        inputValue: currentName,
        errorMessage: t("prompt.change_favorite_group_name.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        const newName = value.trim();
        if (!newName || newName === currentName) {
          return;
        }
        void favoriteRequest
          .saveFavoriteGroup({
            type: group.type,
            group: group.name,
            displayName: newName,
          })
          .then((args) => {
            handleFavoriteGroup({
              json: args.json,
              params: {
                favoriteGroupId: args.json.id,
              },
            });
            toast.success(t("prompt.change_favorite_group_name.message.success"));
            refreshFavorites();
          })
          .catch(logFailure(logLabel));
      })
      .catch(logFailure(logLabel));
  }

  function changeWorldGroupVisibility(group: FavoriteGroupSlot, visibility: WorldGroupVisibility, menuKey: string | null = null) {
    const params = {
      type: group.type,
      group: group.name,
      visibility,
    };
    void favoriteRequest
      .saveFavoriteGroup(params)
      .then((args) => {
        handleFavoriteGroup({
          json: args.json,
          params: {
            favoriteGroupId: args.json.id,
          },
        });
        toast.success(t("message.group.visibility_updated"));
        if (menuKey) {
          handleGroupMenuVisible(menuKey, false);
        }
        refreshFavorites();
      })
      .catch(logFailure(logLabel));
  }

  function clearFavoriteGroup(ctx: FavoriteGroupSlot) {
    modalStore
      .confirm({
        description: t("confirm.clear_group"),
        title: t("confirm.title"),
      })
      .then(({ ok }) => {
        if (ok) {
          void favoriteRequest
            .clearFavoriteGroup({
              type: ctx.type,
              group: ctx.name,
            })
            .catch(logFailure(logLabel));
        }
      })
      .catch(logFailure(logLabel));
  }

  function promptLocalWorldFavoriteGroupRename(group: string) {
    modalStore
      .prompt({
        title: t("prompt.local_favorite_group_rename.header"),
        description: t("prompt.local_favorite_group_rename.description"),
        confirmText: t("prompt.local_favorite_group_rename.save"),
        cancelText: t("prompt.local_favorite_group_rename.cancel"),
        pattern: /\S+/,
        errorMessage: t("prompt.local_favorite_group_rename.input_error"),
        inputValue: group,
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value) {
          renameLocalWorldFavoriteGroup(value, group);
          void nextTick(() => {
            if (localWorldFavoriteGroups.value.includes(value)) {
              selectGroup("local", value, { userInitiated: true });
            }
          }).catch(logFailure(logLabel));
        }
      })
      .catch(logFailure(logLabel));
  }

  function promptLocalWorldFavoriteGroupDelete(group: string) {
    modalStore
      .confirm({
        description: t("confirm.delete_group", { name: group }),
        title: t("confirm.title"),
      })
      .then(({ ok }) => {
        if (ok) {
          deleteLocalWorldFavoriteGroup(group);
        }
      })
      .catch(logFailure(logLabel));
  }

  function handleVisibilitySelection(group: FavoriteGroupSlot, visibility: WorldGroupVisibility) {
    const menuKey = remoteGroupMenuKey(group.key);
    changeWorldGroupVisibility(group, visibility, menuKey);
  }

  function handleRemoteRename(group: FavoriteGroupSlot) {
    handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
    changeFavoriteGroupName(group);
  }

  function handleRemoteClear(group: FavoriteGroupSlot) {
    handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
    clearFavoriteGroup(group);
  }

  function handleLocalRename(groupName: string) {
    handleGroupMenuVisible(localGroupMenuKey(groupName), false);
    promptLocalWorldFavoriteGroupRename(groupName);
  }

  function handleLocalDelete(groupName: string) {
    handleGroupMenuVisible(localGroupMenuKey(groupName), false);
    promptLocalWorldFavoriteGroupDelete(groupName);
  }

  return {
    handleVisibilitySelection,
    handleRemoteRename,
    handleRemoteClear,
    handleLocalRename,
    handleLocalDelete,
  };
}
