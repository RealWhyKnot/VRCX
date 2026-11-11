import { watch } from "vue";

import { useSearchIndexStore } from "../stores/search-index";
import { watchState } from "../services/watch-state";

export function syncFriendSearchIndex(ctx) {
  useSearchIndexStore().syncFriend(ctx);
}

export function removeFriendSearchIndex(id) {
  useSearchIndexStore().removeFriend(id);
}

export function clearFriendSearchIndex() {
  useSearchIndexStore().clearFriends();
}

export function syncAvatarSearchIndex(ref) {
  useSearchIndexStore().upsertAvatar(ref);
}

export function removeAvatarSearchIndex(id) {
  useSearchIndexStore().removeAvatar(id);
}

export function clearAvatarSearchIndex() {
  useSearchIndexStore().clearAvatars();
}

export function syncWorldSearchIndex(ref) {
  useSearchIndexStore().upsertWorld(ref);
}

export function removeWorldSearchIndex(id) {
  useSearchIndexStore().removeWorld(id);
}

export function clearWorldSearchIndex() {
  useSearchIndexStore().clearWorlds();
}

export function syncGroupSearchIndex(ref) {
  useSearchIndexStore().upsertGroup(ref);
}

export function removeGroupSearchIndex(id) {
  useSearchIndexStore().removeGroup(id);
}

export function clearGroupSearchIndex() {
  useSearchIndexStore().clearGroups();
}

export function rebuildFavoriteSearchIndex() {
  useSearchIndexStore().rebuildFavoritesFromStore();
}

export function clearFavoriteSearchIndex() {
  useSearchIndexStore().clearFavorites();
}

export function resetSearchIndexOnLogin() {
  const searchIndexStore = useSearchIndexStore();
  watch(
    () => watchState.isLoggedIn,
    () => {
      searchIndexStore.clearFriends();
      searchIndexStore.clearAvatars();
      searchIndexStore.clearWorlds();
      searchIndexStore.clearGroups();
      searchIndexStore.clearFavorites();
    },
    { flush: "sync" }
  );
}
