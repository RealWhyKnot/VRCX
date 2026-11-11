import { watch } from "vue";

import { useSearchIndexStore } from "../stores/search-index";
import { watchState } from "../services/watch-state";

type SearchIndexStore = ReturnType<typeof useSearchIndexStore>;

type FriendSearchSource = Parameters<SearchIndexStore["syncFriend"]>[0];

type AssetSearchSource = Parameters<SearchIndexStore["upsertAvatar"]>[0];

type GroupSearchSource = Parameters<SearchIndexStore["upsertGroup"]>[0];

export function syncFriendSearchIndex(ctx: FriendSearchSource) {
  useSearchIndexStore().syncFriend(ctx);
}

export function removeFriendSearchIndex(id: string) {
  useSearchIndexStore().removeFriend(id);
}

export function clearFriendSearchIndex() {
  useSearchIndexStore().clearFriends();
}

export function syncAvatarSearchIndex(ref: AssetSearchSource) {
  useSearchIndexStore().upsertAvatar(ref);
}

export function removeAvatarSearchIndex(id: string) {
  useSearchIndexStore().removeAvatar(id);
}

export function clearAvatarSearchIndex() {
  useSearchIndexStore().clearAvatars();
}

export function syncWorldSearchIndex(ref: AssetSearchSource) {
  useSearchIndexStore().upsertWorld(ref);
}

export function removeWorldSearchIndex(id: string) {
  useSearchIndexStore().removeWorld(id);
}

export function clearWorldSearchIndex() {
  useSearchIndexStore().clearWorlds();
}

export function syncGroupSearchIndex(ref: GroupSearchSource) {
  useSearchIndexStore().upsertGroup(ref);
}

export function removeGroupSearchIndex(id: string) {
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
