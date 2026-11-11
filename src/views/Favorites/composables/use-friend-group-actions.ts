import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useFavoriteStore } from "../../../stores/favorite";
import { useModalStore } from "../../../stores/modal";
import { logFailure } from "../../../stores/log-failure";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import type { useFavoritesGroupPanel } from "./use-favorites-group-panel.ts";
import { favoriteRequest } from "../../../api/favorite";
import { deleteLocalFriendFavoriteGroup, refreshFavorites, renameLocalFriendFavoriteGroup } from "../../../coordinators/favorite-coordinator";

export const friendGroupVisibilityOptions = ["public", "friends", "private"] as const;

type FriendGroupPanel = Pick<
  ReturnType<typeof useFavoritesGroupPanel>,
  "handleGroupMenuVisible" | "remoteGroupMenuKey" | "localGroupMenuKey" | "isGroupActive" | "selectGroup" | "selectDefaultGroup"
>;

export function useFriendGroupActions({
  handleGroupMenuVisible,
  remoteGroupMenuKey,
  localGroupMenuKey,
  isGroupActive,
  selectGroup,
  selectDefaultGroup,
}: FriendGroupPanel) {
  const { t } = useI18n();
  const modalStore = useModalStore();
  const { handleFavoriteGroup } = useFavoriteStore();

  function clearFavoriteGroup(group: FavoriteGroupSlot) {
    modalStore
      .confirm({
        description: t("confirm.clear_group"),
        title: t("confirm.title"),
      })
      .then(({ ok }) => {
        if (ok) {
          void favoriteRequest
            .clearFavoriteGroup({
              type: group.type,
              group: group.name,
            })
            .catch(logFailure("Clear friend favorite group"));
        }
      })
      .catch(logFailure("Friend favorites dialog"));
  }

  function handleVisibilitySelection(group: FavoriteGroupSlot, visibility: (typeof friendGroupVisibilityOptions)[number]) {
    const menuKey = remoteGroupMenuKey(group.key);
    changeFriendGroupVisibility(group.name, visibility, menuKey);
  }

  function handleRemoteRename(group: FavoriteGroupSlot) {
    handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
    changeFavoriteGroupName(group);
  }

  function handleRemoteClear(group: FavoriteGroupSlot) {
    handleGroupMenuVisible(remoteGroupMenuKey(group.key), false);
    clearFavoriteGroup(group);
  }

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
            type: "friend",
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
          .catch(logFailure("Rename friend favorite group"));
      })
      .catch(logFailure("Friend favorites dialog"));
  }

  function changeFriendGroupVisibility(name: string, visibility: (typeof friendGroupVisibilityOptions)[number], menuKey: string | null = null) {
    const params = {
      type: "friend",
      group: name,
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
      .catch(logFailure("Change friend favorite group visibility"));
  }

  function handleLocalRename(group: string) {
    handleGroupMenuVisible(localGroupMenuKey(group), false);
    modalStore
      .prompt({
        title: t("prompt.change_favorite_group_name.header"),
        description: t("prompt.change_favorite_group_name.description"),
        confirmText: t("prompt.change_favorite_group_name.change"),
        cancelText: t("prompt.change_favorite_group_name.cancel"),
        pattern: /\S+/,
        inputValue: group,
        errorMessage: t("prompt.change_favorite_group_name.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        const newName = value.trim();
        if (!newName || newName === group) {
          return;
        }
        renameLocalFriendFavoriteGroup(newName, group);
        if (isGroupActive("local", group)) {
          selectGroup("local", newName);
        }
        toast.success(t("prompt.change_favorite_group_name.message.success"));
      })
      .catch(logFailure("Friend favorites dialog"));
  }

  function handleLocalDelete(group: string) {
    handleGroupMenuVisible(localGroupMenuKey(group), false);
    modalStore
      .confirm({
        description: t("confirm.delete_group", { name: group }),
        title: t("confirm.title"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        deleteLocalFriendFavoriteGroup(group);
        if (isGroupActive("local", group)) {
          selectDefaultGroup();
        }
      })
      .catch(logFailure("Friend favorites dialog"));
  }

  return {
    handleVisibilitySelection,
    handleRemoteRename,
    handleRemoteClear,
    handleLocalRename,
    handleLocalDelete,
  };
}
