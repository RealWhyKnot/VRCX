import { replaceBioSymbols } from "./base/string";

type AvatarImageArgs = {
  json: {
    name: string;
    ownerId: string;
    versions: { created_at: string }[];
  };
  params: {
    fileId: string;
  };
};

export type CachedAvatarName = {
  ownerId: string;
  avatarName: string;
  fileCreatedAt: string;
};

type UnityPackageLike = {
  variant?: string | undefined;
  platform?: string | undefined;
  performanceRating?: string | undefined;
};

function storeAvatarImage(args: AvatarImageArgs, cachedAvatarNames: Map<string, CachedAvatarName>): CachedAvatarName {
  const refCreatedAt = args.json.versions[0];
  if (!refCreatedAt) {
    throw new Error(`avatar image ${args.params.fileId} has no versions`);
  }
  const fileCreatedAt = refCreatedAt.created_at;
  const fileId = args.params.fileId;
  let avatarName = "";
  const imageName = args.json.name;
  const avatarNameRegex = /Avatar - (.*) - Image -/gi.exec(imageName);
  if (avatarNameRegex) {
    avatarName = replaceBioSymbols(avatarNameRegex[1] ?? "");
  }
  const ownerId = args.json.ownerId;
  const avatarInfo = {
    ownerId,
    avatarName,
    fileCreatedAt,
  };
  cachedAvatarNames.set(fileId, avatarInfo);
  return avatarInfo;
}

function parseAvatarUrl(avatar: string): string | null {
  const url = new URL(avatar);
  const urlPath = url.pathname;
  if (urlPath.substring(5, 13) === "/avatar/") {
    const avatarId = urlPath.substring(13);
    return avatarId;
  }
  return null;
}

function getPlatformInfo<T extends UnityPackageLike>(
  unityPackages: readonly T[] | null | undefined
): {
  pc: Partial<T>;
  android: Partial<T>;
  ios: Partial<T>;
} {
  let pc: Partial<T> = {};
  let android: Partial<T> = {};
  let ios: Partial<T> = {};
  if (unityPackages) {
    for (const unityPackage of unityPackages) {
      if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
        continue;
      }
      if (unityPackage.platform === "standalonewindows") {
        if (unityPackage.performanceRating === "None" && pc.performanceRating) {
          continue;
        }
        pc = unityPackage;
      } else if (unityPackage.platform === "android") {
        if (unityPackage.performanceRating === "None" && android.performanceRating) {
          continue;
        }
        android = unityPackage;
      } else if (unityPackage.platform === "ios") {
        if (unityPackage.performanceRating === "None" && ios.performanceRating) {
          continue;
        }
        ios = unityPackage;
      }
    }
  }
  return { pc, android, ios };
}

function compareUnityVersion(unitySortNumber: bigint | number | string | undefined, sdkUnityVersion: string | null | undefined): boolean {
  if (!sdkUnityVersion) {
    console.error("No sdkUnityVersion provided");
    return false;
  }

  const array = sdkUnityVersion.split(".");
  if (array.length < 3) {
    console.error("Invalid sdkUnityVersion");
    return false;
  }
  const [major = "", minor = "", patch = ""] = array;
  let currentUnityVersion = major;
  currentUnityVersion += minor.padStart(2, "0");
  const indexFirstLetter = patch.search(/[a-zA-Z]/);
  if (indexFirstLetter > -1) {
    currentUnityVersion += patch.slice(0, indexFirstLetter).padStart(2, "0");
    currentUnityVersion += "0";
    const letter = patch.slice(indexFirstLetter, indexFirstLetter + 1);
    if (letter === "p") {
      currentUnityVersion += "1";
    } else {
      currentUnityVersion += "0";
    }
    currentUnityVersion += "0";
  } else {
    currentUnityVersion += "000";
  }

  currentUnityVersion = currentUnityVersion.replace(/\D/g, "");

  return Number(unitySortNumber) <= Number(currentUnityVersion);
}

export { storeAvatarImage, parseAvatarUrl, getPlatformInfo, compareUnityVersion };
