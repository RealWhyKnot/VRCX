import { nextTick } from "vue";
import { toast } from "vue-sonner";
import type { SearchAvatars } from "vrchat";
import { i18n } from "../plugins/i18n";

import { createDefaultAvatarRef, type AvatarPatch } from "../shared/utils/avatar-transforms";
import { extractFileId } from "../shared/utils/file-utils";
import { getAvailablePlatforms } from "../shared/utils/platform-utils";
import { getBundleDateSize } from "./cache-coordinator";
import { getPlatformInfo, storeAvatarImage, type CachedAvatarName } from "../shared/utils/avatar";
import { replaceBioSymbols } from "../shared/utils/base/string";
import { sanitizeEntityJson } from "../shared/utils/entity-transforms";
import { avatarRequest } from "../api/avatar";
import { miscRequest } from "../api/misc";
import { queryRequest } from "../api/query-request";
import { logWebRequest } from "../services/app-config";
import { database } from "../services/database";
import { patchAvatarFromEvent } from "../queries/entity-cache";
import { processBulk } from "../services/request";
import { applyFavorite } from "./favorite-sync";
import { refreshUserDialogAvatars, showUserDialog } from "./user-coordinator";
import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useAvatarProviderStore } from "../stores/avatar-provider";
import { useAvatarStore } from "../stores/avatar";
import { useFavoriteStore } from "../stores/favorite";
import { useModalStore } from "../stores/modal";
import { logFailure } from "../stores/log-failure";
import { toConfirmOk } from "../stores/auth-types";
import { syncAvatarSearchIndex, removeAvatarSearchIndex } from "./search-index-coordinator";
import { useUiStore } from "../stores/ui";
import { useUserStore } from "../stores/user";
import { useVRCXUpdaterStore } from "../stores/vrcx-updater";

import { webApiService } from "../services/webapi";

type AvatarInput = AvatarPatch & {
  id: string;
};

type RemoteAvatar = {
  authorId: string;
  authorName: string;
  name: string;
  description: string;
  id: string;
  imageUrl: string;
  thumbnailImageUrl: string;
  created_at: string;
  updated_at: string;
  releaseStatus: string;
};

type AvatarDialogTarget = ReturnType<typeof useAvatarStore>["avatarDialog"];

type AvatarHistoryRow = Awaited<ReturnType<typeof database.getAvatarHistory>>[number];

function avatarCrumbLabel(avatarDialog: AvatarDialogTarget) {
  const name = avatarDialog.ref.name;
  if (name) {
    return name;
  }
  return avatarDialog.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createRemoteAvatar(source: Record<string, unknown>): RemoteAvatar {
  return {
    authorId: "",
    authorName: "",
    name: "",
    description: "",
    id: "",
    imageUrl: "",
    thumbnailImageUrl: "",
    created_at: "0001-01-01T00:00:00.0000000Z",
    updated_at: "0001-01-01T00:00:00.0000000Z",
    releaseStatus: "public",
    ...source,
  };
}

function clearDialogLoadingNextTick(avatarDialog: AvatarDialogTarget) {
  nextTick(() => {
    avatarDialog.loading = false;
  }).catch(logFailure("Clearing the avatar dialog loading state failed:"));
}

function remoteProviderHeaders(vrcxId: string) {
  return {
    Referer: "https://vrcx.app",
    "VRCX-ID": vrcxId,
  };
}

export function applyAvatar(json: AvatarInput) {
  const avatarStore = useAvatarStore();
  const favoriteStore = useFavoriteStore();

  sanitizeEntityJson(json, ["name", "description"]);
  let ref = avatarStore.cachedAvatars.get(json.id);
  if (typeof ref === "undefined") {
    ref = createDefaultAvatarRef(json);
    avatarStore.cachedAvatars.set(ref.id, ref);
  } else {
    const { unityPackages } = ref;
    Object.assign(ref, json);
    const incomingUnityPackages = json.unityPackages ?? [];
    if (incomingUnityPackages.length > 0 && unityPackages.length > 0 && !incomingUnityPackages[0]?.assetUrl) {
      ref.unityPackages = unityPackages;
    }
  }
  for (const listing of ref.publishedListings) {
    listing.displayName = replaceBioSymbols(listing.displayName);
    listing.description = replaceBioSymbols(listing.description);
  }
  applyFavorite("avatar", ref.id).catch(logFailure("Applying the avatar favorite failed:"));
  if (favoriteStore.localAvatarFavoritesList.includes(ref.id)) {
    const avatarRef = ref;
    favoriteStore.syncLocalAvatarFavoriteRef(avatarRef);

    database.addAvatarToCache(avatarRef);
  }
  patchAvatarFromEvent(ref);
  syncAvatarSearchIndex(ref);
  return ref;
}

export function showAvatarDialog(avatarId: string, options: { forceRefresh?: boolean } = {}) {
  const avatarStore = useAvatarStore();
  const uiStore = useUiStore();
  const favoriteStore = useFavoriteStore();
  const userStore = useUserStore();
  const t = i18n.global.t;

  const avatarDialog = avatarStore.avatarDialog;
  const isForceRefresh = Boolean(options.forceRefresh);
  const isMainDialogOpen = uiStore.openDialog({
    type: "avatar",
    id: avatarId,
  });
  avatarDialog.visible = true;
  if (isMainDialogOpen && avatarDialog.id === avatarId && !isForceRefresh) {
    uiStore.setDialogCrumbLabel("avatar", avatarDialog.id, avatarCrumbLabel(avatarDialog));
    clearDialogLoadingNextTick(avatarDialog);
    return;
  }
  avatarDialog.loading = true;
  avatarDialog.id = avatarId;
  avatarDialog.inCache = false;
  avatarDialog.cacheSize = "";
  avatarDialog.cacheLocked = false;
  avatarDialog.cachePath = "";
  avatarDialog.fileAnalysis = {};
  avatarDialog.isQuestFallback = false;
  avatarDialog.isPC = false;
  avatarDialog.isQuest = false;
  avatarDialog.isIos = false;
  avatarDialog.hasImposter = false;
  avatarDialog.imposterVersion = "";
  avatarDialog.platformInfo = {};
  avatarDialog.galleryImages = [];
  avatarDialog.galleryLoading = true;
  const isCachedFavorite = Boolean(favoriteStore.getCachedFavoritesByObjectId(avatarId));
  avatarDialog.isFavorite = isCachedFavorite || (userStore.isLocalUserVrcPlusSupporter && favoriteStore.localAvatarFavoritesList.includes(avatarId));
  avatarDialog.isBlocked = avatarStore.cachedAvatarModerations.has(avatarId);
  const ref2 = avatarStore.cachedAvatars.get(avatarId);
  if (typeof ref2 !== "undefined") {
    avatarDialog.ref = ref2;
    uiStore.setDialogCrumbLabel("avatar", avatarDialog.id, avatarCrumbLabel(avatarDialog));
    clearDialogLoadingNextTick(avatarDialog);
  }
  const loadAvatarRequest = isForceRefresh ? avatarRequest.getAvatar({ avatarId }) : queryRequest.fetch("avatar.dialog", { avatarId });
  loadAvatarRequest
    .then((args) => {
      const ref = applyAvatar(args.json);
      avatarDialog.ref = ref;
      uiStore.setDialogCrumbLabel("avatar", avatarDialog.id, avatarCrumbLabel(avatarDialog));
      avatarStore.getAvatarGallery(avatarId).catch(logFailure("Loading the avatar gallery failed:"));
      avatarStore.updateVRChatAvatarCache().catch(logFailure("Updating the avatar cache failed:"));
      if (ref.tags.some((tag) => tag.includes("quest"))) {
        avatarDialog.isQuestFallback = true;
      }
      const { isPC, isQuest, isIos } = getAvailablePlatforms(ref.unityPackages);
      avatarDialog.isPC = isPC;
      avatarDialog.isQuest = isQuest;
      avatarDialog.isIos = isIos;
      avatarDialog.platformInfo = getPlatformInfo(ref.unityPackages);
      for (const unityPackage of ref.unityPackages.slice().reverse()) {
        if (unityPackage.variant === "impostor") {
          avatarDialog.hasImposter = true;
          avatarDialog.imposterVersion = unityPackage.impostorizerVersion ?? "";
          break;
        }
      }
      if (Object.keys(avatarDialog.fileAnalysis).length === 0) {
        getBundleDateSize(ref).catch(logFailure("Loading the avatar bundle size failed:"));
      }
    })
    .catch((err: unknown) => {
      avatarDialog.loading = false;
      avatarDialog.id = "";
      avatarDialog.visible = false;
      uiStore.jumpBackDialogCrumb();
      toast.error(t("message.api_handler.avatar_private_or_deleted"));
      logFailure("Loading the avatar dialog failed:")(err);
    })
    .finally(() => {
      clearDialogLoadingNextTick(avatarDialog);
    })
    .catch(logFailure("Finishing the avatar dialog load failed:"));
}

export async function getAvatarHistory() {
  const avatarStore = useAvatarStore();
  const userStore = useUserStore();

  const historyArray = await database.getAvatarHistory(userStore.currentUser.id);
  for (const avatar of historyArray) {
    if (avatar.authorId === userStore.currentUser.id || !avatar.id) {
      continue;
    }
    applyAvatar(toAvatarInput(avatar, avatar.id));
  }
  avatarStore.setAvatarHistory(historyArray);
}

export function toAvatarInput(row: AvatarHistoryRow, id: string): AvatarInput {
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

export function addAvatarToHistory(avatarId: string) {
  if (!avatarId) {
    return;
  }
  const avatarStore = useAvatarStore();
  const userStore = useUserStore();

  avatarRequest
    .getAvatar({ avatarId })
    .then((args) => {
      const ref = applyAvatar(args.json);

      database.addAvatarToCache(ref);
      database.addAvatarToHistory(ref.id);

      if (ref.authorId === userStore.currentUser.id) {
        return;
      }

      const historyArray = avatarStore.avatarHistory;
      for (let i = 0; i < historyArray.length; ++i) {
        if (historyArray[i]?.id === ref.id) {
          historyArray.splice(i, 1);
        }
      }

      avatarStore.avatarHistory.unshift(ref);
    })
    .catch((err: unknown) => {
      console.error("Failed to add avatar to history:", err);
    });
}

export function promptClearAvatarHistory() {
  const avatarStore = useAvatarStore();
  const modalStore = useModalStore();
  const t = i18n.global.t;

  modalStore
    .confirm({
      description: t("confirm.clear_avatar_history"),
      title: t("confirm.title"),
      destructive: true,
    })
    .then((result: unknown) => {
      if (!toConfirmOk(result)) return;
      avatarStore.clearAvatarHistory();
    })
    .catch(logFailure("Clearing the avatar history failed:"));
}

export async function getAvatarName(imageUrl: string): Promise<CachedAvatarName> {
  const avatarStore = useAvatarStore();

  const fileId = extractFileId(imageUrl);
  if (!fileId) {
    return {
      ownerId: "",
      avatarName: "-",
      fileCreatedAt: "",
    };
  }
  const cachedName = avatarStore.cachedAvatarNames.get(fileId);
  if (cachedName) {
    return cachedName;
  }
  try {
    const args = await miscRequest.getFile({ fileId });
    if (args.json.tags.includes("icon")) {
      return {
        ownerId: "",
        avatarName: "-",
        fileCreatedAt: "",
      };
    }
    return storeAvatarImage(args, avatarStore.cachedAvatarNames);
  } catch (error: unknown) {
    console.error("Failed to get avatar images:", error);
    return {
      ownerId: "",
      avatarName: "-",
      fileCreatedAt: "",
    };
  }
}

export async function lookupAvatars(type: string, search: string) {
  const avatarProviderStore = useAvatarProviderStore();
  const vrcxUpdaterStore = useVRCXUpdaterStore();

  const avatars = new Map<string, RemoteAvatar>();
  if (type === "search") {
    try {
      const url = `${avatarProviderStore.avatarRemoteDatabaseProvider}?${type}=${encodeURIComponent(search)}&n=5000`;
      const response = await webApiService.execute({
        url,
        method: "GET",
        headers: remoteProviderHeaders(vrcxUpdaterStore.vrcxId),
      });
      const json: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
      if (response.status === 200 && Array.isArray(json)) {
        json.forEach((avatar: unknown) => {
          if (!isRecord(avatar)) return;
          const ref = createRemoteAvatar(avatar);
          if (!avatars.has(String(avatar["Id"]))) {
            avatars.set(ref.id, ref);
          }
        });
      } else {
        throw new Error(`Error: ${response.data}`);
      }
    } catch (err: unknown) {
      const msg = `Avatar search failed for ${search} with ${avatarProviderStore.avatarRemoteDatabaseProvider}\n${String(err)}`;
      console.error(msg);
      toast.error(msg);
    }
  } else if (type === "authorId") {
    const length = avatarProviderStore.avatarRemoteDatabaseProviderList.length;
    for (let i = 0; i < length; ++i) {
      const url = avatarProviderStore.avatarRemoteDatabaseProviderList[i];
      if (url === undefined) {
        continue;
      }
      const avatarArray = await lookupAvatarsByAuthor(url, search);
      avatarArray.forEach((avatar) => {
        if (!avatars.has(avatar.id)) {
          avatars.set(avatar.id, avatar);
        }
      });
    }
  }
  return avatars;
}

export async function lookupAvatarByImageFileId(authorId: string, fileId: string): Promise<string | null> {
  const avatarProviderStore = useAvatarProviderStore();

  for (const providerUrl of avatarProviderStore.avatarRemoteDatabaseProviderList) {
    const avatar = await lookupAvatarByFileId(providerUrl, fileId);
    if (avatar?.id) {
      return avatar.id;
    }
  }

  for (const providerUrl of avatarProviderStore.avatarRemoteDatabaseProviderList) {
    const avatarArray = await lookupAvatarsByAuthor(providerUrl, authorId);
    for (const avatar of avatarArray) {
      if (extractFileId(avatar.imageUrl) === fileId) {
        return avatar.id;
      }
    }
  }
  return null;
}

async function lookupAvatarByFileId(providerUrl: string, fileId: string): Promise<RemoteAvatar | null> {
  const vrcxUpdaterStore = useVRCXUpdaterStore();

  try {
    const url = `${providerUrl}?fileId=${encodeURIComponent(fileId)}`;
    const response = await webApiService.execute({
      url,
      method: "GET",
      headers: remoteProviderHeaders(vrcxUpdaterStore.vrcxId),
    });
    const json: unknown = JSON.parse(response.data);
    logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
    if (response.status === 200 && isRecord(json)) {
      return createRemoteAvatar(json);
    }
    return null;
  } catch {
    return null;
  }
}

async function lookupAvatarsByAuthor(providerUrl: string, authorId: string): Promise<RemoteAvatar[]> {
  const vrcxUpdaterStore = useVRCXUpdaterStore();

  const avatars: RemoteAvatar[] = [];
  if (!providerUrl || !authorId) {
    return avatars;
  }
  const url = `${providerUrl}?authorId=${encodeURIComponent(authorId)}`;
  try {
    const response = await webApiService.execute({
      url,
      method: "GET",
      headers: remoteProviderHeaders(vrcxUpdaterStore.vrcxId),
    });
    const json: unknown = JSON.parse(response.data);
    logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
    if (response.status === 200 && Array.isArray(json)) {
      json.forEach((avatar: unknown) => {
        if (!isRecord(avatar)) return;
        avatars.push(createRemoteAvatar(avatar));
      });
    } else {
      throw new Error(`Error: ${response.data}`);
    }
  } catch (err: unknown) {
    const msg = `Avatar lookup failed for ${authorId} with ${url}\n${String(err)}`;
    console.error(msg);
    toast.error(msg);
  }
  return avatars;
}

export function selectAvatarWithConfirmation(id: string) {
  const modalStore = useModalStore();
  const t = i18n.global.t;

  modalStore
    .confirm({
      description: t("confirm.select_avatar"),
      title: t("confirm.title"),
    })
    .then((result: unknown) => {
      if (!toConfirmOk(result)) return;
      selectAvatarWithoutConfirmation(id).catch(logFailure("Selecting the avatar failed:"));
    })
    .catch(logFailure("Confirming the avatar selection failed:"));
}

export async function selectAvatarWithoutConfirmation(id: string) {
  const userStore = useUserStore();
  const t = i18n.global.t;

  if (userStore.currentUser.currentAvatar === id) {
    toast.info(t("message.avatar.already_selected"));
    return;
  }
  return avatarRequest
    .selectAvatar({
      avatarId: id,
    })
    .then(() => {
      toast.success(t("message.avatar.selected"));
    });
}

export function checkAvatarCache(fileId: string) {
  const avatarStore = useAvatarStore();

  let avatarId = "";
  for (const ref of avatarStore.cachedAvatars.values()) {
    if (extractFileId(ref.imageUrl) === fileId) {
      avatarId = ref.id;
    }
  }
  return avatarId;
}

export async function checkAvatarCacheRemote(fileId: string, ownerUserId: string): Promise<string | null> {
  const advancedSettingsStore = useAdvancedSettingsStore();
  const avatarStore = useAvatarStore();
  const t = i18n.global.t;

  if (advancedSettingsStore.avatarRemoteDatabase) {
    try {
      toast.dismiss(avatarStore.loadingToastId ?? undefined);
      avatarStore.setLoadingToastId(toast.loading(t("message.avatar_lookup.loading")));
      const avatarId = await lookupAvatarByImageFileId(ownerUserId, fileId);
      return avatarId;
    } catch (err: unknown) {
      console.error("Failed to lookup avatar by image file id:", err);
    } finally {
      toast.dismiss(avatarStore.loadingToastId ?? undefined);
    }
  }
  return null;
}

export async function showAvatarAuthorDialog(refUserId: string | undefined, ownerUserId: string, currentAvatarImageUrl: string) {
  const userStore = useUserStore();
  const t = i18n.global.t;

  const fileId = extractFileId(currentAvatarImageUrl);
  if (!fileId) {
    toast.error(t("message.avatar_lookup.failed"));
  } else if (refUserId === userStore.currentUser.id) {
    showAvatarDialog(userStore.currentUser.currentAvatar);
  } else {
    let avatarId: string | null = checkAvatarCache(fileId);
    let ownerId = "";
    if (!avatarId) {
      const avatarInfo = await getAvatarName(currentAvatarImageUrl);
      ownerId = avatarInfo.ownerId;
      if (avatarInfo.ownerId === userStore.currentUser.id) {
        await refreshUserDialogAvatars(fileId);
        return;
      }
    }
    if (!avatarId) {
      avatarId = await checkAvatarCacheRemote(fileId, ownerUserId);
    }
    if (!avatarId) {
      if (ownerUserId === refUserId) {
        toast.warning(t("message.avatar_lookup.private_or_not_found"));
      } else {
        toast.warning(t("message.avatar_lookup.not_found"));
        showUserDialog(ownerId);
      }
    }
    if (avatarId) {
      showAvatarDialog(avatarId);
    }
  }
}

export function addAvatarWearTime(avatarId: string) {
  const userStore = useUserStore();

  if (!userStore.currentUser.$previousAvatarSwapTime || !avatarId) {
    return;
  }
  const timeSpent = Date.now() - userStore.currentUser.$previousAvatarSwapTime;
  database.addAvatarTimeSpent(avatarId, timeSpent);
}

export async function preloadOwnAvatars() {
  const params: SearchAvatars["query"] = {
    n: 50,
    offset: 0,
    sort: "updated",
    order: "descending",
    releaseStatus: "all",
    user: "me",
  };
  await processBulk({
    fn: (params) => avatarRequest.getAvatars(params),
    N: -1,
    params,
    handle: (args) => {
      for (const json of args.json) {
        applyAvatar(json);
      }
    },
  });
}

export function removeAvatarFromCache(id: string) {
  const avatarStore = useAvatarStore();
  avatarStore.cachedAvatars.delete(id);
  removeAvatarSearchIndex(id);
}
