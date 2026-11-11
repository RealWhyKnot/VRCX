import { toast } from "vue-sonner";
import { nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useFavoriteStore } from "../../../stores/favorite";
import { useModalStore } from "../../../stores/modal";
import { logFailure } from "../../../stores/log-failure";
import type { FavoriteGroupSlot } from "../../../stores/favorite-types";
import type { AvatarGroupVisibility } from "../avatar-favorite-entries";
import type { useFavoritesGroupPanel } from "./use-favorites-group-panel.ts";
import { favoriteRequest } from "../../../api/favorite";
import { refreshFavorites } from "../../../coordinators/favorite-coordinator";
import { deleteLocalAvatarFavoriteGroup, renameLocalAvatarFavoriteGroup } from "../../../coordinators/favorite-local-avatars";

export function useAvatarGroupActions({
  logLabel,
  handleGroupMenuVisible,
  selectGroup,
  localAvatarFavoriteGroups,
}: {
  logLabel: string;
  handleGroupMenuVisible: ReturnType<typeof useFavoritesGroupPanel>["handleGroupMenuVisible"];
  selectGroup: ReturnType<typeof useFavoritesGroupPanel>["selectGroup"];
  localAvatarFavoriteGroups: { value: string[] };
}) {
  const { t } = useI18n();
  const modalStore = useModalStore();
  const { handleFavoriteGroup } = useFavoriteStore();

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
            type: "avatar",
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

  function changeAvatarGroupVisibility(name: string, visibility: AvatarGroupVisibility, menuKey: string | null = null) {
    const params = {
      type: "avatar",
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
        toast.success("Group visibility changed");
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
        destructive: true,
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

  function promptLocalAvatarFavoriteGroupRename(group: string) {
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
          renameLocalAvatarFavoriteGroup(value, group);
          void nextTick(() => {
            if (localAvatarFavoriteGroups.value.includes(value)) {
              selectGroup("local", value);
            }
          }).catch(logFailure(logLabel));
        }
      })
      .catch(logFailure(logLabel));
  }

  function promptLocalAvatarFavoriteGroupDelete(group: string) {
    modalStore
      .confirm({
        description: t("confirm.delete_group", { name: group }),
        title: t("confirm.title"),
        destructive: true,
      })
      .then(({ ok }) => {
        if (ok) {
          deleteLocalAvatarFavoriteGroup(group);
        }
      })
      .catch(logFailure(logLabel));
  }

  return {
    changeFavoriteGroupName,
    changeAvatarGroupVisibility,
    clearFavoriteGroup,
    promptLocalAvatarFavoriteGroupRename,
    promptLocalAvatarFavoriteGroupDelete,
  };
}
