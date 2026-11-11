import { nextTick } from "vue";
import { toast } from "vue-sonner";
import { i18n } from "../plugins/i18n";
import type { SearchWorlds } from "vrchat";

import { createDefaultWorldRef, type WorldPatch } from "../shared/utils/world-transforms";
import { evictMapCache } from "../shared/utils/cache-utils";
import { getAvailablePlatforms } from "../shared/utils/platform-utils";
import { getBundleDateSize } from "./cache-coordinator";
import { isRealInstance } from "../shared/utils/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { sanitizeEntityJson } from "../shared/utils/entity-transforms";
import { getWorldMemo } from "./memo-coordinator";
import { instanceRequest } from "../api/instance";
import { queryRequest } from "../api/query-request";
import { worldRequest } from "../api/world";
import { database } from "../services/database";
import { patchWorldFromEvent } from "../queries/entity-cache";
import { processBulk } from "../services/request";
import { applyFavorite } from "./favorite-coordinator";
import { useFavoriteStore } from "../stores/favorite";
import { useInstanceStore } from "../stores/instance";
import { useLocationStore } from "../stores/location";
import { logFailure } from "../stores/log-failure";
import { syncWorldSearchIndex, removeWorldSearchIndex } from "./search-index-coordinator";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { useWorldStore } from "../stores/world";

type WorldDialogOptions = {
  forceRefresh?: boolean;
};

function hasInstanceId(value: unknown): value is { instanceId: string } {
  return typeof value === "object" && value !== null && "instanceId" in value && typeof value.instanceId === "string";
}

function displayLabel(name: string | undefined, id: string): string {
  if (name) {
    return name;
  }
  return id;
}

export function showWorldDialog(tag: string, shortName: string | null = null, options: WorldDialogOptions = {}) {
  const worldStore = useWorldStore();
  const uiStore = useUiStore();
  const instanceStore = useInstanceStore();
  const favoriteStore = useFavoriteStore();
  const locationStore = useLocationStore();
  const t = i18n.global.t;

  const D = worldStore.worldDialog;
  const isForceRefresh = Boolean(options.forceRefresh);
  const L = parseLocation(tag);
  if (L.worldId === "") {
    return;
  }
  const isMainDialogOpen = uiStore.openDialog({
    type: "world",
    id: L.worldId,
    tag,
    shortName: shortName ?? "",
  });
  D.visible = true;
  if (isMainDialogOpen && D.id === L.worldId && !isForceRefresh) {
    uiStore.setDialogCrumbLabel("world", D.id, displayLabel(D.ref.name, D.id));
    instanceStore.applyWorldDialogInstances();
    nextTick(() => (D.loading = false)).catch(logFailure("Failed to clear world dialog loading state:"));
    return;
  }
  if (L.instanceId) {
    instanceRequest
      .getInstance({
        worldId: L.worldId,
        instanceId: L.instanceId,
      })
      .catch(logFailure("Failed to load instance for world dialog:"));
  }
  L.shortName = shortName ?? "";
  D.id = L.worldId;
  D.$location = L;
  D.loading = true;
  D.inCache = false;
  D.cacheSize = "";
  D.cacheLocked = false;
  D.cachePath = "";
  D.fileAnalysis = {};
  D.rooms = [];
  D.lastVisit = "";
  D.visitCount = 0;
  D.timeSpent = 0;
  D.isFavorite = false;
  D.avatarScalingDisabled = false;
  D.focusViewDisabled = false;
  D.isPC = false;
  D.isQuest = false;
  D.isIos = false;
  D.hasPersistData = false;
  D.rating = null;
  D.listings = [];
  D.memo = "";
  const LL = parseLocation(locationStore.lastLocation.location);
  let isCurrentWorldMatch = false;
  if (LL.worldId === D.id) {
    isCurrentWorldMatch = true;
  }
  getWorldMemo(D.id)
    .then((memo) => {
      if (memo.worldId === D.id) {
        D.memo = memo.memo;
      }
    })
    .catch(logFailure("Failed to load world memo:"));
  database
    .getLastVisit(D.id, isCurrentWorldMatch)
    .then((ref) => {
      if (ref.worldId === D.id) {
        D.lastVisit = ref.created_at;
      }
    })
    .catch(logFailure("Failed to load last visit:"));
  database
    .getVisitCount(D.id)
    .then((ref) => {
      if (ref.worldId === D.id) {
        D.visitCount = ref.visitCount;
      }
    })
    .catch(logFailure("Failed to load visit count:"));
  database
    .getTimeSpentInWorld(D.id)
    .then((ref) => {
      if (ref.worldId === D.id) {
        D.timeSpent = ref.timeSpent;
      }
    })
    .catch(logFailure("Failed to load time spent in world:"));
  const loadWorldRequest = worldRequest.getWorld({
    worldId: L.worldId,
  });
  loadWorldRequest
    .catch((err: unknown) => {
      nextTick(() => (D.loading = false)).catch(logFailure("Failed to clear world dialog loading state:"));
      D.id = "";
      D.visible = false;
      uiStore.jumpBackDialogCrumb();
      toast.error(t("message.world.load_failed"));
      throw err;
    })
    .then((args) => {
      const { ref } = args;
      if (D.id !== ref.id) {
        return;
      }
      D.ref = ref;
      uiStore.setDialogCrumbLabel("world", D.id, displayLabel(D.ref.name, D.id));
      if (ref.slimInstances) {
        for (const instance of ref.slimInstances) {
          if (!hasInstanceId(instance)) {
            continue;
          }
          const { instanceId } = instance;
          const tag = `${D.id}:${instanceId}`;
          if (isRealInstance(tag)) {
            instanceRequest
              .getInstance({
                worldId: D.id,
                instanceId,
              })
              .catch(logFailure("Failed to load instance for world dialog:"));
          }
        }
      }
      D.visible = true;
      D.loading = false;
      D.isFavorite = Boolean(favoriteStore.getCachedFavoritesByObjectId(D.id));
      if (!D.isFavorite) {
        D.isFavorite = favoriteStore.localWorldFavoritesList.includes(D.id);
      }
      const { isPC, isQuest, isIos } = getAvailablePlatforms(ref.unityPackages);
      D.avatarScalingDisabled = ref.tags.includes("feature_avatar_scaling_disabled");
      D.focusViewDisabled = ref.tags.includes("feature_focus_view_disabled");
      D.isPC = isPC;
      D.isQuest = isQuest;
      D.isIos = isIos;
      worldStore.updateVRChatWorldCache();
      queryRequest
        .fetch("worldPersistData", {
          worldId: D.id,
        })
        .then((args) => {
          if (args.params.worldId === worldStore.worldDialog.id && worldStore.worldDialog.visible) {
            worldStore.worldDialog.hasPersistData = args.json !== false;
          }
        })
        .catch(logFailure("Failed to load world persist data:"));
      worldRequest
        .getWorldRating({ worldId: D.id })
        .then((args) => {
          if (args.params.worldId === D.id) {
            D.rating = args.json?.value ?? null;
          }
        })
        .catch((err: unknown) => {
          console.error("Failed to load world rating:", err);
        });
    })
    .catch(logFailure("Failed to apply world dialog:"));
}

type WorldCacheRow = Awaited<ReturnType<typeof database.getWorldCache>>[number];

export function toWorldInput(row: WorldCacheRow, id: string): WorldPatch & { id: string } {
  return {
    id,
    authorId: row.authorId ?? undefined,
    authorName: row.authorName ?? undefined,
    created_at: row.created_at ?? undefined,
    description: row.description ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    name: row.name ?? undefined,
    releaseStatus: row.releaseStatus ?? undefined,
    thumbnailImageUrl: row.thumbnailImageUrl ?? undefined,
    updated_at: row.updated_at ?? undefined,
    version: row.version ?? undefined,
  };
}

export function applyWorld(json: WorldPatch & { id: string }) {
  const worldStore = useWorldStore();
  const favoriteStore = useFavoriteStore();
  const instanceStore = useInstanceStore();
  const userStore = useUserStore();

  sanitizeEntityJson(json, ["name", "description"]);
  const cached = worldStore.cachedWorlds.get(json.id);
  const ref = cached ?? createDefaultWorldRef(json);
  if (cached === undefined) {
    evictMapCache(worldStore.cachedWorlds, 10000, () => false, {
      logLabel: "World cache cleanup",
    });
    worldStore.cachedWorlds.set(ref.id, ref);
  } else {
    Object.assign(cached, json);
  }
  ref.$isLabs = ref.tags.includes("system_labs");
  applyFavorite("world", ref.id).catch(logFailure("Failed to apply world favorite:"));
  const userDialog = userStore.userDialog;
  if (userDialog.visible && userDialog.$location.worldId === ref.id) {
    userStore.applyUserDialogLocation();
  }
  const worldDialog = worldStore.worldDialog;
  if (worldDialog.visible && worldDialog.id === ref.id) {
    worldDialog.ref = ref;
    worldDialog.avatarScalingDisabled = ref.tags.includes("feature_avatar_scaling_disabled");
    worldDialog.focusViewDisabled = ref.tags.includes("feature_focus_view_disabled");
    instanceStore.applyWorldDialogInstances();
    for (const room of worldDialog.rooms) {
      if (isRealInstance(room.tag)) {
        instanceRequest
          .getInstance({
            worldId: worldDialog.id,
            instanceId: room.id,
          })
          .catch(logFailure("Failed to load instance for world dialog:"));
      }
    }
    if (Object.keys(worldDialog.fileAnalysis).length === 0) {
      getBundleDateSize(ref).catch(logFailure("Failed to read world bundle size:"));
    }
  }
  if (favoriteStore.localWorldFavoritesList.includes(ref.id)) {
    database.addWorldToCache(ref);
  }
  patchWorldFromEvent(ref);
  syncWorldSearchIndex(ref);
  return ref;
}

export async function preloadOwnWorlds() {
  const params: SearchWorlds["query"] = {
    n: 50,
    offset: 0,
    sort: "updated",
    order: "descending",
    releaseStatus: "all",
    user: "me",
  };
  await processBulk({
    fn: (p) => worldRequest.getWorlds(p),
    N: -1,
    params,
    handle: (args) => {
      for (const json of args.json) {
        applyWorld(json);
      }
    },
  });
}

export function removeWorldFromCache(id: string) {
  const worldStore = useWorldStore();
  worldStore.cachedWorlds.delete(id);
  removeWorldSearchIndex(id);
}
