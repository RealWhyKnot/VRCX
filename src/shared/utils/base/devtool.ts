import { extractFileId, extractFileVersion, extractVariantVersion } from "../file-utils";
import { useAuthStore } from "../../../stores/auth";
import { useAvatarStore } from "../../../stores/avatar";
import { useWorldStore } from "../../../stores/world";
import { compareUnityVersion } from "../avatar";

type UnityPackageRef = {
  variant?: string | null;
  platform?: string | null;
  unitySortNumber?: bigint | number | string;
  assetUrl?: string | null;
};

type DialogRef = {
  assetUrl?: string | null;
  unityPackages?: UnityPackageRef[] | null;
};

function parseVersion(text: string): number {
  return text.length > 0 && Number.isFinite(Number(text)) ? Number(text) : Number.NaN;
}

async function getBundleLocation(input: string | null | undefined): Promise<string | null> {
  const authStore = useAuthStore();
  const cachedConfig: { sdkUnityVersion?: string | null } = authStore.cachedConfig;
  const sdkUnityVersion = cachedConfig.sdkUnityVersion;
  const worldStore = useWorldStore();
  const avatarStore = useAvatarStore();
  const avatarDialogRef: DialogRef = avatarStore.avatarDialog.ref;
  const worldDialogRef: DialogRef = worldStore.worldDialog.ref;
  let assetUrl = input;
  let variant = "";
  if (!assetUrl) {
    if (avatarStore.avatarDialog.visible && (avatarDialogRef.unityPackages?.length ?? 0) > 0) {
      for (const unityPackage of avatarDialogRef.unityPackages?.slice().reverse() ?? []) {
        if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
          continue;
        }
        if (unityPackage.platform === "standalonewindows" && compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
          assetUrl = unityPackage.assetUrl;
          if (unityPackage.variant !== "standard") {
            variant = unityPackage.variant ?? "";
          }
          break;
        }
      }
    } else if (avatarStore.avatarDialog.visible && avatarDialogRef.assetUrl) {
      assetUrl = avatarDialogRef.assetUrl;
    } else if (worldStore.worldDialog.visible && (worldDialogRef.unityPackages?.length ?? 0) > 0) {
      for (const unityPackage of worldDialogRef.unityPackages?.slice().reverse() ?? []) {
        if (unityPackage.platform === "standalonewindows" && compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
          assetUrl = unityPackage.assetUrl;
          break;
        }
      }
    } else if (worldStore.worldDialog.visible && worldDialogRef.assetUrl) {
      assetUrl = worldDialogRef.assetUrl;
    }
  }
  if (!assetUrl) {
    return null;
  }
  const fileId = extractFileId(assetUrl);
  const fileVersion = parseVersion(extractFileVersion(assetUrl));
  const variantVersion = parseVersion(extractVariantVersion(assetUrl));
  const assetLocation = await AssetBundleManager.GetVRChatCacheFullLocation(fileId, fileVersion, variant, variantVersion);
  const cacheInfo = await AssetBundleManager.CheckVRChatCache(fileId, fileVersion, variant, variantVersion);
  const isInCache = cacheInfo.Item1 > 0;
  console.log(`InCache: ${isInCache}`);
  const fullAssetLocation = `${assetLocation}\\__data`;
  console.log(fullAssetLocation);
  return fullAssetLocation;
}

export { getBundleLocation };
