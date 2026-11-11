import { storeToRefs } from "pinia";
import { favoriteRequest } from "../../../api/favorite";
import { useFavoriteStore } from "../../../stores/favorite";
import { logFailure } from "../../../stores/log-failure";
import { useModalStore } from "../../../stores/modal";
import { removeLocalFriendFavorite } from "../../../coordinators/favorite-coordinator";

type ValueRef<T> = {
  readonly value: T;
};

type WritableValueRef<T> = {
  value: T;
};

export function useFriendSelection({
  selectedFavoriteFriends,
  friendEditMode,
  activeRemoteGroup,
  activeLocalGroupName,
  isLocalGroupSelected,
  currentFriendFavorites,
  isAllFriendsSelected,
}: {
  selectedFavoriteFriends: WritableValueRef<string[]>;
  friendEditMode: WritableValueRef<boolean>;
  activeRemoteGroup: ValueRef<unknown>;
  activeLocalGroupName: ValueRef<string | null>;
  isLocalGroupSelected: ValueRef<boolean>;
  currentFriendFavorites: ValueRef<{ id: string }[]>;
  isAllFriendsSelected: ValueRef<boolean>;
}) {
  const modalStore = useModalStore();
  const favoriteStore = useFavoriteStore();
  const { friendImportDialogInput } = storeToRefs(favoriteStore);
  const { showFriendImportDialog } = favoriteStore;

  function toggleFriendSelection(id: string, isSelected: boolean) {
    if (isSelected) {
      if (!selectedFavoriteFriends.value.includes(id)) {
        selectedFavoriteFriends.value.push(id);
      }
    } else {
      selectedFavoriteFriends.value = selectedFavoriteFriends.value.filter((selectedId) => selectedId !== id);
    }
  }

  function clearSelectedFriends() {
    selectedFavoriteFriends.value = [];
  }

  function toggleSelectAllFriends() {
    if (!activeRemoteGroup.value) {
      return;
    }
    if (isAllFriendsSelected.value) {
      selectedFavoriteFriends.value = [];
    } else {
      selectedFavoriteFriends.value = currentFriendFavorites.value.map((fav) => fav.id);
    }
  }

  function copySelectedFriends() {
    if (!selectedFavoriteFriends.value.length) {
      return;
    }
    const idList = selectedFavoriteFriends.value.map((id) => `${id}\n`).join("");
    friendImportDialogInput.value = idList;
    showFriendImportDialog();
  }

  function showFriendBulkUnfavoriteSelectionConfirm() {
    if (!selectedFavoriteFriends.value.length) {
      return;
    }
    const total = selectedFavoriteFriends.value.length;
    modalStore
      .confirm({
        description: `Are you sure you want to unfavorite ${total} favorites?\n            This action cannot be undone.`,
        title: `Delete ${total} favorites?`,
      })
      .then(({ ok }) => {
        if (ok) {
          bulkUnfavoriteSelectedFriends([...selectedFavoriteFriends.value]);
        }
      })
      .catch(logFailure("Friend favorites dialog"));
  }

  function bulkUnfavoriteSelectedFriends(ids: string[]) {
    const localGroupName = activeLocalGroupName.value;
    if (isLocalGroupSelected.value && localGroupName) {
      ids.forEach((id) => {
        removeLocalFriendFavorite(id, localGroupName);
      });
    } else {
      ids.forEach((id) => {
        void favoriteRequest.deleteFavorite({ objectId: id }).catch(logFailure("Remove friend favorite"));
      });
    }
    selectedFavoriteFriends.value = [];
    friendEditMode.value = false;
  }

  return {
    toggleFriendSelection,
    clearSelectedFriends,
    toggleSelectAllFriends,
    copySelectedFriends,
    showFriendBulkUnfavoriteSelectionConfirm,
  };
}
