type UnityPackageFields = { variant?: string | undefined; platform?: string | undefined };

function getAvailablePlatforms(unityPackages: readonly UnityPackageFields[] | null | undefined) {
  let isPC = false;
  let isQuest = false;
  let isIos = false;
  if (unityPackages) {
    for (const unityPackage of unityPackages) {
      if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
        continue;
      }
      if (unityPackage.platform === "standalonewindows") {
        isPC = true;
      } else if (unityPackage.platform === "android") {
        isQuest = true;
      } else if (unityPackage.platform === "ios") {
        isIos = true;
      }
    }
  }
  return { isPC, isQuest, isIos };
}

export { getAvailablePlatforms };
