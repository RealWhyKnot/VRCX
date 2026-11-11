import { ref, watch } from "vue";
import { defineStore } from "pinia";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { formatFileSize } from "../shared/utils/base/format";
import { queryRequest } from "../api/query-request";
import { getAvatarHistory, preloadOwnAvatars } from "../coordinators/avatar-coordinator";
import { database } from "../services/database";
import { watchState } from "../services/watch-state";

export const useAvatarStore = defineStore("Avatar", () => {
  const cachedAvatarModerations = new Map();
  const cachedAvatars = new Map();
  const cachedAvatarNames = new Map();

  const avatarDialog = ref({
    visible: false,
    loading: false,
    activeTab: "Info",
    lastActiveTab: "Info",
    id: "",
    memo: "",
    ref: {},
    isFavorite: false,
    isBlocked: false,
    isQuestFallback: false,
    hasImposter: false,
    imposterVersion: "",
    isPC: false,
    isQuest: false,
    isIos: false,
    platformInfo: {},
    galleryImages: [],
    galleryLoading: false,
    inCache: false,
    cacheSize: "",
    cacheLocked: false,
    cachePath: "",
    fileAnalysis: {},
    timeSpent: 0,
  });
  const avatarHistory = ref([]);
  const loadingToastId = ref(null);

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      avatarDialog.value.visible = false;
      cachedAvatars.clear();
      cachedAvatarNames.clear();
      cachedAvatarModerations.clear();
      avatarHistory.value = [];
      if (isLoggedIn) {
        getAvatarHistory();
        preloadOwnAvatars();
      }
    },
    { flush: "sync" }
  );

  function setAvatarDialogLoading(value) {
    avatarDialog.value.loading = value;
  }

  function setAvatarDialogVisible(value) {
    avatarDialog.value.visible = value;
  }

  function setAvatarDialogIsFavorite(value) {
    avatarDialog.value.isFavorite = value;
  }

  async function getAvatarGallery(avatarId) {
    const D = avatarDialog.value;
    const args = await queryRequest.fetch("avatarGallery.force", { avatarId }).finally(() => {
      D.galleryLoading = false;
    });
    if (args.params.galleryId !== D.id) {
      return;
    }
    D.galleryImages = [];

    const sortedGallery = args.json.sort((a, b) => {
      if (!a.order && !b.order) {
        return 0;
      }
      return a.order - b.order;
    });
    for (const file of sortedGallery) {
      const url = file.versions[file.versions.length - 1].file.url;
      D.galleryImages.push({ id: file.id, url });
    }

    D.ref.gallery = args.json;
    return D.galleryImages;
  }

  function applyAvatarModeration(json) {
    if (typeof json.created === "number") {
      json.created = new Date(json.created).toJSON();
    }

    let ref = cachedAvatarModerations.get(json.targetAvatarId);
    if (typeof ref === "undefined") {
      ref = {
        avatarModerationType: "",
        created: "",
        targetAvatarId: "",
        ...json,
      };
      cachedAvatarModerations.set(ref.targetAvatarId, ref);
    } else {
      Object.assign(ref, json);
    }

    const D = avatarDialog.value;
    if (D.visible && ref.avatarModerationType === "block" && D.id === ref.targetAvatarId) {
      D.isBlocked = true;
    }

    return ref;
  }

  function resetCachedAvatarModerations() {
    cachedAvatarModerations.clear();
  }

  function updateVRChatAvatarCache() {
    const D = avatarDialog.value;
    if (D.visible) {
      D.inCache = false;
      D.cacheSize = "";
      D.cacheLocked = false;
      D.cachePath = "";
      checkVRChatCache(D.ref).then((cacheInfo) => {
        if (cacheInfo.Item1 > 0) {
          D.inCache = true;
          D.cacheSize = formatFileSize(cacheInfo.Item1);
          D.cachePath = cacheInfo.Item3;
        }
        D.cacheLocked = cacheInfo.Item2;
      });
    }
  }

  function clearAvatarHistory() {
    avatarHistory.value = [];
    database.clearAvatarHistory();
  }

  function setAvatarHistory(value) {
    avatarHistory.value = value;
  }

  function setLoadingToastId(value) {
    loadingToastId.value = value;
  }

  return {
    avatarDialog,
    avatarHistory,
    loadingToastId,
    cachedAvatarModerations,
    cachedAvatars,
    cachedAvatarNames,

    applyAvatarModeration,
    resetCachedAvatarModerations,
    getAvatarGallery,
    updateVRChatAvatarCache,
    clearAvatarHistory,
    setAvatarHistory,
    setLoadingToastId,
    setAvatarDialogVisible,
    setAvatarDialogIsFavorite,
    setAvatarDialogLoading,
  };
});
