import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { File } from "vrchat";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { formatFileSize } from "../shared/utils/base/format";
import type { CachedAvatarName } from "../shared/utils/avatar";
import type { AvatarRef } from "../shared/utils/avatar-transforms";
import { queryRequest } from "../api/query-request";
import { getAvatarHistory, preloadOwnAvatars } from "../coordinators/avatar-coordinator";
import type { Json } from "../types/vrcx";
import { database } from "../services/database";
import { watchState } from "../services/watch-state";

type AvatarGalleryFile = Json<File> & { order?: number };

export type AvatarGalleryImage = {
  id: string;
  url: string;
};

type AvatarDialogRef = Partial<AvatarRef> & {
  gallery?: AvatarGalleryFile[];
};

type AvatarModeration = {
  avatarModerationType: string;
  created: string | number;
  targetAvatarId: string;
};

type AvatarModerationUpdate = Partial<AvatarModeration> & Pick<AvatarModeration, "targetAvatarId">;

export type AvatarHistoryEntry = {
  id: string | null;
  authorId: string | null;
  authorName: string | null;
  created_at: string | null;
  description: string | null;
  imageUrl: string | null;
  name: string | null;
  releaseStatus: string | null;
  thumbnailImageUrl: string | null;
  updated_at: string | null;
  version: number | null;
};

type AvatarDialogState = {
  visible: boolean;
  loading: boolean;
  activeTab: string;
  lastActiveTab: string;
  id: string;
  memo: string;
  ref: AvatarDialogRef;
  isFavorite: boolean;
  isBlocked: boolean;
  isQuestFallback: boolean;
  hasImposter: boolean;
  imposterVersion: string;
  isPC: boolean;
  isQuest: boolean;
  isIos: boolean;
  platformInfo: Record<string, unknown>;
  galleryImages: AvatarGalleryImage[];
  galleryLoading: boolean;
  inCache: boolean;
  cacheSize: string;
  cacheLocked: boolean;
  cachePath: string;
  fileAnalysis: Record<string, unknown>;
  timeSpent: number;
};

export const useAvatarStore = defineStore("Avatar", () => {
  const cachedAvatarModerations = new Map<string, AvatarModeration>();
  const cachedAvatars = new Map<string, AvatarRef>();
  const cachedAvatarNames = new Map<string, CachedAvatarName>();

  const avatarDialog = ref<AvatarDialogState>({
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
  const avatarHistory = ref<AvatarHistoryEntry[]>([]);
  const loadingToastId = ref<string | number | null>(null);

  watch(
    () => watchState.isLoggedIn,
    async (isLoggedIn) => {
      avatarDialog.value.visible = false;
      cachedAvatars.clear();
      cachedAvatarNames.clear();
      cachedAvatarModerations.clear();
      avatarHistory.value = [];
      if (isLoggedIn) {
        await Promise.all([getAvatarHistory(), preloadOwnAvatars()]);
      }
    },
    { flush: "sync" }
  );

  function setAvatarDialogLoading(isLoading: boolean) {
    avatarDialog.value.loading = isLoading;
  }

  function setAvatarDialogVisible(isVisible: boolean) {
    avatarDialog.value.visible = isVisible;
  }

  function setAvatarDialogIsFavorite(isFavorite: boolean) {
    avatarDialog.value.isFavorite = isFavorite;
  }

  async function getAvatarGallery(avatarId: string) {
    const D = avatarDialog.value;
    const args = await queryRequest.fetch("avatarGallery.force", { avatarId }).finally(() => {
      D.galleryLoading = false;
    });
    if (args.params.galleryId !== D.id) {
      return;
    }
    D.galleryImages = [];

    const sortedGallery = args.json.sort((a: AvatarGalleryFile, b: AvatarGalleryFile) => {
      if (!a.order && !b.order) {
        return 0;
      }
      return Number(a.order) - Number(b.order);
    });
    for (const file of sortedGallery) {
      const latestVersion = file.versions[file.versions.length - 1];
      if (!latestVersion?.file) {
        throw new Error(`Avatar gallery file ${file.id} has no versions`);
      }
      D.galleryImages.push({ id: file.id, url: latestVersion.file.url });
    }

    D.ref.gallery = args.json;
    return D.galleryImages;
  }

  function applyAvatarModeration(json: AvatarModerationUpdate) {
    if (typeof json.created === "number") {
      json.created = new Date(json.created).toJSON();
    }

    let ref = cachedAvatarModerations.get(json.targetAvatarId);
    if (typeof ref === "undefined") {
      ref = {
        avatarModerationType: "",
        created: "",
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

  async function updateVRChatAvatarCache() {
    const D = avatarDialog.value;
    if (D.visible) {
      D.inCache = false;
      D.cacheSize = "";
      D.cacheLocked = false;
      D.cachePath = "";
      await checkVRChatCache(D.ref).then((cacheInfo) => {
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

  function setAvatarHistory(value: AvatarHistoryEntry[]) {
    avatarHistory.value = value;
  }

  function setLoadingToastId(value: string | number | null) {
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
