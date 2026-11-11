import { reactive, shallowReactive, watch } from "vue";
import { defineStore } from "pinia";
import type { ProductListing } from "vrchat";

import { checkVRChatCache } from "../coordinators/cache-coordinator";
import { formatFileSize } from "../shared/utils/base/format";
import { preloadOwnWorlds } from "../coordinators/world-coordinator";
import type { WorldRef } from "../shared/utils/world-transforms";
import type { InstanceRoom } from "./instance-types";
import type { Json, ParsedLocation, WorldRatingValue } from "../types/vrcx";
import { watchState } from "../services/watch-state";

type WorldDialogState = {
  visible: boolean;
  loading: boolean;
  activeTab: string;
  lastActiveTab: string;
  id: string;
  memo: string;
  $location: Partial<ParsedLocation>;
  ref: Partial<WorldRef>;
  isFavorite: boolean;
  avatarScalingDisabled: boolean | undefined;
  focusViewDisabled: boolean | undefined;
  rooms: InstanceRoom[];
  inCache: boolean;
  cacheSize: string;
  cacheLocked: boolean;
  cachePath: string;
  fileAnalysis: Record<string, unknown>;
  lastVisit: string;
  visitCount: number;
  timeSpent: number;
  isPC: boolean;
  isQuest: boolean;
  isIos: boolean;
  hasPersistData: boolean;
  rating: WorldRatingValue | null;
  listings: Json<ProductListing>[];
};

export const useWorldStore = defineStore("World", () => {
  const worldDialog: WorldDialogState = reactive<WorldDialogState>({
    visible: false,
    loading: false,
    activeTab: "Instances",
    lastActiveTab: "Instances",
    id: "",
    memo: "",
    $location: {},
    ref: {},
    isFavorite: false,
    avatarScalingDisabled: false,
    focusViewDisabled: false,
    rooms: [],
    inCache: false,
    cacheSize: "",
    cacheLocked: false,
    cachePath: "",
    fileAnalysis: {},
    lastVisit: "",
    visitCount: 0,
    timeSpent: 0,
    isPC: false,
    isQuest: false,
    isIos: false,
    hasPersistData: false,
    rating: null,
    listings: [],
  });

  const cachedWorlds = shallowReactive(new Map<string, WorldRef>());

  watch(
    () => watchState.isLoggedIn,
    (isLoggedIn) => {
      worldDialog.visible = false;
      cachedWorlds.clear();
      if (isLoggedIn) {
        preloadOwnWorlds().catch((err: unknown) => console.error(err));
      }
    },
    { flush: "sync" }
  );

  function setWorldDialogLoading(isLoading: boolean) {
    worldDialog.loading = isLoading;
  }

  function setWorldDialogVisible(isVisible: boolean) {
    worldDialog.visible = isVisible;
  }

  function setWorldDialogIsFavorite(isFavorite: boolean) {
    worldDialog.isFavorite = isFavorite;
  }

  function updateVRChatWorldCache() {
    const D = worldDialog;
    if (D.visible) {
      D.inCache = false;
      D.cacheSize = "";
      D.cacheLocked = false;
      D.cachePath = "";
      void checkVRChatCache(D.ref)
        .then((cacheInfo) => {
          if (cacheInfo.Item1 > 0) {
            D.inCache = true;
            D.cacheSize = formatFileSize(cacheInfo.Item1);
            D.cachePath = cacheInfo.Item3;
          }
          D.cacheLocked = cacheInfo.Item2;
        })
        .catch((err: unknown) => console.error(err));
    }
  }

  return {
    worldDialog,
    cachedWorlds,
    setWorldDialogVisible,
    setWorldDialogIsFavorite,
    setWorldDialogLoading,
    updateVRChatWorldCache,
  };
});
