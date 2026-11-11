import { computed, effectScope, ref, watch, type EffectScope } from "vue";
import { defineStore } from "pinia";
import type { VrcxUser } from "../types/vrcx";
import { useFriendStore } from "./friend";
import { useSearchIndexStore } from "./search-index";
import { useUserStore } from "./user";
import { isObjectRecord, type FriendSearchResult, type ItemSearchResult, type SearchWorkerResponse } from "./quick-search-worker-protocol";
import { showGroupDialog } from "../coordinators/group-dialog-coordinator";
import { showWorldDialog } from "../coordinators/world-coordinator";
import { showAvatarDialog } from "../coordinators/avatar-coordinator";
import { showUserDialog } from "../coordinators/user-coordinator";

import QuickSearchWorker from "./quick-search-worker.ts?worker&inline";

type FriendResultItem = FriendSearchResult & {
  ref: VrcxUser | undefined;
};

type SearchSelection = {
  type: string;
  id: string;
};

function isSearchWorkerResponse(value: unknown): value is SearchWorkerResponse {
  if (!isObjectRecord(value) || value.type !== "searchResult") {
    return false;
  }
  const payload = value.payload;
  if (!isObjectRecord(payload)) {
    return false;
  }
  return [payload.friends, payload.ownAvatars, payload.favAvatars, payload.ownWorlds, payload.favWorlds, payload.ownGroups, payload.joinedGroups].every(
    (list) => Array.isArray(list)
  );
}

export const useQuickSearchStore = defineStore("QuickSearch", () => {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const searchIndexStore = useSearchIndexStore();

  const isOpen = ref(false);
  const query = ref("");

  let worker: Worker | null = null;
  let indexUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  let indexWatchScope: EffectScope | null = null;

  function getWorker() {
    if (!worker) {
      worker = new QuickSearchWorker();
      worker.onmessage = handleWorkerMessage;
    }
    return worker;
  }

  function disposeWorker() {
    if (!worker) return;
    worker.terminate();
    worker = null;
  }

  const friendResults = ref<FriendResultItem[]>([]);
  const ownAvatarResults = ref<ItemSearchResult[]>([]);
  const favoriteAvatarResults = ref<ItemSearchResult[]>([]);
  const ownWorldResults = ref<ItemSearchResult[]>([]);
  const favoriteWorldResults = ref<ItemSearchResult[]>([]);
  const ownGroupResults = ref<ItemSearchResult[]>([]);
  const joinedGroupResults = ref<ItemSearchResult[]>([]);

  const hasResults = computed(
    () =>
      friendResults.value.length > 0 ||
      ownAvatarResults.value.length > 0 ||
      favoriteAvatarResults.value.length > 0 ||
      ownWorldResults.value.length > 0 ||
      favoriteWorldResults.value.length > 0 ||
      ownGroupResults.value.length > 0 ||
      joinedGroupResults.value.length > 0
  );

  const currentUserId = computed(() => userStore.currentUser.id);

  function scheduleIndexUpdate() {
    if (!isOpen.value) return;
    if (indexUpdateTimer) clearTimeout(indexUpdateTimer);
    indexUpdateTimer = setTimeout(() => {
      indexUpdateTimer = null;
      if (!isOpen.value) return;
      sendIndexUpdate();
      if (query.value && query.value.length >= 1) {
        dispatchSearch();
      }
    }, 200);
  }

  function sendIndexUpdate() {
    const w = getWorker();
    const payload = searchIndexStore.getSnapshot();
    w.postMessage({ type: "updateIndex", payload });
  }

  function stopIndexWatchers() {
    if (indexUpdateTimer) {
      clearTimeout(indexUpdateTimer);
      indexUpdateTimer = null;
    }
    if (indexWatchScope) {
      indexWatchScope.stop();
      indexWatchScope = null;
    }
  }

  function startIndexWatchers() {
    if (indexWatchScope) return;

    indexWatchScope = effectScope();
    indexWatchScope.run(() => {
      watch(
        () => searchIndexStore.version,
        () => scheduleIndexUpdate()
      );
    });
  }

  let searchSeq = 0;

  function dispatchSearch() {
    const q = query.value;
    if (!q || q.length < 1) {
      ++searchSeq;
      clearResults();
      return;
    }
    const seq = ++searchSeq;
    const w = getWorker();
    w.postMessage({
      type: "search",
      payload: {
        seq,
        query: q,
        currentUserId: currentUserId.value,
        language: navigator.language,
      },
    });
  }

  watch(query, dispatchSearch);
  watch(currentUserId, () => {
    if (query.value && query.value.length >= 1) {
      dispatchSearch();
    }
  });

  watch(isOpen, (isOpenNow) => {
    if (isOpenNow) {
      startIndexWatchers();
      sendIndexUpdate();
      if (query.value && query.value.length >= 1) {
        dispatchSearch();
      }
      return;
    }

    query.value = "";
    clearResults();
    stopIndexWatchers();
    disposeWorker();
  });

  function handleWorkerMessage(event: MessageEvent<unknown>) {
    const data: unknown = event.data;
    if (!isSearchWorkerResponse(data)) return;
    const { payload } = data;
    if (payload.seq !== searchSeq) return;

    friendResults.value = payload.friends.map((item) => {
      const friendEntry = friendStore.friends.get(item.id);
      return { ...item, ref: friendEntry?.ref };
    });
    ownAvatarResults.value = payload.ownAvatars;
    favoriteAvatarResults.value = payload.favAvatars;
    ownWorldResults.value = payload.ownWorlds;
    favoriteWorldResults.value = payload.favWorlds;
    ownGroupResults.value = payload.ownGroups;
    joinedGroupResults.value = payload.joinedGroups;
  }

  function clearResults() {
    friendResults.value = [];
    ownAvatarResults.value = [];
    favoriteAvatarResults.value = [];
    ownWorldResults.value = [];
    favoriteWorldResults.value = [];
    ownGroupResults.value = [];
    joinedGroupResults.value = [];
  }

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function setQuery(value: string) {
    query.value = value;
  }

  function selectResult(item: SearchSelection | null | undefined) {
    if (!item) return;

    close();

    switch (item.type) {
      case "friend":
        showUserDialog(item.id);
        break;
      case "avatar":
        showAvatarDialog(item.id);
        break;
      case "world":
        showWorldDialog(item.id);
        break;
      case "group":
        showGroupDialog(item.id);
        break;
    }
  }

  return {
    isOpen,
    query,
    friendResults,
    ownAvatarResults,
    favoriteAvatarResults,
    ownWorldResults,
    favoriteWorldResults,
    ownGroupResults,
    joinedGroupResults,
    hasResults,

    open,
    close,
    setQuery,
    selectResult,
  };
});
