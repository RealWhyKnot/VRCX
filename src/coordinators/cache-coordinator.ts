import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import type { FileAnalysis } from "vrchat";
import { useAuthStore } from "../stores/auth";
import { useAvatarStore } from "../stores/avatar";
import { useInstanceStore } from "../stores/instance";
import { useWorldStore } from "../stores/world";
import { extractFileId, extractFileVersion, extractVariantVersion } from "../shared/utils/file-utils";
import { compareUnityVersion } from "../shared/utils/avatar";
import { formatFileSize } from "../shared/utils/base/format";
import { queryRequest } from "../api/query-request";
import type { Json } from "../types/vrcx";

type CacheSubject = {
  id: string;
  unityPackages: readonly CacheUnityPackage[];
};

type CacheUnityPackage = {
  variant?: string | undefined;
  platform?: string | undefined;
  assetUrl?: string | null | undefined;
  unitySortNumber?: number | undefined;
};

type OptionalCacheSubject = {
  unityPackages?: CacheUnityPackage[] | undefined;
  assetUrl?: string | undefined;
};

type CacheInfo = {
  Item1: number;
  Item2: boolean;
  Item3: string;
};

type FileAnalysisJson = Omit<Json<FileAnalysis>, "avatarStats"> & {
  avatarStats?: Json<FileAnalysis>["avatarStats"];
  _fileSize?: string;
  _uncompressedSize?: string;
  _totalTextureUsage?: string;
};

function emptyCacheInfo(): CacheInfo {
  return { Item1: -1, Item2: false, Item3: "" };
}

function toVersionNumber(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

async function deleteVRChatCache(ref: Pick<CacheSubject, "unityPackages">) {
  const authStore = useAuthStore();
  const sdkUnityVersion = authStore.cachedConfig.sdkUnityVersion;
  let assetUrl = "";
  let variant = "";
  for (const unityPackage of ref.unityPackages.slice().reverse()) {
    if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
      continue;
    }
    if (unityPackage.platform === "standalonewindows" && compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
      assetUrl = unityPackage.assetUrl ?? "";
      if (!unityPackage.variant || unityPackage.variant === "standard") {
        variant = "security";
      } else {
        variant = unityPackage.variant;
      }
      break;
    }
  }
  const id = extractFileId(assetUrl);
  const version = toVersionNumber(extractFileVersion(assetUrl));
  const variantVersion = toVersionNumber(extractVariantVersion(assetUrl));
  await AssetBundleManager.DeleteCache(id, version, variant, variantVersion);
}

async function checkVRChatCache(ref: OptionalCacheSubject): Promise<CacheInfo> {
  if (!ref.unityPackages) {
    return emptyCacheInfo();
  }
  const authStore = useAuthStore();
  const sdkUnityVersion = authStore.cachedConfig.sdkUnityVersion;
  let assetUrl = "";
  let variant = "";
  for (const unityPackage of ref.unityPackages.slice().reverse()) {
    if (unityPackage.variant && unityPackage.variant !== "security") {
      continue;
    }
    if (unityPackage.platform === "standalonewindows" && compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
      assetUrl = unityPackage.assetUrl ?? "";
      if (!unityPackage.variant || unityPackage.variant === "standard") {
        variant = "security";
      } else {
        variant = unityPackage.variant;
      }
      break;
    }
  }
  if (!assetUrl) {
    assetUrl = ref.assetUrl ?? "";
  }
  const id = extractFileId(assetUrl);
  const version = toVersionNumber(extractFileVersion(assetUrl));
  const variantVersion = toVersionNumber(extractVariantVersion(assetUrl));
  if (!id || !version) {
    return emptyCacheInfo();
  }

  let pending: Promise<CacheInfo>;
  try {
    pending = AssetBundleManager.CheckVRChatCache(id, version, variant, variantVersion);
  } catch (err: unknown) {
    console.error("Failed reading VRChat cache size:", err);
    toast.error(`Failed reading VRChat cache size: ${String(err)}`);
    return emptyCacheInfo();
  }
  return pending;
}

async function getBundleDateSize(ref: CacheSubject): Promise<Map<string, FileAnalysisJson>> {
  const authStore = useAuthStore();
  const sdkUnityVersion = authStore.cachedConfig.sdkUnityVersion;
  const avatarStore = useAvatarStore();
  const { avatarDialog } = storeToRefs(avatarStore);
  const worldStore = useWorldStore();
  const { worldDialog } = storeToRefs(worldStore);
  const instanceStore = useInstanceStore();
  const { currentInstanceWorld, currentInstanceLocation } = storeToRefs(instanceStore);
  const bundleJson = new Map<string, FileAnalysisJson>();
  for (const unityPackage of ref.unityPackages.slice().reverse()) {
    if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
      continue;
    }
    if (!compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
      continue;
    }

    const platform = unityPackage.platform;
    if (typeof platform === "undefined" || bundleJson.has(platform)) {
      continue;
    }
    const assetUrl = unityPackage.assetUrl ?? "";
    const fileId = extractFileId(assetUrl);
    const version = toVersionNumber(extractFileVersion(assetUrl));
    const variant = !unityPackage.variant || unityPackage.variant === "standard" ? "security" : unityPackage.variant;
    if (!fileId || !version) {
      continue;
    }
    const args = await queryRequest.fetch("fileAnalysis", {
      fileId,
      version,
      variant,
    });
    if (!args.json.success) {
      continue;
    }

    const json: FileAnalysisJson = args.json;
    if (typeof json.fileSize !== "undefined") {
      json._fileSize = formatFileSize(json.fileSize);
    }
    if (typeof json.uncompressedSize !== "undefined") {
      json._uncompressedSize = formatFileSize(json.uncompressedSize);
    }
    if (typeof json.avatarStats?.totalTextureUsage !== "undefined") {
      json._totalTextureUsage = formatFileSize(json.avatarStats.totalTextureUsage);
    }
    bundleJson.set(platform, json);

    if (avatarDialog.value.id === ref.id) {
      avatarDialog.value.fileAnalysis[platform] = json;
    }

    if (worldDialog.value.id === ref.id) {
      worldDialog.value.fileAnalysis[platform] = json;
    }

    if (currentInstanceLocation.value.worldId === ref.id) {
      currentInstanceWorld.value.fileAnalysis[platform] = json;
    }
  }

  return bundleJson;
}

export { deleteVRChatCache, checkVRChatCache, getBundleDateSize };
